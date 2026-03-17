ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS target_role TEXT,
ADD COLUMN IF NOT EXISTS years_experience INTEGER,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_years_experience_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_years_experience_check
    CHECK (years_experience IS NULL OR years_experience >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    email,
    full_name,
    phone,
    target_role,
    years_experience,
    linkedin_url,
    bio
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'target_role',
    CASE
      WHEN COALESCE(new.raw_user_meta_data->>'years_experience', '') ~ '^\d+$'
        THEN (new.raw_user_meta_data->>'years_experience')::INTEGER
      ELSE NULL
    END,
    new.raw_user_meta_data->>'linkedin_url',
    new.raw_user_meta_data->>'bio'
  );

  RETURN new;
END;
$$;
