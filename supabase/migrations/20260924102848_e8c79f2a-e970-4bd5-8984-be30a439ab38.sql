CREATE OR REPLACE FUNCTION private.edu_agents_student() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sc int := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    sc := (CASE WHEN NEW.phone IS NOT NULL THEN 20 ELSE 0 END) + (CASE WHEN NEW.exam IS NOT NULL THEN 20 ELSE 0 END)
        + (CASE WHEN NEW.class_level IS NOT NULL THEN 10 ELSE 0 END) + (CASE WHEN NEW.budget IS NOT NULL THEN 15 ELSE 0 END)
        + (CASE WHEN NEW.target_year IS NOT NULL AND NEW.target_year <= extract(year FROM now())::int + 1 THEN 15 ELSE 0 END)
        + (CASE WHEN NEW.source IN ('Referral','Walk-in','Counselling camp') THEN 20 WHEN NEW.source IS NOT NULL THEN 10 ELSE 0 END);
    UPDATE public.edu_students SET lead_score = sc,
      temperature = CASE WHEN sc >= 70 THEN 'Hot' WHEN sc >= 40 THEN 'Warm' ELSE 'Cold' END,
      stage = CASE WHEN sc >= 60 AND stage = 'New Lead' THEN 'Qualified' ELSE stage END
      WHERE id = NEW.id;
    IF sc < 60 THEN
      INSERT INTO public.edu_actions (tenant_id, student_id, kind, audience, reason, agent, priority)
        VALUES (NEW.tenant_id, NEW.id, 'Qualify lead', 'Student', 'Lead scored '||sc||' — call to capture class, exam, budget and target year', 'Admission Agent', 2);
    ELSIF NOT EXISTS (SELECT 1 FROM public.edu_actions WHERE student_id = NEW.id AND kind = 'Book counselling' AND status = 'Open') THEN
      INSERT INTO public.edu_actions (tenant_id, student_id, kind, audience, reason, agent, priority)
        VALUES (NEW.tenant_id, NEW.id, 'Book counselling', 'Student', 'Lead scored '||sc||' — qualified by Admission Agent, book a counselling session', 'Counsellor Agent', 1);
    END IF;
  ELSIF NEW.stage IS DISTINCT FROM OLD.stage AND NEW.stage IN ('Qualified','Interested') THEN
    IF NOT EXISTS (SELECT 1 FROM public.edu_actions WHERE student_id = NEW.id AND kind = 'Book counselling' AND status = 'Open') THEN
      INSERT INTO public.edu_actions (tenant_id, student_id, kind, audience, reason, agent, priority)
        VALUES (NEW.tenant_id, NEW.id, 'Book counselling', 'Student', 'Scored '||coalesce(NEW.lead_score::text,'—')||', moved to '||NEW.stage||' — offer counselling slots today', 'Counsellor Agent', 1);
    END IF;
  END IF;
  RETURN NULL;
END $$;