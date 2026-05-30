
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  email text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  used_by uuid,
  revoked_at timestamptz
);

CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_created_by ON public.invitations(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own invitations"
ON public.invitations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coach'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'coach'::app_role) AND created_by = auth.uid());

-- Public validation function (used by signup page, no auth needed)
CREATE OR REPLACE FUNCTION public.validate_invitation(_token text)
RETURNS TABLE(valid boolean, email text, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.invitations WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, 'not_found'::text; RETURN;
  END IF;
  IF inv.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::text, 'revoked'::text; RETURN;
  END IF;
  IF inv.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::text, 'used'::text; RETURN;
  END IF;
  IF inv.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::text, 'expired'::text; RETURN;
  END IF;
  RETURN QUERY SELECT true, inv.email, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invitation(text) TO anon, authenticated;

-- Consume invitation (called by serverFn after signup)
CREATE OR REPLACE FUNCTION public.consume_invitation(_token text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
BEGIN
  UPDATE public.invitations
  SET used_at = now(), used_by = _user_id
  WHERE token = _token
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_invitation(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invitation(text, uuid) TO service_role;
