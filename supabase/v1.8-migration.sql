-- Mr. Simple Academy v1.8 migration
-- Run in Supabase SQL Editor.
-- Adds:
-- 1. tuition_sessions table to track home tuition days (e.g. 3 days/week, 12 days/month)
-- 2. Admin RPCs: admin_list_tuition_sessions, admin_add_tuition_session, admin_delete_tuition_session
-- 3. Student RPC: student_my_tuition_sessions

------------------------------------------------------------------------
-- 1. Create tuition_sessions table
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tuition_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  topic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, session_date)
);

ALTER TABLE public.tuition_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tuition_sessions FROM anon, authenticated;

------------------------------------------------------------------------
-- 2. Admin RPCs for Tuition Tracker
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_tuition_sessions()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ts.id,
      'student_id', ts.student_id,
      'student_name', s.name,
      'class_name', s.class_name,
      'session_date', ts.session_date,
      'topic', ts.topic,
      'created_at', ts.created_at
    ) ORDER BY ts.session_date DESC, ts.created_at DESC)
    FROM public.tuition_sessions ts
    JOIN public.students s ON s.id = ts.student_id
  ), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_add_tuition_session(
  p_student_id uuid,
  p_session_date date,
  p_topic text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE sid uuid;
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_student_id IS NULL OR p_session_date IS NULL THEN
    RAISE EXCEPTION 'Student and date are required';
  END IF;

  INSERT INTO public.tuition_sessions(student_id, session_date, topic)
  VALUES (p_student_id, p_session_date, nullif(trim(coalesce(p_topic, '')), ''))
  ON CONFLICT (student_id, session_date)
  DO UPDATE SET topic = COALESCE(EXCLUDED.topic, public.tuition_sessions.topic)
  RETURNING id INTO sid;

  RETURN jsonb_build_object('success', true, 'id', sid);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_tuition_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.tuition_sessions WHERE id = p_session_id;
  RETURN jsonb_build_object('success', true);
END $$;

------------------------------------------------------------------------
-- 3. Student RPC for viewing their Tuition Days
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_my_tuition_sessions(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE s public.students%rowtype;
BEGIN
  SELECT * INTO s FROM public.students
  WHERE is_active AND access_code_hash = extensions.crypt(trim(coalesce(p_code, '')), access_code_hash)
  LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Invalid access code'; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ts.id,
      'session_date', ts.session_date,
      'topic', ts.topic
    ) ORDER BY ts.session_date DESC)
    FROM public.tuition_sessions ts
    WHERE ts.student_id = s.id
  ), '[]'::jsonb);
END $$;

------------------------------------------------------------------------
-- 4. Permissions
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_list_tuition_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_tuition_session(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_tuition_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_my_tuition_sessions(text) TO anon, authenticated;
