REVOKE EXECUTE ON FUNCTION public.creator_my_team_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.creator_claim_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creator_my_team_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_claim_invites() TO authenticated;
CREATE POLICY creator_instagram_none ON public.creator_instagram FOR SELECT TO authenticated USING (false);