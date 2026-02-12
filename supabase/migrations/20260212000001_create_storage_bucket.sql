-- Create storage bucket for answer videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('answer-videos', 'answer-videos', true, 104857600, ARRAY['video/webm', 'video/mp4', 'video/quicktime'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload answer videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'answer-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own videos
CREATE POLICY "Users can read own answer videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'answer-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access (for sharing results)
CREATE POLICY "Public read access to answer videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'answer-videos');
