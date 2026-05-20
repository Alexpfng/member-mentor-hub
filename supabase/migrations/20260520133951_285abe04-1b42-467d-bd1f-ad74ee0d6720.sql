
-- Demo Coach
DO $$
DECLARE
  coach_uid uuid := gen_random_uuid();
  member_uid uuid := gen_random_uuid();
BEGIN
  -- Coach
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', coach_uid, 'authenticated', 'authenticated',
    'coach.demo@colosmart.test', crypt('DemoCoach2026!', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Léo","last_name":"Demo"}'::jsonb,
    now(), now(), '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), coach_uid,
    jsonb_build_object('sub', coach_uid::text, 'email', 'coach.demo@colosmart.test', 'email_verified', true),
    'email', coach_uid::text, now(), now(), now());

  -- Member
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', member_uid, 'authenticated', 'authenticated',
    'membre.demo@colosmart.test', crypt('DemoMembre2026!', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Alex","last_name":"Demo"}'::jsonb,
    now(), now(), '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), member_uid,
    jsonb_build_object('sub', member_uid::text, 'email', 'membre.demo@colosmart.test', 'email_verified', true),
    'email', member_uid::text, now(), now(), now());

  -- Upgrade coach role (trigger handle_new_user already inserted 'member')
  UPDATE public.user_roles SET role = 'coach' WHERE user_id = coach_uid;

  -- Seed member profile
  INSERT INTO public.member_profiles (user_id, weight_kg, height_cm, level, goal)
  VALUES (member_uid, 75, 178, 'intermediate', 'hypertrophy')
  ON CONFLICT DO NOTHING;
END $$;
