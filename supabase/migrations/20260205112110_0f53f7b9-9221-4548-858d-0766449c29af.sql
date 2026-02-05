-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table (secure pattern for role management)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add storage bucket for answer videos (will store video recordings)
INSERT INTO storage.buckets (id, name, public) VALUES ('answer-videos', 'answer-videos', false);

-- Storage policies for answer videos
CREATE POLICY "Users can upload own videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'answer-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'answer-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'answer-videos' AND public.has_role(auth.uid(), 'admin'));

-- Add video_url column to interview_questions
ALTER TABLE public.interview_questions ADD COLUMN video_url TEXT;

-- Add anti-cheat tracking columns to interview_sessions
ALTER TABLE public.interview_sessions ADD COLUMN tab_switches INTEGER DEFAULT 0;
ALTER TABLE public.interview_sessions ADD COLUMN window_resizes INTEGER DEFAULT 0;
ALTER TABLE public.interview_sessions ADD COLUMN fullscreen_exits INTEGER DEFAULT 0;