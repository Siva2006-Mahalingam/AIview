-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create resumes table
CREATE TABLE public.resumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  ocr_text TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create interview_sessions table
CREATE TABLE public.interview_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  interview_type TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  ats_score INTEGER,
  performance_percentage DECIMAL(5,2),
  overall_feedback TEXT,
  improvements TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Create interview_questions table
CREATE TABLE public.interview_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  score INTEGER,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create emotion_snapshots table
CREATE TABLE public.emotion_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  snapshot_url TEXT,
  emotions JSONB NOT NULL DEFAULT '{}',
  is_nervous BOOLEAN DEFAULT false,
  confidence_level DECIMAL(5,2),
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper function to check session ownership
CREATE OR REPLACE FUNCTION public.is_session_owner(session_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.interview_sessions
    WHERE id = session_uuid AND user_id = auth.uid()
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Resumes policies
CREATE POLICY "Users can view own resumes"
ON public.resumes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
ON public.resumes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes"
ON public.resumes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
ON public.resumes FOR DELETE
USING (auth.uid() = user_id);

-- Interview sessions policies
CREATE POLICY "Users can view own sessions"
ON public.interview_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
ON public.interview_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
ON public.interview_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
ON public.interview_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Interview questions policies
CREATE POLICY "Users can view own questions"
ON public.interview_questions FOR SELECT
USING (public.is_session_owner(session_id));

CREATE POLICY "Users can insert own questions"
ON public.interview_questions FOR INSERT
WITH CHECK (public.is_session_owner(session_id));

CREATE POLICY "Users can update own questions"
ON public.interview_questions FOR UPDATE
USING (public.is_session_owner(session_id));

-- Emotion snapshots policies
CREATE POLICY "Users can view own snapshots"
ON public.emotion_snapshots FOR SELECT
USING (public.is_session_owner(session_id));

CREATE POLICY "Users can insert own snapshots"
ON public.emotion_snapshots FOR INSERT
WITH CHECK (public.is_session_owner(session_id));

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

-- Storage policies for resumes bucket
CREATE POLICY "Users can upload own resumes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own resumes"
ON storage.objects FOR SELECT
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own resumes"
ON storage.objects FOR DELETE
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage bucket for emotion snapshots
INSERT INTO storage.buckets (id, name, public) VALUES ('emotion-snapshots', 'emotion-snapshots', false);

-- Storage policies for emotion snapshots bucket
CREATE POLICY "Users can upload own snapshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'emotion-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own snapshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'emotion-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();