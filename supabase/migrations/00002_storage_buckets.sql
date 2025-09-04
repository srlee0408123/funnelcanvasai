-- Create storage buckets
-- Supabase free tier: 1GB total storage, limiting individual files to 5MB for better management
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('canvas-assets', 'canvas-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']),
    ('user-uploads', 'user-uploads', true, 5242880, ARRAY['application/pdf', 'text/plain', 'text/csv', 'application/json', 'image/jpeg', 'image/png']);

-- Storage policies for canvas-assets bucket (public bucket)
CREATE POLICY "Public read access for canvas assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'canvas-assets');

CREATE POLICY "Anyone can upload canvas assets" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'canvas-assets');

CREATE POLICY "Anyone can update canvas assets" ON storage.objects
    FOR UPDATE USING (bucket_id = 'canvas-assets');

CREATE POLICY "Anyone can delete canvas assets" ON storage.objects
    FOR DELETE USING (bucket_id = 'canvas-assets');

-- Storage policies for user-uploads bucket (public bucket)
CREATE POLICY "Public read access for user uploads" ON storage.objects
    FOR SELECT USING (bucket_id = 'user-uploads');

CREATE POLICY "Anyone can upload files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'user-uploads');

CREATE POLICY "Anyone can update uploads" ON storage.objects
    FOR UPDATE USING (bucket_id = 'user-uploads');

CREATE POLICY "Anyone can delete uploads" ON storage.objects
    FOR DELETE USING (bucket_id = 'user-uploads');