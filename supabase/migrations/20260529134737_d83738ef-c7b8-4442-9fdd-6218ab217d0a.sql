
-- 1. exercise_comments table
CREATE TABLE public.exercise_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  exercise_name text NOT NULL,
  video_id uuid NULL,
  author_id uuid NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('coach','member')),
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_comments_session_exo ON public.exercise_comments(session_id, exercise_name);
CREATE INDEX idx_exercise_comments_video ON public.exercise_comments(video_id);

GRANT SELECT, INSERT ON public.exercise_comments TO authenticated;
GRANT ALL ON public.exercise_comments TO service_role;

ALTER TABLE public.exercise_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member sees comments on own sessions"
ON public.exercise_comments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.member_id = auth.uid())
  OR public.has_role(auth.uid(), 'coach'::app_role)
);

CREATE POLICY "Member posts on own sessions"
ON public.exercise_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    (author_role = 'member' AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.member_id = auth.uid()))
    OR (author_role = 'coach' AND public.has_role(auth.uid(), 'coach'::app_role))
  )
);

-- 2. unread badge on technique_videos
ALTER TABLE public.technique_videos ADD COLUMN IF NOT EXISTS unread_for_member boolean DEFAULT false;

-- 3. Storage policies for technique-videos bucket
CREATE POLICY "Members upload own technique videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'technique-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Members read own technique videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'technique-videos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'coach'::app_role)
  )
);
