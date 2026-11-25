-- Mr. Simple Academy v1.9 migration
-- Run in Supabase SQL Editor.
-- Adds:
-- 1. monthly_target column to public.students (default 12, configurable per student e.g. 12 for 3 days/wk, 16 for 4 days/wk)
-- 2. admin_set_student_tuition_target(p_student_id, p_monthly_target)
-- 3. Updates admin_list_students and student_portal_login to include monthly_target

------------------------------------------------------------------------
-- 1. Add monthly_target column to students
------------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS monthly_target integer NOT NULL DEFAULT 12;

------------------------------------------------------------------------
-- 2. admin_set_student_tuition_target
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_student_tuition_target(
  p_student_id uuid,
  p_monthly_target integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_monthly_target IS NULL OR p_monthly_target < 1 OR p_monthly_target > 31 THEN
    RAISE EXCEPTION 'Monthly target must be between 1 and 31 days';
  END IF;

  UPDATE public.students
  SET monthly_target = p_monthly_target
  WHERE id = p_student_id;

  RETURN jsonb_build_object('success', true, 'monthly_target', p_monthly_target);
END $$;

------------------------------------------------------------------------
-- 3. Update admin_list_students to include monthly_target
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_students()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'class_name', class_name,
      'roll_no', roll_no,
      'is_active', is_active,
      'monthly_target', monthly_target
    ) ORDER BY name)
    FROM public.students
  ), '[]'::jsonb);
END $$;

------------------------------------------------------------------------
-- 4. Update student_portal_login to include monthly_target
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
    'student', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'class_name', s.class_name,
      'roll_no', s.roll_no,
      'monthly_target', s.monthly_target
    ),
    'exams', ed,
    'submitting_exams', sub_exams
  );
END $$;

------------------------------------------------------------------------
-- 5. Permissions
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_set_student_tuition_target(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_students() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_portal_login(text) TO anon, authenticated;
