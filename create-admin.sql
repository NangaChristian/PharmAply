-- Run this in the Supabase SQL Editor to create and verify the admin user
-- This bypasses the email confirmation requirement for the admin account.

DO $$
DECLARE
    admin_email TEXT := 'admin@pharmaply.com';
    admin_password TEXT := 'AdminPassword123!'; -- Update this to your preferred password if you want
    admin_uid UUID;
    existing_id UUID;
BEGIN
    SELECT id INTO existing_id FROM auth.users WHERE email = admin_email;

    IF existing_id IS NOT NULL THEN
        -- User exists: confirm their email and update password
        UPDATE auth.users 
        SET email_confirmed_at = NOW(),
            encrypted_password = crypt(admin_password, gen_salt('bf'))
        WHERE id = existing_id;
        
        admin_uid := existing_id;
    ELSE
        -- User does not exist: create them
        admin_uid := gen_random_uuid();
        
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, 
            email_confirmed_at, created_at, updated_at, 
            raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user
        ) VALUES (
            admin_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
            admin_email, crypt(admin_password, gen_salt('bf')), 
            NOW(), NOW(), NOW(), 
            '{"provider": "email", "providers": ["email"]}', '{}', FALSE, FALSE
        );
    END IF;

    -- Make sure they are recognized as an admin in our public.users table
    INSERT INTO public.users (id, data) 
    VALUES (admin_uid::text, jsonb_build_object('email', admin_email, 'role', 'admin', 'status', 'approved'))
    ON CONFLICT (id) DO UPDATE 
    SET data = jsonb_build_object('email', admin_email, 'role', 'admin', 'status', 'approved');
    
END $$;
