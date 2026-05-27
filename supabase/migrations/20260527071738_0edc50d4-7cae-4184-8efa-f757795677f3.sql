-- Restrict technique-videos bucket access by owner folder (auth.uid()) with coach read.
DROP POLICY IF EXISTS "technique_videos_select_own_or_coach" ON storage.objects;
DROP POLICY IF EXISTS "technique_videos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "technique_videos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "technique_videos_delete_own" ON storage.objects;

CREATE POLICY "technique_videos_select_own_or_coach"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'technique-videos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  )
);

CREATE POLICY "technique_videos_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'technique-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "technique_videos_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'technique-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'technique-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "technique_videos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'technique-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
