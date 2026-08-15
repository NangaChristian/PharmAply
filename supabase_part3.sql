CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
    p_user_id TEXT,
    p_amount NUMERIC,
    p_transaction_type TEXT,
    p_reference_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    IF COALESCE(auth.jwt() ->> 'role', '') NOT IN ('service_role', 'platform_admin') AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (p_user_id, p_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.wallets.balance + p_amount, updated_at = NOW()
    RETURNING balance INTO v_new_balance;
    INSERT INTO public.transactions (user_id, amount, type, reference_id, created_at)
    VALUES (p_user_id, p_amount, p_transaction_type, p_reference_id, NOW());
    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', false) ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Upload ordonnance patient" ON storage.objects;
CREATE POLICY "Upload ordonnance patient" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Lecture ordonnance autorisee" ON storage.objects;
CREATE POLICY "Lecture ordonnance autorisee" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'prescriptions' AND ((storage.foldername(name))[1] = auth.uid()::text OR COALESCE(auth.jwt() ->> 'role', '') IN ('pharmacist', 'pharmacy', 'platform_admin')));
