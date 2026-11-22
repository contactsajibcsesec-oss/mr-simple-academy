-- Mr. Simple Academy v1.7 migration
-- Run in Supabase SQL Editor.
-- Adds:
-- 1. explanation column to template_questions & exam_questions
-- 2. student_submit_exam: auto-grades and instantly publishes pure MCQ exams
-- 3. student_review_answers: allows students to see questions, their selected answers, correct answers & explanations
-- 4. admin functions updated to save and copy explanation

------------------------------------------------------------------------
-- 1. Schema Updates: add explanation column
------------------------------------------------------------------------
ALTER TABLE public.template_questions ADD COLUMN IF NOT EXISTS explanation text;
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS explanation text;

------------------------------------------------------------------------
-- 2. student_submit_exam (Auto-grade Pure MCQ Exams)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_submit_exam(p_code text, p_exam_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s public.students%rowtype;
  e public.exams%rowtype;
  a public.exam_attempts%rowtype;
  q record;
  sc numeric := 0;
  mt numeric := 0;
  has_written boolean := false;
BEGIN
  SELECT * INTO s FROM public.students
  WHERE is_active AND access_code_hash = extensions.crypt(trim(coalesce(p_code,'')), access_code_hash)
  LIMIT 1;

  IF s.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.exam_students WHERE exam_id = p_exam_id AND student_id = s.id) THEN
    RAISE EXCEPTION 'Invalid access or exam assignment';
  END IF;

  SELECT * INTO e FROM public.exams WHERE id = p_exam_id AND is_published;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found or unpublished'; END IF;

  SELECT * INTO a FROM public.exam_attempts WHERE exam_id = p_exam_id AND student_id = s.id FOR UPDATE;
  IF a.id IS NULL OR a.status = 'submitted' THEN
    RAISE EXCEPTION 'Attempt missing or already submitted';
  END IF;

  -- Calculate MCQ score and check if there are any written questions
  FOR q IN SELECT id, question_type, correct_answer, marks FROM public.exam_questions WHERE exam_id = p_exam_id LOOP
    IF q.question_type = 'mcq' THEN
      mt := mt + q.marks;
      IF p_answers->>q.id::text = q.correct_answer THEN
        sc := sc + q.marks;
      END IF;
    ELSIF q.question_type = 'written' THEN
      has_written := true;
    END IF;
  END LOOP;

  IF NOT has_written THEN
    -- Pure MCQ Exam: Automatically grade and publish result immediately!
    UPDATE public.exam_attempts
    SET answers = coalesce(p_answers, '{}'::jsonb),
        mcq_score = sc,
        mcq_total = mt,
        written_score = 0,
        written_total = 0,
        status = 'submitted',
        submitted_at = now(),
        graded_at = now(),
        teacher_feedback = 'স্বয়ংক্রিয় মূল্যায়ন (Auto-graded MCQ Exam)'
    WHERE id = a.id;
  ELSE
    -- Has written questions: Wait for teacher evaluation
    UPDATE public.exam_attempts
    SET answers = coalesce(p_answers, '{}'::jsonb),
        mcq_score = sc,
        mcq_total = mt,
        status = 'submitted',
        submitted_at = now()
    WHERE id = a.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'mcq_score', sc,
    'mcq_total', mt,
    'is_auto_graded', NOT has_written
  );
END $$;

------------------------------------------------------------------------
-- 3. student_review_answers (Review answers & explanations)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_review_answers(p_code text, p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s public.students%rowtype;
  a public.exam_attempts%rowtype;
  e public.exams%rowtype;
  qd jsonb;
BEGIN
  SELECT * INTO s FROM public.students
  WHERE is_active AND access_code_hash = extensions.crypt(trim(coalesce(p_code,'')), access_code_hash)
  LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Invalid access code'; END IF;

  SELECT * INTO a FROM public.exam_attempts WHERE id = p_attempt_id AND student_id = s.id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF a.graded_at IS NULL THEN RAISE EXCEPTION 'ফলাফল এখনো প্রকাশিত হয়নি।'; END IF;

  SELECT * INTO e FROM public.exams WHERE id = a.exam_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'question_text', q.question_text,
    'question_type', q.question_type,
    'options', q.options,
    'correct_answer', q.correct_answer,
    'explanation', q.explanation,
    'marks', q.marks,
    'student_answer', a.answers->>q.id::text,
    'is_correct', CASE 
                    WHEN q.question_type = 'mcq' THEN (a.answers->>q.id::text = q.correct_answer)
                    ELSE NULL 
                  END,
    'files', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', f.id, 'file_name', f.file_name, 'mime_type', f.mime_type))
      FROM public.exam_question_files f WHERE f.question_id = q.id
    ), '[]'::jsonb)
  ) ORDER BY q.created_at), '[]'::jsonb)
  INTO qd
  FROM public.exam_questions q
  WHERE q.exam_id = e.id;

  RETURN jsonb_build_object(
    'success', true,
    'exam', jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'subject', e.subject,
      'total_marks', e.total_marks
    ),
    'attempt', jsonb_build_object(
      'id', a.id,
      'final_score', a.mcq_score + a.written_score,
      'mcq_score', a.mcq_score,
      'mcq_total', a.mcq_total,
      'written_score', a.written_score,
      'submitted_at', a.submitted_at,
      'teacher_feedback', a.teacher_feedback
    ),
    'questions', qd
  );
END $$;

------------------------------------------------------------------------
-- 4. admin_add_template_question & admin_update_template_question with explanation
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_template_question(
  p_template_id uuid,
  p_question_text text,
  p_question_type text,
  p_options jsonb,
  p_correct_answer text,
  p_marks numeric,
  p_explanation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE qid uuid;
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exam_templates WHERE id = p_template_id) THEN 
    RAISE EXCEPTION 'Template not found'; 
  END IF;
  IF p_question_type NOT IN ('mcq', 'written') THEN 
    RAISE EXCEPTION 'Invalid question type'; 
  END IF;

  INSERT INTO public.template_questions(template_id, question_text, question_type, options, correct_answer, marks, explanation)
  VALUES (p_template_id, p_question_text, p_question_type, coalesce(p_options, '[]'::jsonb), p_correct_answer, p_marks, p_explanation)
  RETURNING id INTO qid;

  UPDATE public.exam_templates SET updated_at = now() WHERE id = p_template_id;
  RETURN jsonb_build_object('success', true, 'id', qid);
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_template_question(
  p_question_id uuid,
  p_question_text text,
  p_question_type text,
  p_options jsonb,
  p_correct_answer text,
  p_marks numeric,
  p_explanation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.template_questions
  SET question_text = p_question_text,
      question_type = p_question_type,
      options = coalesce(p_options, '[]'::jsonb),
      correct_answer = p_correct_answer,
      marks = p_marks,
      explanation = p_explanation
  WHERE id = p_question_id;

  RETURN jsonb_build_object('success', true);
END $$;

------------------------------------------------------------------------
-- 5. admin_list_template_questions to include explanation
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_template_questions(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id,
      'template_id', q.template_id,
      'question_text', q.question_text,
      'question_type', q.question_type,
      'options', q.options,
      'correct_answer', q.correct_answer,
      'marks', q.marks,
      'explanation', q.explanation,
      'files', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', f.id, 'file_name', f.file_name, 'mime_type', f.mime_type, 'storage_path', f.storage_path))
        FROM public.template_question_files f WHERE f.question_id = q.id
      ), '[]'::jsonb)
    ) ORDER BY q.created_at)
    FROM public.template_questions q
    WHERE q.template_id = p_template_id
  ), '[]'::jsonb);
END $$;

------------------------------------------------------------------------
-- 6. admin_schedule_template to copy explanation into exam_questions
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_schedule_template(
  p_template_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_student_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  t public.exam_templates%rowtype;
  eid uuid;
  assigned_count integer := 0;
  q record;
  new_qid uuid;
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO t FROM public.exam_templates WHERE id = p_template_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Question Bank exam not found'; END IF;
  IF p_starts_at IS NULL OR p_duration_minutes IS NULL OR p_duration_minutes < 1 THEN 
    RAISE EXCEPTION 'Invalid exam schedule'; 
  END IF;
  IF coalesce(array_length(p_student_ids, 1), 0) = 0 THEN 
    RAISE EXCEPTION 'Select at least one student'; 
  END IF;

  INSERT INTO public.exams(title, subject, description, starts_at, duration_minutes, total_marks, is_published)
  VALUES (t.title, t.subject, t.description, p_starts_at, p_duration_minutes, t.total_marks, true)
  RETURNING id INTO eid;

  INSERT INTO public.exam_students(exam_id, student_id)
  SELECT eid, s.id FROM public.students s WHERE s.id = ANY(p_student_ids) AND s.is_active
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS assigned_count = ROW_COUNT;
  IF assigned_count = 0 THEN RAISE EXCEPTION 'No active students selected'; END IF;

  FOR q IN SELECT * FROM public.template_questions WHERE template_id = p_template_id ORDER BY created_at LOOP
    INSERT INTO public.exam_questions(exam_id, question_text, question_type, options, correct_answer, marks, explanation, created_at)
    VALUES (eid, q.question_text, q.question_type, q.options, q.correct_answer, q.marks, q.explanation, q.created_at)
    RETURNING id INTO new_qid;

    INSERT INTO public.exam_question_files(question_id, storage_path, file_name, mime_type, created_at)
    SELECT new_qid, tf.storage_path, tf.file_name, tf.mime_type, tf.created_at
    FROM public.template_question_files tf WHERE tf.question_id = q.id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'exam_id', eid, 'assigned_count', assigned_count);
END $$;

------------------------------------------------------------------------
-- 7. Permissions
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.student_submit_exam(text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_review_answers(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_template_question(uuid, text, text, jsonb, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_template_question(uuid, text, text, jsonb, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_template_questions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_schedule_template(uuid, timestamptz, integer, uuid[]) TO authenticated;
