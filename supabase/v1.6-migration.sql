-- Mr. Simple Academy v1.6 migration
-- Run in Supabase SQL Editor.
-- Adds: Student Update, Student Delete, Student Code Reset, Exam Delete, Template Delete functions for Admin Panel.

------------------------------------------------------------------------
-- 1. admin_update_student
--    Allows admin to update student name, class name, and roll number.
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_student(
  p_student_id uuid,
  p_name text,
  p_class_name text,
  p_roll_no text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(coalesce(p_name,''))) = 0 THEN RAISE EXCEPTION 'Student name is required'; END IF;

  UPDATE public.students
  SET name = trim(p_name),
      class_name = nullif(trim(p_class_name), ''),
      roll_no = nullif(trim(p_roll_no), '')
  WHERE id = p_student_id;

  RETURN jsonb_build_object('success', true);
END $$;

------------------------------------------------------------------------
-- 2. admin_delete_student
--    Allows admin to delete a student (cascades to assignments/attempts).
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_student(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  DELETE FROM public.students WHERE id = p_student_id;

  RETURN jsonb_build_object('success', true);
END $$;

------------------------------------------------------------------------
-- 3. admin_reset_student_code
--    Allows admin to reset access code for a student.
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_student_code(
  p_student_id uuid,
  p_new_code text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(coalesce(p_new_code,''))) < 6 THEN 
    RAISE EXCEPTION 'Access code must be at least 6 characters'; 
  END IF;

  UPDATE public.students
  SET access_code_hash = extensions.crypt(trim(p_new_code), extensions.gen_salt('bf'))
  WHERE id = p_student_id;

  RETURN jsonb_build_object('success', true);
END $$;

------------------------------------------------------------------------
-- 4. admin_delete_exam
--    Allows admin to delete a scheduled exam.
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_exam(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  DELETE FROM public.exams WHERE id = p_exam_id;

  RETURN jsonb_build_object('success', true);
END $$;

------------------------------------------------------------------------
-- 5. admin_delete_template
--    Allows admin to permanently delete a question set/template.
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_template(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  DELETE FROM public.exam_templates WHERE id = p_template_id;

  RETURN jsonb_build_object('success', true);
END $$;

------------------------------------------------------------------------
-- 6. Permissions
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_update_student(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_student_code(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_exam(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_template(uuid) TO authenticated;
