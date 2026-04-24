/*
  # Create chat images storage bucket

  1. Storage
    - Create `chat-images` bucket for temporary image uploads
    - Enable public access so Lyzr API can fetch the images
  2. Security
    - Allow public read access
    - Allow service role full access for edge function uploads
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read of chat images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'chat-images');

CREATE POLICY "Allow service role insert chat images"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Allow service role delete chat images"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'chat-images');
