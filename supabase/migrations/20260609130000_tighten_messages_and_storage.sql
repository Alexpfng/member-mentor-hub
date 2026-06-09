-- Tighten messages UPDATE policy: only the recipient can update (mark read / pin).
-- Combined with the messages_prevent_content_change trigger (immutable content/from_id/to_id/created_at),
-- this ensures senders cannot mutate a sent message.
DROP POLICY IF EXISTS "Users update own message receipts" ON public.messages;

CREATE POLICY "Recipient updates own message receipts"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = to_id)
WITH CHECK (auth.uid() = to_id);

-- Add UPDATE policy on session-media storage objects scoped to the member's own folder.
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
