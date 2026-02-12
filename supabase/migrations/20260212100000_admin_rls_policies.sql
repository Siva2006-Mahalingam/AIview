-- Add admin RLS policies to allow admins to view all data

-- First, let's add a function to check if user is admin (by email for simplicity)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = '231001203@rajalakshmi.edu.in'
  )
$$;

-- Admin policy for profiles: admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin());

-- Admin policy for interview_sessions: admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON public.interview_sessions FOR SELECT
USING (public.is_admin());

-- Admin policy for interview_questions: admins can view all questions
CREATE POLICY "Admins can view all questions"
ON public.interview_questions FOR SELECT
USING (public.is_admin());

-- Admin policy for emotion_snapshots: admins can view all snapshots
CREATE POLICY "Admins can view all snapshots"
ON public.emotion_snapshots FOR SELECT
USING (public.is_admin());

-- Admin policy for resumes: admins can view all resumes
CREATE POLICY "Admins can view all resumes"
ON public.resumes FOR SELECT
USING (public.is_admin());

-- Insert admin into user_roles when they sign up (trigger)
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = '231001203@rajalakshmi.edu.in' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_admin_check ON auth.users;
CREATE TRIGGER on_auth_user_admin_check
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_admin_role();
