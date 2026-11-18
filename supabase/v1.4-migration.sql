-- Mr. Simple Academy v1.4
-- Run AFTER your v1.3 migration. Keeps existing exams, attempts and results.
-- Existing exams/questions are copied into Question Bank templates for reuse.

create table if not exists public.exam_templates(
 id uuid primary key default gen_random_uuid(),
 title text not null,
 subject text not null,
 description text,
 total_marks numeric(8,2) not null default 10,
 legacy_source_exam_id uuid unique references public.exams(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.template_questions(
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.exam_templates(id) on delete cascade,
 source_question_id uuid unique,
 question_text text not null,
 question_type text not null check(question_type in ('mcq','written')),
 options jsonb not null default '[]'::jsonb,
 correct_answer text,
 marks numeric(8,2) not null default 1 check(marks>0),
 created_at timestamptz not null default now()
);

create table if not exists public.template_question_files(
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.template_questions(id) on delete cascade,
 storage_path text not null,
 file_name text not null,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),
 created_at timestamptz not null default now()
);

-- Private metadata tables: access only through security-definer RPCs.
alter table public.exam_templates enable row level security;
alter table public.template_questions enable row level security;
alter table public.template_question_files enable row level security;
revoke all on public.exam_templates,public.template_questions,public.template_question_files from anon,authenticated;

-- Backfill: every existing exam becomes a reusable template, without deleting the original exam.
insert into public.exam_templates(title,subject,description,total_marks,legacy_source_exam_id)
select e.title,e.subject,e.description,e.total_marks,e.id
from public.exams e
where not exists(select 1 from public.exam_templates t where t.legacy_source_exam_id=e.id);

insert into public.template_questions(template_id,source_question_id,question_text,question_type,options,correct_answer,marks,created_at)
select t.id,q.id,q.question_text,q.question_type,q.options,q.correct_answer,q.marks,q.created_at
from public.exam_questions q
join public.exam_templates t on t.legacy_source_exam_id=q.exam_id
where not exists(select 1 from public.template_questions tq where tq.source_question_id=q.id);

insert into public.template_question_files(question_id,storage_path,file_name,mime_type,created_at)
select tq.id,f.storage_path,f.file_name,f.mime_type,f.created_at
from public.exam_question_files f
join public.template_questions tq on tq.source_question_id=f.question_id
where not exists(select 1 from public.template_question_files tf where tf.question_id=tq.id and tf.storage_path=f.storage_path);

-- A template's same private file can be referenced by several scheduled instances.
do $$
declare c record;
begin
 for c in
  select conname from pg_constraint
  where conrelid='public.exam_question_files'::regclass and contype='u'
    and pg_get_constraintdef(oid) ilike '%storage_path%'
 loop
  execute format('alter table public.exam_question_files drop constraint %I',c.conname);
 end loop;
end $$;

create or replace function public.admin_list_templates()
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',t.id,'title',t.title,'subject',t.subject,'description',t.description,
   'total_marks',t.total_marks,'created_at',t.created_at,
   'question_count',(select count(*) from public.template_questions q where q.template_id=t.id)
  ) order by t.updated_at desc)
  from public.exam_templates t
 ),'[]'::jsonb);
end $$;

create or replace function public.admin_create_template(p_title text,p_subject text,p_description text,p_total_marks numeric)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare tid uuid;
begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 if length(trim(coalesce(p_title,'')))=0 or length(trim(coalesce(p_subject,'')))=0 then raise exception 'Title and subject required'; end if;
 insert into public.exam_templates(title,subject,description,total_marks)
 values(trim(p_title),trim(p_subject),nullif(trim(coalesce(p_description,'')),''),p_total_marks)
 returning id into tid;
 return jsonb_build_object('success',true,'id',tid);
end $$;

create or replace function public.admin_add_template_question(
 p_template_id uuid,p_question_text text,p_question_type text,p_options jsonb,p_correct_answer text,p_marks numeric
)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare qid uuid;
begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.exam_templates where id=p_template_id) then raise exception 'Template not found'; end if;
 if p_question_type not in ('mcq','written') then raise exception 'Invalid question type'; end if;
 insert into public.template_questions(template_id,question_text,question_type,options,correct_answer,marks)
 values(p_template_id,p_question_text,p_question_type,coalesce(p_options,'[]'::jsonb),p_correct_answer,p_marks)
 returning id into qid;
 update public.exam_templates set updated_at=now() where id=p_template_id;
 return jsonb_build_object('success',true,'id',qid);
end $$;

create or replace function public.admin_attach_template_question_file(
 p_question_id uuid,p_storage_path text,p_file_name text,p_mime_type text
)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare fid uuid;
begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 insert into public.template_question_files(question_id,storage_path,file_name,mime_type)
 values(p_question_id,p_storage_path,p_file_name,p_mime_type) returning id into fid;
 return jsonb_build_object('success',true,'id',fid);
end $$;

create or replace function public.admin_schedule_template(
 p_template_id uuid,p_starts_at timestamptz,p_duration_minutes integer,p_student_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare t public.exam_templates%rowtype; eid uuid; assigned_count integer:=0; q record; new_qid uuid;
begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 select * into t from public.exam_templates where id=p_template_id;
 if t.id is null then raise exception 'Question Bank exam not found'; end if;
 if p_starts_at is null or p_duration_minutes is null or p_duration_minutes<1 then raise exception 'Invalid exam schedule'; end if;
 if coalesce(array_length(p_student_ids,1),0)=0 then raise exception 'Select at least one student'; end if;

 insert into public.exams(title,subject,description,starts_at,duration_minutes,total_marks,is_published)
 values(t.title,t.subject,t.description,p_starts_at,p_duration_minutes,t.total_marks,true)
 returning id into eid;

 insert into public.exam_students(exam_id,student_id)
 select eid,s.id from public.students s where s.id=any(p_student_ids) and s.is_active
 on conflict do nothing;
 get diagnostics assigned_count=row_count;
 if assigned_count=0 then raise exception 'No active students selected'; end if;

 for q in select * from public.template_questions where template_id=p_template_id order by created_at loop
  insert into public.exam_questions(exam_id,question_text,question_type,options,correct_answer,marks,created_at)
  values(eid,q.question_text,q.question_type,q.options,q.correct_answer,q.marks,q.created_at)
  returning id into new_qid;

  insert into public.exam_question_files(question_id,storage_path,file_name,mime_type,created_at)
  select new_qid,tf.storage_path,tf.file_name,tf.mime_type,tf.created_at
  from public.template_question_files tf where tf.question_id=q.id;
 end loop;

 return jsonb_build_object('success',true,'exam_id',eid,'assigned_count',assigned_count);
end $$;

create or replace function public.admin_list_exams()
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',e.id,'title',e.title,'subject',e.subject,'description',e.description,
   'starts_at',e.starts_at,'duration_minutes',e.duration_minutes,
   'total_marks',e.total_marks,'is_published',e.is_published,
   'assigned_count',(select count(*) from public.exam_students es where es.exam_id=e.id)
  ) order by e.starts_at desc)
  from public.exams e
 ),'[]'::jsonb);
end $$;

grant execute on function public.admin_list_templates() to authenticated;
grant execute on function public.admin_create_template(text,text,text,numeric) to authenticated;
grant execute on function public.admin_add_template_question(uuid,text,text,jsonb,text,numeric) to authenticated;
grant execute on function public.admin_attach_template_question_file(uuid,text,text,text) to authenticated;
grant execute on function public.admin_schedule_template(uuid,timestamptz,integer,uuid[]) to authenticated;
grant execute on function public.admin_list_exams() to authenticated;
