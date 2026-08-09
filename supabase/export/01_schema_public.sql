--
-- PostgreSQL database dump
--

\restrict W57diQJKQLlrr3nbrIsiWcDXz05G7Lr1EruR8gt3duBcuf0gZan9pHgSmrFEGjS

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'coach',
    'member'
);


--
-- Name: can_subscribe_topic(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_subscribe_topic(_topic text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _topic IS NULL THEN
    RETURN false;
  END IF;

  -- Per-user private topics: "user:<uid>" or "user:<uid>:<suffix>"
  IF _topic = 'user:' || uid::text
     OR _topic LIKE 'user:' || uid::text || ':%' THEN
    RETURN true;
  END IF;

  -- Coach-only topics: "coach:*"
  IF _topic LIKE 'coach:%' AND public.has_role(uid, 'coach') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


--
-- Name: consume_invitation(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_invitation(_token text, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: delete_email(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_email(queue_name text, message_id bigint) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;


--
-- Name: detect_personal_record(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_personal_record() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_member_id UUID;
  v_max_weight NUMERIC;
  v_max_reps INTEGER;
BEGIN
  IF NEW.exercise_name IS NULL OR COALESCE(NEW.completed, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT s.member_id INTO v_member_id FROM public.sessions s WHERE s.id = NEW.session_id;
  IF v_member_id IS NULL THEN RETURN NEW; END IF;

  -- best weight ever for this exercise (exclude current row)
  SELECT COALESCE(MAX(sl.weight_kg), 0)
  INTO v_max_weight
  FROM public.set_logs sl
  JOIN public.sessions s ON s.id = sl.session_id
  WHERE s.member_id = v_member_id
    AND sl.exercise_name = NEW.exercise_name
    AND sl.id <> NEW.id
    AND COALESCE(sl.completed, true) = true;

  SELECT COALESCE(MAX(sl.reps), 0)
  INTO v_max_reps
  FROM public.set_logs sl
  JOIN public.sessions s ON s.id = sl.session_id
  WHERE s.member_id = v_member_id
    AND sl.exercise_name = NEW.exercise_name
    AND sl.id <> NEW.id
    AND COALESCE(sl.completed, true) = true;

  IF (NEW.weight_kg IS NOT NULL AND NEW.weight_kg > v_max_weight)
     OR (NEW.weight_kg IS NULL AND NEW.reps IS NOT NULL AND NEW.reps > v_max_reps) THEN
    INSERT INTO public.personal_records (member_id, exercise_id, exercise_name, weight_kg, reps, session_id, date)
    VALUES (v_member_id, NEW.exercise_id, NEW.exercise_name, NEW.weight_kg, NEW.reps, NEW.session_id, CURRENT_DATE);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: email_queue_dispatch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_queue_dispatch() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    BEGIN
      -- Serialize disarm against email_queue_wake on a shared advisory lock, then
      -- re-read under it: an enqueue racing the unschedule either committed (we
      -- see its row and leave the cron) or waits and re-arms after we commit.
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
      IF EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
         OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
        RETURN;
      END IF;
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  IF (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://project--b874bc4b-f1bb-4a60-a4d8-9d9571de7494.lovable.app/lovable/email/queue/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$$;


--
-- Name: email_queue_wake(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_queue_wake() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
BEGIN
  -- Runs inside the enqueue transaction; the outer handler guarantees nothing
  -- below can roll back the customer's email. Shared advisory lock serializes
  -- arming against email_queue_dispatch's disarm.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule('process-email-queue', '5 seconds', $cron$ SELECT public.email_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://project--b874bc4b-f1bb-4a60-a4d8-9d9571de7494.lovable.app/lovable/email/queue/process',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
  RETURN NULL;
END;
$_$;


--
-- Name: enqueue_email(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_email(queue_name text, payload jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


--
-- Name: messages_prevent_content_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.messages_prevent_content_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.from_id IS DISTINCT FROM OLD.from_id
     OR NEW.to_id IS DISTINCT FROM OLD.to_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'messages.content, from_id, to_id and created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: move_to_dlq(text, text, bigint, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;


--
-- Name: read_email_batch(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


--
-- Name: validate_invitation(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_invitation(_token text) RETURNS TABLE(valid boolean, email text, reason text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assignment_weeks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_weeks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    member_id uuid NOT NULL,
    program_id uuid,
    week_number integer NOT NULL,
    based_on_week integer,
    structure jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    changes_summary jsonb DEFAULT '[]'::jsonb NOT NULL,
    start_date date,
    published_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    draft_structure jsonb,
    CONSTRAINT assignment_weeks_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'in_progress'::text, 'done'::text])))
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    member_id uuid NOT NULL,
    start_date date,
    end_date date,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    session_mode text DEFAULT 'debutant'::text
);


--
-- Name: body_measurements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.body_measurements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    waist_cm numeric,
    hips_cm numeric,
    chest_cm numeric,
    arm_cm numeric,
    thigh_cm numeric,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: challenge_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_participants (
    challenge_id uuid NOT NULL,
    member_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    title text NOT NULL,
    metric text NOT NULL,
    target numeric NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenges_dates_ordered CHECK ((ends_on >= starts_on)),
    CONSTRAINT challenges_metric_check CHECK ((metric = ANY (ARRAY['sessions'::text, 'volume_kg'::text, 'distance_km'::text]))),
    CONSTRAINT challenges_target_check CHECK ((target > (0)::numeric))
);


--
-- Name: cololikes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cololikes (
    event_key text NOT NULL,
    liker_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_send_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text,
    template_name text NOT NULL,
    recipient_email text NOT NULL,
    status text NOT NULL,
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_send_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'suppressed'::text, 'failed'::text, 'bounced'::text, 'complained'::text, 'dlq'::text])))
);


--
-- Name: email_send_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_state (
    id integer DEFAULT 1 NOT NULL,
    retry_after_until timestamp with time zone,
    batch_size integer DEFAULT 10 NOT NULL,
    send_delay_ms integer DEFAULT 200 NOT NULL,
    auth_email_ttl_minutes integer DEFAULT 15 NOT NULL,
    transactional_email_ttl_minutes integer DEFAULT 60 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_send_state_id_check CHECK ((id = 1))
);


--
-- Name: email_unsubscribe_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_unsubscribe_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: exercise_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercise_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    exercise_name text NOT NULL,
    video_id uuid,
    author_id uuid NOT NULL,
    author_role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exercise_comments_author_role_check CHECK ((author_role = ANY (ARRAY['coach'::text, 'member'::text]))),
    CONSTRAINT exercise_comments_content_check CHECK (((length(content) > 0) AND (length(content) <= 2000)))
);


--
-- Name: exercise_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercise_feedbacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    exercise_name text,
    block_id text,
    rpe numeric(3,1),
    member_comment text,
    felt_too_easy boolean DEFAULT false,
    felt_too_hard boolean DEFAULT false,
    could_not_do boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT exercise_feedbacks_rpe_check CHECK (((rpe >= (1)::numeric) AND (rpe <= (10)::numeric)))
);

ALTER TABLE ONLY public.exercise_feedbacks REPLICA IDENTITY FULL;


--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text,
    muscles text[],
    description text,
    youtube_url text,
    youtube_id text,
    color text,
    starts_at_top boolean DEFAULT true,
    requires_pelvis_cue boolean DEFAULT false,
    created_by uuid,
    is_global boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    default_tempo text,
    coach_notes text,
    muscle_group text,
    equipement text,
    is_archived boolean DEFAULT false,
    intensity_code text,
    movement_patterns text[] DEFAULT '{}'::text[] NOT NULL,
    image_url text,
    CONSTRAINT exercises_color_check CHECK ((color = ANY (ARRAY['red'::text, 'green'::text, 'yellow'::text, 'blue'::text])))
);


--
-- Name: free_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.free_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    name text NOT NULL,
    category text,
    series integer,
    reps text,
    charge text,
    distance_km numeric,
    duration_min integer,
    elevation_m integer,
    rpe integer,
    note text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: glossary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.glossary (
    cle text NOT NULL,
    titre text NOT NULL,
    contenu text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: intensity_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intensity_codes (
    code text NOT NULL,
    label text NOT NULL,
    description text NOT NULL,
    color_hex text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(24), 'base64'::text) NOT NULL,
    email text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    used_at timestamp with time zone,
    used_by uuid,
    revoked_at timestamp with time zone
);


--
-- Name: member_coach_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_coach_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: member_notification_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_notification_prefs (
    user_id uuid NOT NULL,
    planned_session boolean DEFAULT true NOT NULL,
    weight_reminder boolean DEFAULT true NOT NULL,
    logbook boolean DEFAULT true NOT NULL,
    pr boolean DEFAULT true NOT NULL,
    new_week boolean DEFAULT true NOT NULL,
    coach_msg boolean DEFAULT true NOT NULL,
    streak boolean DEFAULT true NOT NULL,
    weight_reminder_dow integer DEFAULT 0 NOT NULL,
    weight_reminder_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: member_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    weight_kg numeric,
    height_cm integer,
    level text,
    goal text,
    injuries text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT member_profiles_level_check CHECK ((level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_id uuid NOT NULL,
    to_id uuid NOT NULL,
    content text NOT NULL,
    pinned boolean DEFAULT false,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pain_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pain_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    session_id uuid,
    exercise_name text NOT NULL,
    zone text NOT NULL,
    intensity integer NOT NULL,
    comment text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pain_reports_intensity_check CHECK (((intensity >= 1) AND (intensity <= 5)))
);

ALTER TABLE ONLY public.pain_reports REPLICA IDENTITY FULL;


--
-- Name: personal_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    exercise_id uuid,
    exercise_name text,
    weight_kg numeric,
    reps integer,
    date date,
    session_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: planned_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planned_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    program_id uuid,
    week_number integer,
    day_label text NOT NULL,
    planned_date date,
    reminder_time time without time zone,
    status text DEFAULT 'planned'::text NOT NULL,
    session_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT planned_sessions_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'done'::text, 'skipped'::text, 'rest'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    first_name text,
    last_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_archived boolean DEFAULT false NOT NULL,
    share_milestones boolean DEFAULT false NOT NULL,
    planning_week_start_day smallint,
    CONSTRAINT profiles_planning_week_start_day_check CHECK (((planning_week_start_day >= 1) AND (planning_week_start_day <= 7)))
);


--
-- Name: programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    duration_weeks integer,
    frequency_per_week integer,
    objective text,
    level text,
    structure jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: progress_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    storage_path text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: run_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    member_id uuid NOT NULL,
    distance_km numeric(6,2),
    duration_sec integer,
    elevation_m integer,
    avg_hr integer,
    pace_sec_per_km integer,
    rpe integer,
    source text DEFAULT 'manual'::text NOT NULL,
    confidence numeric(3,2),
    screenshot_media_id uuid,
    raw_extraction jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT run_stats_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'screenshot'::text, 'strava'::text])))
);


--
-- Name: running_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.running_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    short_id text DEFAULT substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8) NOT NULL,
    coach_id uuid NOT NULL,
    name text NOT NULL,
    difficulty text,
    distance_km numeric,
    dplus_m numeric,
    dminus_m numeric,
    points jsonb DEFAULT '[]'::jsonb NOT NULL,
    gpx_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    member_id uuid NOT NULL,
    type text NOT NULL,
    storage_path text NOT NULL,
    thumbnail_path text,
    caption text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_media_type_check CHECK ((type = ANY (ARRAY['photo'::text, 'video'::text])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    program_id uuid,
    week_number integer,
    day_number integer,
    session_label text,
    date date,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_minutes integer,
    overall_feeling integer,
    member_note text,
    coach_note text,
    average_rpe numeric,
    total_volume_kg numeric,
    status text DEFAULT 'in_progress'::text,
    created_at timestamp with time zone DEFAULT now(),
    coach_seen boolean DEFAULT false NOT NULL,
    session_type text DEFAULT 'program'::text NOT NULL,
    free_title text,
    free_category text,
    coach_hidden_at timestamp with time zone,
    CONSTRAINT sessions_overall_feeling_check CHECK (((overall_feeling >= 1) AND (overall_feeling <= 10))),
    CONSTRAINT sessions_session_type_check CHECK ((session_type = ANY (ARRAY['program'::text, 'free'::text]))),
    CONSTRAINT sessions_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'skipped'::text])))
);

ALTER TABLE ONLY public.sessions REPLICA IDENTITY FULL;


--
-- Name: set_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.set_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    exercise_id uuid,
    exercise_name text,
    set_number integer,
    weight_kg numeric,
    reps integer,
    rpe numeric(3,1),
    duration_seconds integer,
    distance_m integer,
    note text,
    completed boolean DEFAULT true,
    logged_at timestamp with time zone DEFAULT now(),
    CONSTRAINT set_logs_rpe_check CHECK (((rpe >= (1)::numeric) AND (rpe <= (10)::numeric)))
);


--
-- Name: suppressed_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppressed_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    reason text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suppressed_emails_reason_check CHECK ((reason = ANY (ARRAY['unsubscribe'::text, 'bounce'::text, 'complaint'::text])))
);


--
-- Name: technique_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technique_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    session_id uuid,
    exercise_name text,
    storage_path text,
    public_url text,
    thumbnail_url text,
    coach_feedback text,
    coach_reviewed boolean DEFAULT false,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    unread_for_member boolean DEFAULT false
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: weekly_logbooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_logbooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    program_id uuid,
    week_number integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    sessions_done integer DEFAULT 0,
    sessions_planned integer DEFAULT 0,
    total_volume_kg numeric DEFAULT 0,
    total_duration_min integer DEFAULT 0,
    avg_rpe numeric,
    weight_start numeric,
    weight_end numeric,
    new_prs jsonb DEFAULT '[]'::jsonb,
    feelings jsonb DEFAULT '{}'::jsonb,
    pain_summary text,
    coach_message text,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: weight_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weight_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    weight_kg numeric NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: assignment_weeks assignment_weeks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_weeks
    ADD CONSTRAINT assignment_weeks_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: body_measurements body_measurements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_measurements
    ADD CONSTRAINT body_measurements_pkey PRIMARY KEY (id);


--
-- Name: challenge_participants challenge_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_pkey PRIMARY KEY (challenge_id, member_id);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: cololikes cololikes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cololikes
    ADD CONSTRAINT cololikes_pkey PRIMARY KEY (event_key, liker_id);


--
-- Name: email_send_log email_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_pkey PRIMARY KEY (id);


--
-- Name: email_send_state email_send_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_state
    ADD CONSTRAINT email_send_state_pkey PRIMARY KEY (id);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_email_key UNIQUE (email);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_token_key UNIQUE (token);


--
-- Name: exercise_comments exercise_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_comments
    ADD CONSTRAINT exercise_comments_pkey PRIMARY KEY (id);


--
-- Name: exercise_feedbacks exercise_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_feedbacks
    ADD CONSTRAINT exercise_feedbacks_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: free_activities free_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_activities
    ADD CONSTRAINT free_activities_pkey PRIMARY KEY (id);


--
-- Name: glossary glossary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.glossary
    ADD CONSTRAINT glossary_pkey PRIMARY KEY (cle);


--
-- Name: intensity_codes intensity_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensity_codes
    ADD CONSTRAINT intensity_codes_pkey PRIMARY KEY (code);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: member_coach_notes member_coach_notes_member_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_coach_notes
    ADD CONSTRAINT member_coach_notes_member_id_key UNIQUE (member_id);


--
-- Name: member_coach_notes member_coach_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_coach_notes
    ADD CONSTRAINT member_coach_notes_pkey PRIMARY KEY (id);


--
-- Name: member_notification_prefs member_notification_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_notification_prefs
    ADD CONSTRAINT member_notification_prefs_pkey PRIMARY KEY (user_id);


--
-- Name: member_profiles member_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT member_profiles_pkey PRIMARY KEY (id);


--
-- Name: member_profiles member_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT member_profiles_user_id_key UNIQUE (user_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: pain_reports pain_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_reports
    ADD CONSTRAINT pain_reports_pkey PRIMARY KEY (id);


--
-- Name: personal_records personal_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_records
    ADD CONSTRAINT personal_records_pkey PRIMARY KEY (id);


--
-- Name: planned_sessions planned_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_sessions
    ADD CONSTRAINT planned_sessions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: progress_photos progress_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_photos
    ADD CONSTRAINT progress_photos_pkey PRIMARY KEY (id);


--
-- Name: run_stats run_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_stats
    ADD CONSTRAINT run_stats_pkey PRIMARY KEY (id);


--
-- Name: run_stats run_stats_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_stats
    ADD CONSTRAINT run_stats_session_id_key UNIQUE (session_id);


--
-- Name: running_routes running_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.running_routes
    ADD CONSTRAINT running_routes_pkey PRIMARY KEY (id);


--
-- Name: running_routes running_routes_short_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.running_routes
    ADD CONSTRAINT running_routes_short_id_key UNIQUE (short_id);


--
-- Name: session_media session_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_media
    ADD CONSTRAINT session_media_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: set_logs set_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_pkey PRIMARY KEY (id);


--
-- Name: suppressed_emails suppressed_emails_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppressed_emails
    ADD CONSTRAINT suppressed_emails_email_key UNIQUE (email);


--
-- Name: suppressed_emails suppressed_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppressed_emails
    ADD CONSTRAINT suppressed_emails_pkey PRIMARY KEY (id);


--
-- Name: technique_videos technique_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technique_videos
    ADD CONSTRAINT technique_videos_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: weekly_logbooks weekly_logbooks_member_id_program_id_week_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_logbooks
    ADD CONSTRAINT weekly_logbooks_member_id_program_id_week_number_key UNIQUE (member_id, program_id, week_number);


--
-- Name: weekly_logbooks weekly_logbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_logbooks
    ADD CONSTRAINT weekly_logbooks_pkey PRIMARY KEY (id);


--
-- Name: weight_logs weight_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weight_logs
    ADD CONSTRAINT weight_logs_pkey PRIMARY KEY (id);


--
-- Name: body_measurements_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX body_measurements_member_idx ON public.body_measurements USING btree (member_id, date);


--
-- Name: challenges_coach_dates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX challenges_coach_dates_idx ON public.challenges USING btree (coach_id, starts_on DESC);


--
-- Name: cololikes_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cololikes_event_idx ON public.cololikes USING btree (event_key);


--
-- Name: free_activities_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX free_activities_session_idx ON public.free_activities USING btree (session_id, order_index);


--
-- Name: idx_assignment_weeks_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignment_weeks_assignment ON public.assignment_weeks USING btree (assignment_id, week_number);


--
-- Name: idx_assignment_weeks_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignment_weeks_member ON public.assignment_weeks USING btree (member_id, week_number);


--
-- Name: idx_assignments_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_member ON public.assignments USING btree (member_id, active);


--
-- Name: idx_email_send_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_created ON public.email_send_log USING btree (created_at DESC);


--
-- Name: idx_email_send_log_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_message ON public.email_send_log USING btree (message_id);


--
-- Name: idx_email_send_log_message_sent_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_email_send_log_message_sent_unique ON public.email_send_log USING btree (message_id) WHERE (status = 'sent'::text);


--
-- Name: idx_email_send_log_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_recipient ON public.email_send_log USING btree (recipient_email);


--
-- Name: idx_exercise_comments_session_exo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercise_comments_session_exo ON public.exercise_comments USING btree (session_id, exercise_name);


--
-- Name: idx_exercise_comments_video; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercise_comments_video ON public.exercise_comments USING btree (video_id);


--
-- Name: idx_exercise_feedbacks_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercise_feedbacks_session ON public.exercise_feedbacks USING btree (session_id);


--
-- Name: idx_exercises_equipement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercises_equipement ON public.exercises USING btree (equipement);


--
-- Name: idx_exercises_intensity_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercises_intensity_code ON public.exercises USING btree (intensity_code);


--
-- Name: idx_exercises_is_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercises_is_archived ON public.exercises USING btree (is_archived);


--
-- Name: idx_exercises_muscle_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercises_muscle_group ON public.exercises USING btree (muscle_group);


--
-- Name: idx_invitations_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_created_by ON public.invitations USING btree (created_by);


--
-- Name: idx_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_token ON public.invitations USING btree (token);


--
-- Name: idx_messages_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_to ON public.messages USING btree (to_id, created_at DESC);


--
-- Name: idx_pain_reports_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pain_reports_member ON public.pain_reports USING btree (member_id, created_at DESC);


--
-- Name: idx_pain_reports_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pain_reports_unresolved ON public.pain_reports USING btree (resolved_at) WHERE (resolved_at IS NULL);


--
-- Name: idx_planned_sessions_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planned_sessions_member ON public.planned_sessions USING btree (member_id, planned_date);


--
-- Name: idx_planned_sessions_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planned_sessions_week ON public.planned_sessions USING btree (member_id, program_id, week_number);


--
-- Name: idx_profiles_is_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_is_archived ON public.profiles USING btree (is_archived);


--
-- Name: idx_running_routes_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_running_routes_coach ON public.running_routes USING btree (coach_id);


--
-- Name: idx_sessions_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_member ON public.sessions USING btree (member_id, date DESC);


--
-- Name: idx_sessions_member_ended; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_member_ended ON public.sessions USING btree (member_id, ended_at DESC);


--
-- Name: idx_set_logs_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_set_logs_session ON public.set_logs USING btree (session_id);


--
-- Name: idx_suppressed_emails_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails USING btree (email);


--
-- Name: idx_unsubscribe_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens USING btree (token);


--
-- Name: idx_weekly_logbooks_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_logbooks_member ON public.weekly_logbooks USING btree (member_id, week_number DESC);


--
-- Name: progress_photos_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX progress_photos_member_idx ON public.progress_photos USING btree (member_id, date);


--
-- Name: run_stats_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_stats_member_idx ON public.run_stats USING btree (member_id, created_at DESC);


--
-- Name: run_stats_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_stats_session_idx ON public.run_stats USING btree (session_id);


--
-- Name: session_media_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_media_session_idx ON public.session_media USING btree (session_id);


--
-- Name: member_coach_notes member_coach_notes_set_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER member_coach_notes_set_updated BEFORE UPDATE ON public.member_coach_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages messages_prevent_content_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_prevent_content_change BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_prevent_content_change();


--
-- Name: assignment_weeks trg_assignment_weeks_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assignment_weeks_updated BEFORE UPDATE ON public.assignment_weeks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: member_notification_prefs trg_notif_prefs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notif_prefs_updated BEFORE UPDATE ON public.member_notification_prefs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: planned_sessions trg_planned_sessions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_planned_sessions_updated BEFORE UPDATE ON public.planned_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: running_routes trg_running_routes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_running_routes_updated_at BEFORE UPDATE ON public.running_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: set_logs trg_set_logs_pr; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_logs_pr AFTER INSERT ON public.set_logs FOR EACH ROW EXECUTE FUNCTION public.detect_personal_record();


--
-- Name: weekly_logbooks trg_weekly_logbooks_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_weekly_logbooks_updated BEFORE UPDATE ON public.weekly_logbooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: member_profiles update_member_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_member_profiles_updated_at BEFORE UPDATE ON public.member_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pain_reports update_pain_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pain_reports_updated_at BEFORE UPDATE ON public.pain_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: programs update_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assignments assignments_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: body_measurements body_measurements_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_measurements
    ADD CONSTRAINT body_measurements_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_member_id_fkey FOREIGN KEY (member_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: challenges challenges_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cololikes cololikes_liker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cololikes
    ADD CONSTRAINT cololikes_liker_id_fkey FOREIGN KEY (liker_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: exercise_feedbacks exercise_feedbacks_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_feedbacks
    ADD CONSTRAINT exercise_feedbacks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: exercises exercises_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: exercises exercises_intensity_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_intensity_code_fkey FOREIGN KEY (intensity_code) REFERENCES public.intensity_codes(code) ON DELETE SET NULL;


--
-- Name: free_activities free_activities_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_activities
    ADD CONSTRAINT free_activities_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: member_profiles member_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_profiles
    ADD CONSTRAINT member_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_from_id_fkey FOREIGN KEY (from_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_to_id_fkey FOREIGN KEY (to_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: personal_records personal_records_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_records
    ADD CONSTRAINT personal_records_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE SET NULL;


--
-- Name: personal_records personal_records_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_records
    ADD CONSTRAINT personal_records_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: personal_records personal_records_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_records
    ADD CONSTRAINT personal_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: programs programs_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: progress_photos progress_photos_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_photos
    ADD CONSTRAINT progress_photos_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: run_stats run_stats_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_stats
    ADD CONSTRAINT run_stats_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: run_stats run_stats_screenshot_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_stats
    ADD CONSTRAINT run_stats_screenshot_media_id_fkey FOREIGN KEY (screenshot_media_id) REFERENCES public.session_media(id) ON DELETE SET NULL;


--
-- Name: run_stats run_stats_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_stats
    ADD CONSTRAINT run_stats_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_media session_media_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_media
    ADD CONSTRAINT session_media_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;


--
-- Name: set_logs set_logs_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE SET NULL;


--
-- Name: set_logs set_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: technique_videos technique_videos_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technique_videos
    ADD CONSTRAINT technique_videos_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: technique_videos technique_videos_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technique_videos
    ADD CONSTRAINT technique_videos_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: weight_logs weight_logs_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weight_logs
    ADD CONSTRAINT weight_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: glossary Auth reads glossary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth reads glossary" ON public.glossary FOR SELECT TO authenticated USING (true);


--
-- Name: intensity_codes Auth reads intensity_codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth reads intensity_codes" ON public.intensity_codes FOR SELECT TO authenticated USING (true);


--
-- Name: challenges Authenticated read challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read challenges" ON public.challenges FOR SELECT TO authenticated USING (true);


--
-- Name: cololikes Authenticated read cololikes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read cololikes" ON public.cololikes FOR SELECT TO authenticated USING (true);


--
-- Name: challenge_participants Authenticated read participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read participants" ON public.challenge_participants FOR SELECT TO authenticated USING (true);


--
-- Name: running_routes Authenticated read routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read routes" ON public.running_routes FOR SELECT TO authenticated USING (true);


--
-- Name: exercises Authenticated users view global or own exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users view global or own exercises" ON public.exercises FOR SELECT TO authenticated USING (((is_global = true) OR (created_by = auth.uid()) OR public.has_role(auth.uid(), 'coach'::public.app_role)));


--
-- Name: assignment_weeks Coach manages all assignment weeks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages all assignment weeks" ON public.assignment_weeks USING (public.has_role(auth.uid(), 'coach'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: assignments Coach manages all assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages all assignments" ON public.assignments USING (public.has_role(auth.uid(), 'coach'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: exercises Coach manages exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages exercises" ON public.exercises USING (public.has_role(auth.uid(), 'coach'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: member_coach_notes Coach manages member coach notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages member coach notes" ON public.member_coach_notes TO authenticated USING (public.has_role(auth.uid(), 'coach'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: invitations Coach manages own invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages own invitations" ON public.invitations TO authenticated USING ((public.has_role(auth.uid(), 'coach'::public.app_role) AND (created_by = auth.uid()))) WITH CHECK ((public.has_role(auth.uid(), 'coach'::public.app_role) AND (created_by = auth.uid())));


--
-- Name: programs Coach manages own programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages own programs" ON public.programs USING ((auth.uid() = coach_id)) WITH CHECK ((auth.uid() = coach_id));


--
-- Name: running_routes Coach manages own routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach manages own routes" ON public.running_routes TO authenticated USING ((public.has_role(auth.uid(), 'coach'::public.app_role) AND (coach_id = auth.uid()))) WITH CHECK ((public.has_role(auth.uid(), 'coach'::public.app_role) AND (coach_id = auth.uid())));


--
-- Name: weekly_logbooks Coach updates logbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach updates logbooks" ON public.weekly_logbooks FOR UPDATE USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: member_profiles Coach updates members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach updates members" ON public.member_profiles FOR UPDATE USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: pain_reports Coach updates pain reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach updates pain reports" ON public.pain_reports FOR UPDATE USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: sessions Coach updates sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach updates sessions" ON public.sessions FOR UPDATE USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: technique_videos Coach updates videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach updates videos" ON public.technique_videos FOR UPDATE USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: personal_records Coach views PRs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views PRs" ON public.personal_records FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: weekly_logbooks Coach views all logbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views all logbooks" ON public.weekly_logbooks FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: member_profiles Coach views all members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views all members" ON public.member_profiles FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: pain_reports Coach views all pain reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views all pain reports" ON public.pain_reports FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: sessions Coach views all sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views all sessions" ON public.sessions FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: exercise_feedbacks Coach views feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views feedbacks" ON public.exercise_feedbacks FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: free_activities Coach views free activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views free activities" ON public.free_activities FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: body_measurements Coach views measurements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views measurements" ON public.body_measurements FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: planned_sessions Coach views planned sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views planned sessions" ON public.planned_sessions FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: progress_photos Coach views progress photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views progress photos" ON public.progress_photos FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: run_stats Coach views run stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views run stats" ON public.run_stats FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: session_media Coach views session media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views session media" ON public.session_media FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: set_logs Coach views set_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views set_logs" ON public.set_logs FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: technique_videos Coach views videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views videos" ON public.technique_videos FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: weight_logs Coach views weight; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach views weight" ON public.weight_logs FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: challenges Coach writes challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach writes challenges" ON public.challenges TO authenticated USING (public.has_role(( SELECT auth.uid() AS uid), 'coach'::public.app_role)) WITH CHECK (public.has_role(( SELECT auth.uid() AS uid), 'coach'::public.app_role));


--
-- Name: glossary Coach writes glossary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach writes glossary" ON public.glossary TO authenticated USING (public.has_role(auth.uid(), 'coach'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: intensity_codes Coach writes intensity_codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coach writes intensity_codes" ON public.intensity_codes TO authenticated USING (public.has_role(auth.uid(), 'coach'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: member_notification_prefs Coaches can view member notification prefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches can view member notification prefs" ON public.member_notification_prefs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: profiles Coaches view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'coach'::public.app_role));


--
-- Name: member_profiles Member inserts own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member inserts own" ON public.member_profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: personal_records Member manages own PRs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own PRs" ON public.personal_records USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: cololikes Member manages own cololikes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own cololikes" ON public.cololikes TO authenticated USING ((( SELECT auth.uid() AS uid) = liker_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = liker_id));


--
-- Name: exercise_feedbacks Member manages own feedbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own feedbacks" ON public.exercise_feedbacks USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = exercise_feedbacks.session_id) AND (s.member_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = exercise_feedbacks.session_id) AND (s.member_id = auth.uid())))));


--
-- Name: free_activities Member manages own free activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own free activities" ON public.free_activities USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = free_activities.session_id) AND (s.member_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = free_activities.session_id) AND (s.member_id = auth.uid())))));


--
-- Name: body_measurements Member manages own measurements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own measurements" ON public.body_measurements USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: pain_reports Member manages own pain reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own pain reports" ON public.pain_reports USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: challenge_participants Member manages own participation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own participation" ON public.challenge_participants TO authenticated USING ((( SELECT auth.uid() AS uid) = member_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = member_id));


--
-- Name: planned_sessions Member manages own planned sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own planned sessions" ON public.planned_sessions USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: progress_photos Member manages own progress photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own progress photos" ON public.progress_photos USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: run_stats Member manages own run stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own run stats" ON public.run_stats USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: session_media Member manages own session media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own session media" ON public.session_media USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: sessions Member manages own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own sessions" ON public.sessions USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: set_logs Member manages own set_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own set_logs" ON public.set_logs USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = set_logs.session_id) AND (s.member_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = set_logs.session_id) AND (s.member_id = auth.uid())))));


--
-- Name: technique_videos Member manages own videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own videos" ON public.technique_videos USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: weight_logs Member manages own weight; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member manages own weight" ON public.weight_logs USING ((auth.uid() = member_id)) WITH CHECK ((auth.uid() = member_id));


--
-- Name: exercise_comments Member posts on own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member posts on own sessions" ON public.exercise_comments FOR INSERT TO authenticated WITH CHECK (((author_id = auth.uid()) AND (((author_role = 'member'::text) AND (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = exercise_comments.session_id) AND (s.member_id = auth.uid()))))) OR ((author_role = 'coach'::text) AND public.has_role(auth.uid(), 'coach'::public.app_role)))));


--
-- Name: exercise_comments Member sees comments on own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member sees comments on own sessions" ON public.exercise_comments FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = exercise_comments.session_id) AND (s.member_id = auth.uid())))) OR public.has_role(auth.uid(), 'coach'::public.app_role)));


--
-- Name: member_profiles Member updates own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member updates own" ON public.member_profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: member_profiles Member views own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member views own" ON public.member_profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: assignments Member views own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member views own assignments" ON public.assignments FOR SELECT USING ((auth.uid() = member_id));


--
-- Name: weekly_logbooks Member views own logbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member views own logbooks" ON public.weekly_logbooks FOR SELECT USING ((auth.uid() = member_id));


--
-- Name: assignment_weeks Member views own published weeks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member views own published weeks" ON public.assignment_weeks FOR SELECT USING (((auth.uid() = member_id) AND (status = ANY (ARRAY['published'::text, 'in_progress'::text, 'done'::text]))));


--
-- Name: programs Members view assigned programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view assigned programs" ON public.programs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.assignments a
  WHERE ((a.program_id = programs.id) AND (a.member_id = auth.uid())))));


--
-- Name: user_roles No client deletes on user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client deletes on user_roles" ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);


--
-- Name: weekly_logbooks No client deletes on weekly_logbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client deletes on weekly_logbooks" ON public.weekly_logbooks AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);


--
-- Name: user_roles No client inserts on user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client inserts on user_roles" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);


--
-- Name: weekly_logbooks No client inserts on weekly_logbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client inserts on weekly_logbooks" ON public.weekly_logbooks AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);


--
-- Name: user_roles No client updates on user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client updates on user_roles" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: profiles Profiles viewable by self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles viewable by self" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: messages Recipient updates own message receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipient updates own message receipts" ON public.messages FOR UPDATE TO authenticated USING ((auth.uid() = to_id)) WITH CHECK ((auth.uid() = to_id));


--
-- Name: email_send_log Service role can insert send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: suppressed_emails Service role can insert suppressed emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can insert tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_send_state Service role can manage send state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage send state" ON public.email_send_state USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can mark tokens as used; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_send_log Service role can read send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read send log" ON public.email_send_log FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: suppressed_emails Service role can read suppressed emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can read tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: email_send_log Service role can update send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: member_notification_prefs User manages own notification prefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User manages own notification prefs" ON public.member_notification_prefs USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: messages Users send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (((auth.uid() = from_id) AND (public.has_role(auth.uid(), 'coach'::public.app_role) OR public.has_role(to_id, 'coach'::public.app_role))));


--
-- Name: profiles Users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: messages Users view own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own messages" ON public.messages FOR SELECT USING (((auth.uid() = from_id) OR (auth.uid() = to_id)));


--
-- Name: user_roles Users view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: assignment_weeks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignment_weeks ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: body_measurements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: cololikes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cololikes ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

--
-- Name: email_unsubscribe_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: exercise_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercise_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: exercise_feedbacks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercise_feedbacks ENABLE ROW LEVEL SECURITY;

--
-- Name: exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: free_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.free_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: glossary; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.glossary ENABLE ROW LEVEL SECURITY;

--
-- Name: intensity_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intensity_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: member_coach_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_coach_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: member_notification_prefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_notification_prefs ENABLE ROW LEVEL SECURITY;

--
-- Name: member_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: pain_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pain_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: personal_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

--
-- Name: planned_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planned_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

--
-- Name: progress_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: run_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.run_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: running_routes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.running_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: session_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_media ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: set_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: suppressed_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: technique_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technique_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_logbooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_logbooks ENABLE ROW LEVEL SECURITY;

--
-- Name: weight_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO sandbox_exec;


--
-- Name: FUNCTION can_subscribe_topic(_topic text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_subscribe_topic(_topic text) TO anon;
GRANT ALL ON FUNCTION public.can_subscribe_topic(_topic text) TO authenticated;
GRANT ALL ON FUNCTION public.can_subscribe_topic(_topic text) TO service_role;


--
-- Name: FUNCTION consume_invitation(_token text, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.consume_invitation(_token text, _user_id uuid) TO service_role;


--
-- Name: FUNCTION delete_email(queue_name text, message_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_email(queue_name text, message_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_email(queue_name text, message_id bigint) TO service_role;


--
-- Name: FUNCTION detect_personal_record(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.detect_personal_record() FROM PUBLIC;
GRANT ALL ON FUNCTION public.detect_personal_record() TO service_role;


--
-- Name: FUNCTION email_queue_dispatch(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC;
GRANT ALL ON FUNCTION public.email_queue_dispatch() TO anon;
GRANT ALL ON FUNCTION public.email_queue_dispatch() TO authenticated;
GRANT ALL ON FUNCTION public.email_queue_dispatch() TO service_role;


--
-- Name: FUNCTION email_queue_wake(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC;
GRANT ALL ON FUNCTION public.email_queue_wake() TO anon;
GRANT ALL ON FUNCTION public.email_queue_wake() TO authenticated;
GRANT ALL ON FUNCTION public.email_queue_wake() TO service_role;


--
-- Name: FUNCTION enqueue_email(queue_name text, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) TO service_role;


--
-- Name: FUNCTION get_user_role(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_role(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_role(_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- Name: FUNCTION messages_prevent_content_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.messages_prevent_content_change() TO anon;
GRANT ALL ON FUNCTION public.messages_prevent_content_change() TO authenticated;
GRANT ALL ON FUNCTION public.messages_prevent_content_change() TO service_role;


--
-- Name: FUNCTION move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) TO service_role;


--
-- Name: FUNCTION read_email_batch(queue_name text, batch_size integer, vt integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION validate_invitation(_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_invitation(_token text) TO anon;
GRANT ALL ON FUNCTION public.validate_invitation(_token text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_invitation(_token text) TO service_role;


--
-- Name: TABLE assignment_weeks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.assignment_weeks TO anon;
GRANT ALL ON TABLE public.assignment_weeks TO authenticated;
GRANT ALL ON TABLE public.assignment_weeks TO service_role;
GRANT SELECT,INSERT ON TABLE public.assignment_weeks TO sandbox_exec;


--
-- Name: TABLE assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.assignments TO anon;
GRANT ALL ON TABLE public.assignments TO authenticated;
GRANT ALL ON TABLE public.assignments TO service_role;
GRANT SELECT,INSERT ON TABLE public.assignments TO sandbox_exec;


--
-- Name: TABLE body_measurements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.body_measurements TO anon;
GRANT ALL ON TABLE public.body_measurements TO authenticated;
GRANT ALL ON TABLE public.body_measurements TO service_role;
GRANT SELECT,INSERT ON TABLE public.body_measurements TO sandbox_exec;


--
-- Name: TABLE challenge_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_participants TO anon;
GRANT ALL ON TABLE public.challenge_participants TO authenticated;
GRANT ALL ON TABLE public.challenge_participants TO service_role;
GRANT SELECT,INSERT ON TABLE public.challenge_participants TO sandbox_exec;


--
-- Name: TABLE challenges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenges TO anon;
GRANT ALL ON TABLE public.challenges TO authenticated;
GRANT ALL ON TABLE public.challenges TO service_role;
GRANT SELECT,INSERT ON TABLE public.challenges TO sandbox_exec;


--
-- Name: TABLE cololikes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cololikes TO anon;
GRANT ALL ON TABLE public.cololikes TO authenticated;
GRANT ALL ON TABLE public.cololikes TO service_role;
GRANT SELECT,INSERT ON TABLE public.cololikes TO sandbox_exec;


--
-- Name: TABLE email_send_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_send_log TO anon;
GRANT ALL ON TABLE public.email_send_log TO authenticated;
GRANT ALL ON TABLE public.email_send_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_send_log TO sandbox_exec;


--
-- Name: TABLE email_send_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_send_state TO anon;
GRANT ALL ON TABLE public.email_send_state TO authenticated;
GRANT ALL ON TABLE public.email_send_state TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_send_state TO sandbox_exec;


--
-- Name: TABLE email_unsubscribe_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_unsubscribe_tokens TO anon;
GRANT ALL ON TABLE public.email_unsubscribe_tokens TO authenticated;
GRANT ALL ON TABLE public.email_unsubscribe_tokens TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_unsubscribe_tokens TO sandbox_exec;


--
-- Name: TABLE exercise_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exercise_comments TO anon;
GRANT ALL ON TABLE public.exercise_comments TO authenticated;
GRANT ALL ON TABLE public.exercise_comments TO service_role;
GRANT SELECT,INSERT ON TABLE public.exercise_comments TO sandbox_exec;


--
-- Name: TABLE exercise_feedbacks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exercise_feedbacks TO anon;
GRANT ALL ON TABLE public.exercise_feedbacks TO authenticated;
GRANT ALL ON TABLE public.exercise_feedbacks TO service_role;
GRANT SELECT,INSERT ON TABLE public.exercise_feedbacks TO sandbox_exec;


--
-- Name: TABLE exercises; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exercises TO anon;
GRANT ALL ON TABLE public.exercises TO authenticated;
GRANT ALL ON TABLE public.exercises TO service_role;
GRANT SELECT,INSERT ON TABLE public.exercises TO sandbox_exec;


--
-- Name: TABLE free_activities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.free_activities TO anon;
GRANT ALL ON TABLE public.free_activities TO authenticated;
GRANT ALL ON TABLE public.free_activities TO service_role;
GRANT SELECT,INSERT ON TABLE public.free_activities TO sandbox_exec;


--
-- Name: TABLE glossary; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.glossary TO anon;
GRANT ALL ON TABLE public.glossary TO authenticated;
GRANT ALL ON TABLE public.glossary TO service_role;
GRANT SELECT,INSERT ON TABLE public.glossary TO sandbox_exec;


--
-- Name: TABLE intensity_codes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.intensity_codes TO anon;
GRANT ALL ON TABLE public.intensity_codes TO authenticated;
GRANT ALL ON TABLE public.intensity_codes TO service_role;
GRANT SELECT,INSERT ON TABLE public.intensity_codes TO sandbox_exec;


--
-- Name: TABLE invitations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invitations TO anon;
GRANT ALL ON TABLE public.invitations TO authenticated;
GRANT ALL ON TABLE public.invitations TO service_role;
GRANT SELECT,INSERT ON TABLE public.invitations TO sandbox_exec;


--
-- Name: TABLE member_coach_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.member_coach_notes TO anon;
GRANT ALL ON TABLE public.member_coach_notes TO authenticated;
GRANT ALL ON TABLE public.member_coach_notes TO service_role;
GRANT SELECT,INSERT ON TABLE public.member_coach_notes TO sandbox_exec;


--
-- Name: TABLE member_notification_prefs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.member_notification_prefs TO anon;
GRANT ALL ON TABLE public.member_notification_prefs TO authenticated;
GRANT ALL ON TABLE public.member_notification_prefs TO service_role;
GRANT SELECT,INSERT ON TABLE public.member_notification_prefs TO sandbox_exec;


--
-- Name: TABLE member_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.member_profiles TO anon;
GRANT ALL ON TABLE public.member_profiles TO authenticated;
GRANT ALL ON TABLE public.member_profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.member_profiles TO sandbox_exec;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.messages TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;
GRANT SELECT,INSERT ON TABLE public.messages TO sandbox_exec;


--
-- Name: COLUMN messages.pinned; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(pinned) ON TABLE public.messages TO authenticated;


--
-- Name: COLUMN messages.read; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(read) ON TABLE public.messages TO authenticated;


--
-- Name: TABLE pain_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pain_reports TO anon;
GRANT ALL ON TABLE public.pain_reports TO authenticated;
GRANT ALL ON TABLE public.pain_reports TO service_role;
GRANT SELECT,INSERT ON TABLE public.pain_reports TO sandbox_exec;


--
-- Name: TABLE personal_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.personal_records TO anon;
GRANT ALL ON TABLE public.personal_records TO authenticated;
GRANT ALL ON TABLE public.personal_records TO service_role;
GRANT SELECT,INSERT ON TABLE public.personal_records TO sandbox_exec;


--
-- Name: TABLE planned_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.planned_sessions TO anon;
GRANT ALL ON TABLE public.planned_sessions TO authenticated;
GRANT ALL ON TABLE public.planned_sessions TO service_role;
GRANT SELECT,INSERT ON TABLE public.planned_sessions TO sandbox_exec;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec;


--
-- Name: TABLE programs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.programs TO anon;
GRANT ALL ON TABLE public.programs TO authenticated;
GRANT ALL ON TABLE public.programs TO service_role;
GRANT SELECT,INSERT ON TABLE public.programs TO sandbox_exec;


--
-- Name: TABLE progress_photos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.progress_photos TO anon;
GRANT ALL ON TABLE public.progress_photos TO authenticated;
GRANT ALL ON TABLE public.progress_photos TO service_role;
GRANT SELECT,INSERT ON TABLE public.progress_photos TO sandbox_exec;


--
-- Name: TABLE run_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.run_stats TO anon;
GRANT ALL ON TABLE public.run_stats TO authenticated;
GRANT ALL ON TABLE public.run_stats TO service_role;
GRANT SELECT,INSERT ON TABLE public.run_stats TO sandbox_exec;


--
-- Name: TABLE running_routes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.running_routes TO anon;
GRANT ALL ON TABLE public.running_routes TO authenticated;
GRANT ALL ON TABLE public.running_routes TO service_role;
GRANT SELECT,INSERT ON TABLE public.running_routes TO sandbox_exec;


--
-- Name: TABLE session_media; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.session_media TO anon;
GRANT ALL ON TABLE public.session_media TO authenticated;
GRANT ALL ON TABLE public.session_media TO service_role;
GRANT SELECT,INSERT ON TABLE public.session_media TO sandbox_exec;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sessions TO anon;
GRANT ALL ON TABLE public.sessions TO authenticated;
GRANT ALL ON TABLE public.sessions TO service_role;
GRANT SELECT,INSERT ON TABLE public.sessions TO sandbox_exec;


--
-- Name: TABLE set_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.set_logs TO anon;
GRANT ALL ON TABLE public.set_logs TO authenticated;
GRANT ALL ON TABLE public.set_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.set_logs TO sandbox_exec;


--
-- Name: TABLE suppressed_emails; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.suppressed_emails TO anon;
GRANT ALL ON TABLE public.suppressed_emails TO authenticated;
GRANT ALL ON TABLE public.suppressed_emails TO service_role;
GRANT SELECT,INSERT ON TABLE public.suppressed_emails TO sandbox_exec;


--
-- Name: TABLE technique_videos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.technique_videos TO anon;
GRANT ALL ON TABLE public.technique_videos TO authenticated;
GRANT ALL ON TABLE public.technique_videos TO service_role;
GRANT SELECT,INSERT ON TABLE public.technique_videos TO sandbox_exec;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_roles TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;


--
-- Name: TABLE weekly_logbooks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.weekly_logbooks TO anon;
GRANT ALL ON TABLE public.weekly_logbooks TO authenticated;
GRANT ALL ON TABLE public.weekly_logbooks TO service_role;
GRANT SELECT,INSERT ON TABLE public.weekly_logbooks TO sandbox_exec;


--
-- Name: TABLE weight_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.weight_logs TO anon;
GRANT ALL ON TABLE public.weight_logs TO authenticated;
GRANT ALL ON TABLE public.weight_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.weight_logs TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict W57diQJKQLlrr3nbrIsiWcDXz05G7Lr1EruR8gt3duBcuf0gZan9pHgSmrFEGjS

