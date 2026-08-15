DROP POLICY IF EXISTS "p_cat_read" ON public.produits_patients;
CREATE POLICY "p_cat_read" ON public.produits_patients FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "p_cat_write" ON public.produits_patients;
CREATE POLICY "p_cat_write" ON public.produits_patients FOR ALL TO authenticated USING (COALESCE(auth.jwt() ->> 'role', '') = 'platform_admin') WITH CHECK (COALESCE(auth.jwt() ->> 'role', '') = 'platform_admin');

DROP POLICY IF EXISTS "p_prod_manage" ON public.products;
CREATE POLICY "p_prod_manage" ON public.products FOR ALL TO authenticated USING (pharmacy_id = auth.uid()::text OR COALESCE(auth.jwt() ->> 'role', '') IN ('pharmacist', 'pharmacy', 'platform_admin')) WITH CHECK (pharmacy_id = auth.uid()::text OR COALESCE(auth.jwt() ->> 'role', '') = 'platform_admin');

DROP POLICY IF EXISTS "p_prod_read" ON public.products;
CREATE POLICY "p_prod_read" ON public.products FOR SELECT TO authenticated, anon USING (COALESCE(stock, 0) > 0 OR pharmacy_id = auth.uid()::text OR COALESCE(auth.jwt() ->> 'role', '') = 'platform_admin');

DROP POLICY IF EXISTS "p_ord_iso" ON public.orders;
CREATE POLICY "p_ord_iso" ON public.orders FOR ALL TO authenticated USING (patient_id = auth.uid()::text OR pharmacy_id = auth.uid()::text OR driver_id = auth.uid()::text OR COALESCE(auth.jwt() ->> 'role', '') = 'platform_admin') WITH CHECK (patient_id = auth.uid()::text OR pharmacy_id = auth.uid()::text OR driver_id = auth.uid()::text OR COALESCE(auth.jwt() ->> 'role', '') = 'platform_admin');

DROP POLICY IF EXISTS "p_tx_iso" ON public.transactions;
CREATE POLICY "p_tx_iso" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid()::text OR COALESCE(auth.jwt() ->> 'role', '') = 'platform_admin');

DROP POLICY IF EXISTS "p_wal_read" ON public.wallets;
CREATE POLICY "p_wal_read" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid()::text OR COALESCE(auth.jwt() ->> 'role', '') = 'platform_admin');
