DROP POLICY IF EXISTS "Users update own message receipts" ON public.messages;

CREATE POLICY "Recipient updates own message receipts"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = to_id)
WITH CHECK (auth.uid() = to_id);

CREATE POLICY "Member updates own session media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'session-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'session-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);