-- Update Pierre profile email
UPDATE public.profiles
SET email = 'pierre-0214@outlook.fr', updated_at = now()
WHERE id = '3c9a3987-903c-41dd-aa5e-1db0c9c46bba';

-- Update Pierre auth account
UPDATE auth.users
SET email = 'pierre-0214@outlook.fr',
    encrypted_password = crypt('Pierre2026!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now(),
    raw_user_meta_data = COALESCE(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('first_name','Pierre','last_name','W')
WHERE id = '3c9a3987-903c-41dd-aa5e-1db0c9c46bba';

-- Deactivate prior active assignments for Pierre
UPDATE public.assignments SET active = false
WHERE member_id = '3c9a3987-903c-41dd-aa5e-1db0c9c46bba' AND active = true;