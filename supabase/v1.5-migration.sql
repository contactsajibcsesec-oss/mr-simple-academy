-- Mr. Simple Academy v1.5 migration
-- Run AFTER v1.4 migration in Supabase SQL Editor.
-- Adds: student_retake_exam, exam_attempts constraint fix, student_portal_login filter fix, and grants.

------------------------------------------------------------------------
-- 1. Drop the unique(exam_id, student_id) constraint on exam_attempts
--    so a student can have multiple attempts (retakes) for the same exam.
------------------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.exam_attempts'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.exam_attempts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

------------------------------------------------------------------------
-- 2. student_retake_exam
--    Called when a graded student wants to retake a previously submitted exam.
--    Creates a fresh exam_students assignment (re-inserts if needed) so the
--    exam reappears in the student's upcoming list, ready for a new attempt.
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_retake_exam(p_code text, p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s  public.students%rowtype;
  a  public.exam_attempts%rowtype;
  e  public.exams%rowtype;
BEGIN
  -- Validate student
  SELECT * INTO s
    FROM public.students
   WHERE is_active
     AND access_code_hash = extensions.crypt(trim(coalesce(p_code,'')), access_code_hash)
   LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Invalid access code'; END IF;

  -- Validate attempt belongs to this student and is graded
  SELECT * INTO a
    FROM public.exam_attempts
   WHERE id = p_attempt_id AND student_id = s.id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF a.graded_at IS NULL THEN RAISE EXCEPTION 'Result not yet published'; END IF;

  -- Get the exam
  SELECT * INTO e FROM public.exams WHERE id = a.exam_id;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found'; END IF;

  -- Re-insert exam_students assignment (if removed or missing)
  INSERT INTO public.exam_students(exam_id, student_id)
  VALUES (e.id, s.id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'exam_id', e.id);
END $$;

------------------------------------------------------------------------
-- 3. Update student_portal_login to return student attempts alongside exams
--    Includes assigned_at, started_at, submitted_at, graded_at
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_portal_login(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s  public.students%rowtype;
  ed jsonb;
  sub_exams jsonb;
BEGIN
  SELECT * INTO s
    FROM public.students
   WHERE is_active
     AND access_code_hash = extensions.crypt(trim(coalesce(p_code,'')), access_code_hash)
   LIMIT 1;
  IF s.id IS NULL THEN RETURN jsonb_build_object('success', false); END IF;

  -- Exams assigned to this student that are NOT yet submitted
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'subject', e.subject,
    'description', e.description,
    'starts_at', e.starts_at,
    'duration_minutes', e.duration_minutes,
    'total_marks', e.total_marks,
    'assigned_at', es.assigned_at,
    'attempt_status', (
      SELECT ea.status FROM public.exam_attempts ea
      WHERE ea.exam_id = e.id AND ea.student_id = s.id
      ORDER BY ea.started_at DESC LIMIT 1
    )
  ) ORDER BY e.starts_at DESC),'[]'::jsonb)
  INTO ed
  FROM public.exams e
  JOIN public.exam_students es ON es.exam_id = e.id AND es.student_id = s.id
  WHERE e.is_published
    AND NOT EXISTS (
      SELECT 1 FROM public.exam_attempts ea
       WHERE ea.exam_id = e.id
         AND ea.student_id = s.id
         AND ea.status = 'submitted'
    );

  -- Exams submitted by this student awaiting evaluation (submitting / under review)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id', a.id,
    'exam_id', e.id,
    'title', e.title,
    'subject', e.subject,
    'total_marks', e.total_marks,
    'submitted_at', a.submitted_at,
    'mcq_score', a.mcq_score,
    'mcq_total', a.mcq_total
  ) ORDER BY a.submitted_at DESC),'[]'::jsonb)
  INTO sub_exams
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.student_id = s.id
    AND a.status = 'submitted'
    AND a.graded_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'student', jsonb_build_object('id',s.id,'name',s.name,'class_name',s.class_name,'roll_no',s.roll_no),
    'exams', ed,
    'submitting_exams', sub_exams
  );
END $$;

------------------------------------------------------------------------
-- 4. Update student_start_exam to allow multiple attempts
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_start_exam(p_code text, p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s  public.students%rowtype;
  e  public.exams%rowtype;
  a  public.exam_attempts%rowtype;
  qd jsonb;
BEGIN
  SELECT * INTO s
    FROM public.students
   WHERE is_active
     AND access_code_hash = extensions.crypt(trim(coalesce(p_code,'')), access_code_hash)
   LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Invalid access code'; END IF;

  IF NOT EXISTS(SELECT 1 FROM public.exam_students WHERE exam_id = p_exam_id AND student_id = s.id) THEN
    RAISE EXCEPTION 'You are not assigned to this exam';
  END IF;

  SELECT * INTO e FROM public.exams WHERE id = p_exam_id AND is_published;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found or unpublished'; END IF;

  -- Block if already submitted
  IF EXISTS(SELECT 1 FROM public.exam_attempts WHERE exam_id = e.id AND student_id = s.id AND status = 'submitted') THEN
    RAISE EXCEPTION 'Already submitted';
  END IF;

  -- Find or create in_progress attempt
  SELECT * INTO a FROM public.exam_attempts WHERE exam_id = e.id AND student_id = s.id AND status = 'in_progress';
  IF a.id IS NULL THEN
    INSERT INTO public.exam_attempts(exam_id, student_id) VALUES(e.id, s.id) RETURNING * INTO a;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'question_text',q.question_text,'question_type',q.question_type,
    'options',q.options,'marks',q.marks,
    'files',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'file_name',f.file_name,'mime_type',f.mime_type))
                      FROM public.exam_question_files f WHERE f.question_id = q.id),'[]'::jsonb)
  ) ORDER BY q.created_at),'[]'::jsonb)
  INTO qd
  FROM public.exam_questions q WHERE q.exam_id = e.id;

  RETURN jsonb_build_object(
    'success', true,
    'exam', jsonb_build_object(
      'id',e.id,
      'title',e.title,
      'subject',e.subject,
      'duration_minutes',e.duration_minutes,
      'total_marks',e.total_marks,
      'started_at', a.started_at
    ),
    'questions', qd,
    'answers', a.answers
  );
END $$;

------------------------------------------------------------------------
-- 5. Update student_my_results to show graded results
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_my_results(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE s public.students%rowtype;
BEGIN
  SELECT * INTO s
    FROM public.students
   WHERE is_active
     AND access_code_hash = extensions.crypt(trim(coalesce(p_code,'')), access_code_hash)
   LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Invalid access code'; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'attempt_id', a.id,
      'exam_title', e.title,
      'subject', e.subject,
      'submitted_at', a.submitted_at,
      'is_graded', a.graded_at IS NOT NULL,
      'final_score', a.mcq_score + a.written_score,
      'total_marks', e.total_marks,
      'teacher_feedback', a.teacher_feedback,
      'mcq_score', a.mcq_score,
      'written_score', a.written_score
    ) ORDER BY a.submitted_at DESC)
    FROM public.exam_attempts a
    JOIN public.exams e ON e.id = a.exam_id
    WHERE a.student_id = s.id AND a.status = 'submitted' AND a.graded_at IS NOT NULL
  ),'[]'::jsonb);
END $$;

------------------------------------------------------------------------
-- 6. Permissions
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.student_portal_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_start_exam(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_my_results(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_retake_exam(text, uuid) TO anon, authenticated;
