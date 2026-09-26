CREATE OR REPLACE FUNCTION public.create_my_tenant(_name text, _industry text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _slug text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF length(trim(coalesce(_name,''))) < 2 THEN RAISE EXCEPTION 'Business name is too short'; END IF;
  IF (SELECT count(*) FROM tenants WHERE owner_id = _uid) >= 10 THEN RAISE EXCEPTION 'Workspace limit reached'; END IF;
  _slug := trim(both '-' from regexp_replace(lower(left(_name, 40)), '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 5);
  INSERT INTO tenants(name, slug, plan, industry, owner_id, is_active)
  VALUES (left(trim(_name), 120), _slug, 'lite', left(_industry, 80), _uid, true) RETURNING id INTO _id;
  INSERT INTO tenant_members(tenant_id, user_id, member_role) VALUES (_id, _uid, 'owner') ON CONFLICT DO NOTHING;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_my_tenant(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_tenant(text, text) TO authenticated;