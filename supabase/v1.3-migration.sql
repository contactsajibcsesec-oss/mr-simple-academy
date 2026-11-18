-- Mr. Simple Academy v1.3 database upgrade
-- Run in Supabase SQL Editor. Requires existing public.students, public.exams,
-- public.academy_admins and public.is_academy_admin() from the original project.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.exam_questions(
 id uuid primary key default gen_random_uuid(),
 exam_id uuid not null references public.exams(id) on delete cascade,
 question_text text not null,
 question_type text not null check(question_type in ('mcq','written')),
 options jsonb not null default '[]'::jsonb,
 correct_answer text,
 marks numeric(8,2) not null default 1 check(marks>0),
 created_at timestamptz not null default now()
);
create table if not exists public.exam_attempts(
 id uuid primary key default gen_random_uuid(),
 exam_id uuid not null references public.exams(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 answers jsonb not null default '{}'::jsonb,
 mcq_score numeric(8,2) not null default 0,
 mcq_total numeric(8,2) not null default 0,
 written_score numeric(8,2) not null default 0,
 written_total numeric(8,2) not null default 0,
 written_marks jsonb not null default '{}'::jsonb,
 teacher_feedback text,
 status text not null default 'in_progress' check(status in ('in_progress','submitted')),
 started_at timestamptz not null default now(),
 submitted_at timestamptz,
 graded_at timestamptz,
 unique(exam_id,student_id)
);
alter table public.exam_attempts add column if not exists written_score numeric(8,2) not null default 0;
alter table public.exam_attempts add column if not exists written_total numeric(8,2) not null default 0;
alter table public.exam_attempts add column if not exists written_marks jsonb not null default '{}'::jsonb;
alter table public.exam_attempts add column if not exists teacher_feedback text;
alter table public.exam_attempts add column if not exists graded_at timestamptz;

create table if not exists public.exam_students(
 exam_id uuid not null references public.exams(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 assigned_at timestamptz not null default now(),
 primary key(exam_id,student_id)
);
create table if not exists public.exam_question_files(
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.exam_questions(id) on delete cascade,
 storage_path text not null unique,
 file_name text not null,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),
 created_at timestamptz not null default now()
);
create table if not exists public.exam_answer_files(
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
 question_id uuid references public.exam_questions(id) on delete set null,
 student_id uuid not null references public.students(id) on delete cascade,
 storage_path text not null unique,
 file_name text not null,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),
 created_at timestamptz not null default now()
);
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_students enable row level security;
alter table public.exam_question_files enable row level security;
alter table public.exam_answer_files enable row level security;
revoke all on public.exam_questions,public.exam_attempts,public.exam_students,public.exam_question_files,public.exam_answer_files from anon,authenticated;

-- Existing exams are assigned to all active students once to preserve current access.
insert into public.exam_students(exam_id,student_id)
select e.id,s.id from public.exams e cross join public.students s where s.is_active
on conflict do nothing;

create or replace function public.admin_list_students()
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'class_name',class_name,'roll_no',roll_no,'is_active',is_active) order by name) from public.students),'[]'::jsonb);
end $$;

create or replace function public.admin_list_exams()
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'subject',subject,'description',description,'starts_at',starts_at,'duration_minutes',duration_minutes,'total_marks',total_marks,'is_published',is_published) order by starts_at desc) from public.exams),'[]'::jsonb);
end $$;

create or replace function public.admin_create_student(p_name text,p_class_name text,p_roll_no text,p_access_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 if length(trim(coalesce(p_name,'')))=0 or length(trim(coalesce(p_access_code,'')))<6 then raise exception 'Name and access code (min 6 chars) required'; end if;
 insert into public.students(name,class_name,roll_no,access_code_hash)
 values(trim(p_name),nullif(trim(p_class_name),''),nullif(trim(p_roll_no),''),extensions.crypt(trim(p_access_code),extensions.gen_salt('bf')));
 return jsonb_build_object('success',true);
end $$;

create or replace function public.admin_create_exam(p_title text,p_subject text,p_description text,p_starts_at timestamptz,p_duration_minutes integer,p_total_marks numeric)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare new_id uuid; begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 insert into public.exams(title,subject,description,starts_at,duration_minutes,total_marks,is_published)
 values(trim(p_title),trim(p_subject),p_description,p_starts_at,p_duration_minutes,p_total_marks,false) returning id into new_id;
 return jsonb_build_object('success',true,'id',new_id);
end $$;

create or replace function public.admin_assign_exam_students(p_exam_id uuid,p_student_ids uuid[])
returns jsonb language plpgsql security definer set search_path=''
as $$ declare n int; begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 if coalesce(array_length(p_student_ids,1),0)=0 then raise exception 'Select at least one student'; end if;
 delete from public.exam_students where exam_id=p_exam_id;
 insert into public.exam_students(exam_id,student_id)
 select p_exam_id,s.id from public.students s where s.id=any(p_student_ids) and s.is_active
 on conflict do nothing;
 get diagnostics n=row_count;
 if n=0 then raise exception 'No active students selected'; end if;
 update public.exams set is_published=true where id=p_exam_id;
 return jsonb_build_object('success',true,'assigned_count',n);
end $$;

create or replace function public.admin_add_question(p_exam_id uuid,p_question_text text,p_question_type text,p_options jsonb,p_correct_answer text,p_marks numeric)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare qid uuid; begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 if p_question_type not in ('mcq','written') then raise exception 'Invalid question type'; end if;
 insert into public.exam_questions(exam_id,question_text,question_type,options,correct_answer,marks)
 values(p_exam_id,p_question_text,p_question_type,coalesce(p_options,'[]'::jsonb),p_correct_answer,p_marks) returning id into qid;
 return jsonb_build_object('success',true,'id',qid);
end $$;

create or replace function public.admin_attach_question_file(p_question_id uuid,p_storage_path text,p_file_name text,p_mime_type text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare fid uuid; begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 insert into public.exam_question_files(question_id,storage_path,file_name,mime_type)
 values(p_question_id,p_storage_path,p_file_name,p_mime_type) returning id into fid;
 return jsonb_build_object('success',true,'id',fid);
end $$;

create or replace function public.admin_list_questions(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'question_text',q.question_text,'question_type',q.question_type,'options',q.options,'correct_answer',q.correct_answer,'marks',q.marks,'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'file_name',f.file_name,'mime_type',f.mime_type)) from public.exam_question_files f where f.question_id=q.id),'[]'::jsonb)) order by q.created_at) from public.exam_questions q where q.exam_id=p_exam_id),'[]'::jsonb);
end $$;

create or replace function public.student_portal_login(p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare s public.students%rowtype; ed jsonb; begin
 select * into s from public.students where is_active and access_code_hash=extensions.crypt(trim(coalesce(p_code,'')),access_code_hash) limit 1;
 if s.id is null then return jsonb_build_object('success',false); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'subject',e.subject,'description',e.description,'starts_at',e.starts_at,'duration_minutes',e.duration_minutes,'total_marks',e.total_marks) order by e.starts_at),'[]'::jsonb)
 into ed from public.exams e join public.exam_students es on es.exam_id=e.id and es.student_id=s.id
 where e.is_published and e.starts_at+make_interval(mins=>e.duration_minutes)>=now();
 return jsonb_build_object('success',true,'student',jsonb_build_object('id',s.id,'name',s.name,'class_name',s.class_name,'roll_no',s.roll_no),'exams',ed);
end $$;

create or replace function public.student_start_exam(p_code text,p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare s public.students%rowtype; e public.exams%rowtype; a public.exam_attempts%rowtype; qd jsonb; begin
 select * into s from public.students where is_active and access_code_hash=extensions.crypt(trim(coalesce(p_code,'')),access_code_hash) limit 1;
 if s.id is null then raise exception 'Invalid access code'; end if;
 if not exists(select 1 from public.exam_students where exam_id=p_exam_id and student_id=s.id) then raise exception 'You are not assigned to this exam'; end if;
 select * into e from public.exams where id=p_exam_id and is_published;
 if e.id is null or now()<e.starts_at or now()>e.starts_at+make_interval(mins=>e.duration_minutes) then raise exception 'Exam is not available now'; end if;
 insert into public.exam_attempts(exam_id,student_id) values(e.id,s.id) on conflict(exam_id,student_id) do nothing;
 select * into a from public.exam_attempts where exam_id=e.id and student_id=s.id;
 if a.status='submitted' then raise exception 'Already submitted'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'question_text',q.question_text,'question_type',q.question_type,'options',q.options,'marks',q.marks,'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'file_name',f.file_name,'mime_type',f.mime_type)) from public.exam_question_files f where f.question_id=q.id),'[]'::jsonb)) order by q.created_at),'[]'::jsonb) into qd from public.exam_questions q where q.exam_id=e.id;
 return jsonb_build_object('success',true,'exam',jsonb_build_object('id',e.id,'title',e.title,'subject',e.subject,'duration_minutes',e.duration_minutes,'total_marks',e.total_marks),'questions',qd,'answers',a.answers);
end $$;

create or replace function public.student_submit_exam(p_code text,p_exam_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare s public.students%rowtype; e public.exams%rowtype; a public.exam_attempts%rowtype; q record; sc numeric:=0; mt numeric:=0; begin
 select * into s from public.students where is_active and access_code_hash=extensions.crypt(trim(coalesce(p_code,'')),access_code_hash) limit 1;
 if s.id is null or not exists(select 1 from public.exam_students where exam_id=p_exam_id and student_id=s.id) then raise exception 'Invalid access or exam assignment'; end if;
 select * into e from public.exams where id=p_exam_id and is_published;
 select * into a from public.exam_attempts where exam_id=p_exam_id and student_id=s.id for update;
 if a.id is null or a.status='submitted' then raise exception 'Attempt missing or already submitted'; end if;
 if now()>e.starts_at+make_interval(mins=>e.duration_minutes) then raise exception 'Exam time ended'; end if;
 for q in select id,question_type,correct_answer,marks from public.exam_questions where exam_id=p_exam_id loop
  if q.question_type='mcq' then mt:=mt+q.marks; if p_answers->>q.id::text=q.correct_answer then sc:=sc+q.marks; end if; end if;
 end loop;
 update public.exam_attempts set answers=coalesce(p_answers,'{}'::jsonb),mcq_score=sc,mcq_total=mt,status='submitted',submitted_at=now() where id=a.id;
 return jsonb_build_object('success',true,'mcq_score',sc,'mcq_total',mt);
end $$;

create or replace function public.admin_list_attempts()
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',a.id,'student_name',s.name,'exam_title',e.title,'status',a.status,'started_at',a.started_at,'submitted_at',a.submitted_at,
 'mcq_score',a.mcq_score,'mcq_total',a.mcq_total,'written_score',a.written_score,'written_total',a.written_total,
 'final_score',a.mcq_score+a.written_score,'total_marks',e.total_marks,'is_graded',a.graded_at is not null,
 'teacher_feedback',a.teacher_feedback,'answers',a.answers,'written_marks',a.written_marks,
 'written_questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'question_text',q.question_text,'marks',q.marks) order by q.created_at) from public.exam_questions q where q.exam_id=a.exam_id and q.question_type='written'),'[]'::jsonb),
 'answer_files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'question_id',f.question_id,'file_name',f.file_name,'mime_type',f.mime_type)) from public.exam_answer_files f where f.attempt_id=a.id),'[]'::jsonb)
 ) order by a.submitted_at desc nulls last) from public.exam_attempts a join public.students s on s.id=a.student_id join public.exams e on e.id=a.exam_id),'[]'::jsonb);
end $$;

create or replace function public.admin_grade_attempt(p_attempt_id uuid,p_written_marks jsonb,p_feedback text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare a public.exam_attempts%rowtype; q record; total numeric:=0; earned numeric:=0; v numeric; begin
 if not public.is_academy_admin() then raise exception 'Not authorized'; end if;
 select * into a from public.exam_attempts where id=p_attempt_id and status='submitted' for update;
 if a.id is null then raise exception 'Submitted attempt not found'; end if;
 for q in select id,marks from public.exam_questions where exam_id=a.exam_id and question_type='written' loop
  total:=total+q.marks;
  v:=coalesce((p_written_marks->>q.id::text)::numeric,0);
  if v<0 or v>q.marks then raise exception 'Invalid marks for question %',q.id; end if;
  earned:=earned+v;
 end loop;
 update public.exam_attempts set written_marks=coalesce(p_written_marks,'{}'::jsonb),written_score=earned,written_total=total,teacher_feedback=p_feedback,graded_at=now() where id=a.id;
 return jsonb_build_object('success',true);
end $$;

create or replace function public.student_my_results(p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare s public.students%rowtype; begin
 select * into s from public.students where is_active and access_code_hash=extensions.crypt(trim(coalesce(p_code,'')),access_code_hash) limit 1;
 if s.id is null then raise exception 'Invalid access code'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('attempt_id',a.id,'exam_title',e.title,'subject',e.subject,'submitted_at',a.submitted_at,'is_graded',a.graded_at is not null,'final_score',a.mcq_score+a.written_score,'total_marks',e.total_marks,'teacher_feedback',a.teacher_feedback) order by a.submitted_at desc) from public.exam_attempts a join public.exams e on e.id=a.exam_id where a.student_id=s.id and a.status='submitted' and a.graded_at is not null),'[]'::jsonb);
end $$;

grant execute on function public.admin_list_students() to authenticated;
grant execute on function public.admin_list_exams() to authenticated;
grant execute on function public.admin_create_student(text,text,text,text) to authenticated;
grant execute on function public.admin_create_exam(text,text,text,timestamptz,integer,numeric) to authenticated;
grant execute on function public.admin_assign_exam_students(uuid,uuid[]) to authenticated;
grant execute on function public.admin_add_question(uuid,text,text,jsonb,text,numeric) to authenticated;
grant execute on function public.admin_attach_question_file(uuid,text,text,text) to authenticated;
grant execute on function public.admin_list_questions(uuid) to authenticated;
grant execute on function public.admin_list_attempts() to authenticated;
grant execute on function public.admin_grade_attempt(uuid,jsonb,text) to authenticated;
grant execute on function public.student_portal_login(text) to anon,authenticated;
grant execute on function public.student_start_exam(text,uuid) to anon,authenticated;
grant execute on function public.student_submit_exam(text,uuid,jsonb) to anon,authenticated;
grant execute on function public.student_my_results(text) to anon,authenticated;


-- Allow authenticated academy admins to upload and read question files directly.
-- Student answer files are written/read only by the Edge Function (service role).
drop policy if exists "academy admins manage question files" on storage.objects;
create policy "academy admins manage question files"
on storage.objects for all to authenticated
using (bucket_id='academy-question-files' and public.is_academy_admin())
with check (bucket_id='academy-question-files' and public.is_academy_admin());

-- No browser role gets direct access to answer-file objects.
drop policy if exists "no direct answer file access" on storage.objects;
create policy "no direct answer file access"
on storage.objects for all to anon, authenticated
using (bucket_id='academy-answer-files' and false)
with check (bucket_id='academy-answer-files' and false);
