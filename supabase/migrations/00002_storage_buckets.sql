-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('canvas-assets', 'canvas-assets', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm']),
    ('user-uploads', 'user-uploads', false, 104857600, ARRAY['application/pdf', 'text/plain', 'text/csv', 'application/json']);

-- Storage policies for canvas-assets bucket
CREATE POLICY "Public read access for canvas assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'canvas-assets');

CREATE POLICY "Authenticated users can upload canvas assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'canvas-assets' AND
        auth.uid() IS NOT NULL
    );

CREATE POLICY "Users can update their own canvas assets" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'canvas-assets' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own canvas assets" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'canvas-assets' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for user-uploads bucket
CREATE POLICY "Users can view their own uploads" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'user-uploads' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can upload to their own folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'user-uploads' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own uploads" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'user-uploads' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own uploads" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'user-uploads' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );