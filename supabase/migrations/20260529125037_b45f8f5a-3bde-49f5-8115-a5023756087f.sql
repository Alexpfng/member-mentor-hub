
-- Seed beta accounts: Léo (coach) and Teddy (member)
DO $$
DECLARE
  v_leo_id uuid;
  v_teddy_id uuid;
BEGIN
  -- Léo
  SELECT id INTO v_leo_id FROM auth.users WHERE email = 'leocolognesi@gmail.com';
  IF v_leo_id IS NULL THEN
    v_leo_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_leo_id, 'authenticated', 'authenticated',
      'leocolognesi@gmail.com', crypt('ColoSmart2024!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Léo","last_name":"Colognesi"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_leo_id,
      jsonb_build_object('sub', v_leo_id::text, 'email', 'leocolognesi@gmail.com', 'email_verified', true),
      'email', v_leo_id::text, now(), now(), now());
  END IF;
  -- Ensure profile + coach role
  INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (v_leo_id, 'leocolognesi@gmail.com', 'Léo', 'Colognesi')
    ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email;
  DELETE FROM public.user_roles WHERE user_id = v_leo_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_leo_id, 'coach');

  -- Teddy
  SELECT id INTO v_teddy_id FROM auth.users WHERE email = 'morin.td@gmail.com';
  IF v_teddy_id IS NULL THEN
    v_teddy_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_teddy_id, 'authenticated', 'authenticated',
      'morin.td@gmail.com', crypt('TeddyBeta2024!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Teddy","last_name":"Morin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_teddy_id,
      jsonb_build_object('sub', v_teddy_id::text, 'email', 'morin.td@gmail.com', 'email_verified', true),
      'email', v_teddy_id::text, now(), now(), now());
  END IF;
  INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (v_teddy_id, 'morin.td@gmail.com', 'Teddy', 'Morin')
    ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email;
  -- Ensure member role exists, no coach role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_teddy_id AND role = 'member') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_teddy_id, 'member');
  END IF;
END $$;
