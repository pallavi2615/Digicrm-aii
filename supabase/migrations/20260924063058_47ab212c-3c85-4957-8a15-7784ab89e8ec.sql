CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  is_first BOOLEAN;
  v_tenant UUID;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url');

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'super_admin'::app_role ELSE 'sales_executive'::app_role END);

  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  IF v_tenant IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, member_role)
    VALUES (v_tenant, NEW.id, 'agent') ON CONFLICT DO NOTHING;
  END IF;

  -- Creator signups are locked to the Creator CRM from the first moment.
  IF NEW.raw_user_meta_data->>'signup_industry' = 'creator-economy' AND NOT is_first THEN
    INSERT INTO public.user_industry_access (user_id, industry_group)
    VALUES (NEW.id, 'creator-economy') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS manager_name text;
ALTER TABLE public.creator_invoices ADD COLUMN IF NOT EXISTS notes text;