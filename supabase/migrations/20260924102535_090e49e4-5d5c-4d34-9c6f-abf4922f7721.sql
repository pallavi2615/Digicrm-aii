ALTER TABLE public.edu_students ADD COLUMN IF NOT EXISTS applicant_email text, ADD COLUMN IF NOT EXISTS applicant_user_id uuid, ADD COLUMN IF NOT EXISTS doc_status text NOT NULL DEFAULT 'Pending', ADD COLUMN IF NOT EXISTS lead_score int;
ALTER TABLE public.edu_actions ADD COLUMN IF NOT EXISTS agent text, ADD COLUMN IF NOT EXISTS fee_id uuid;

CREATE TABLE public.edu_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.edu_students(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('aadhaar','pan','marksheet')),
  identifier_masked text, status text NOT NULL DEFAULT 'Submitted', provider text, result jsonb DEFAULT '{}'::jsonb, error text,
  verification_id uuid, submitted_by uuid, verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, doc_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edu_documents TO authenticated;
GRANT ALL ON public.edu_documents TO service_role;
ALTER TABLE public.edu_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY edu_documents_member ON public.edu_documents FOR ALL TO authenticated USING (private.rest_member(tenant_id)) WITH CHECK (private.rest_member(tenant_id));
CREATE POLICY edu_documents_applicant_read ON public.edu_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.edu_students s WHERE s.id = student_id AND s.applicant_user_id = auth.uid()));
CREATE POLICY edu_students_applicant_read ON public.edu_students FOR SELECT TO authenticated USING (applicant_user_id = auth.uid());
CREATE POLICY edu_fees_applicant_read ON public.edu_fees FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.edu_students s WHERE s.id = student_id AND s.applicant_user_id = auth.uid()));
CREATE POLICY edu_courses_applicant_read ON public.edu_courses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.edu_students s WHERE s.course_id = edu_courses.id AND s.applicant_user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.edu_applicant_claim() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text := lower(coalesce(auth.jwt() ->> 'email', '')); n int;
BEGIN
  IF auth.uid() IS NULL OR em = '' THEN RETURN 0; END IF;
  UPDATE public.edu_students SET applicant_user_id = auth.uid() WHERE lower(applicant_email) = em AND applicant_user_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.edu_applicant_claim() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.edu_applicant_claim() TO authenticated;

-- Document sync: all three verified → doc_status Verified and the student moves to Admission.
CREATE OR REPLACE FUNCTION private.edu_doc_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v int; f int; s public.edu_students;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'Verified'), count(*) FILTER (WHERE status = 'Failed') INTO v, f FROM public.edu_documents WHERE student_id = NEW.student_id;
  SELECT * INTO s FROM public.edu_students WHERE id = NEW.student_id;
  IF v >= 3 THEN
    UPDATE public.edu_students SET doc_status = 'Verified',
      stage = CASE WHEN stage IN ('New Lead','Contacted','Qualified','Counselling','Demo / Trial Class','Interested','Application','Fee Negotiation') THEN 'Admission' ELSE stage END
      WHERE id = NEW.student_id;
    INSERT INTO public.edu_actions (tenant_id, student_id, kind, audience, reason, agent, priority)
      VALUES (s.tenant_id, s.id, 'Admission confirmed', 'Parent', 'All documents verified — send welcome and batch details', 'Admission Agent', 1);
  ELSE
    UPDATE public.edu_students SET doc_status = CASE WHEN f > 0 THEN 'Action needed' ELSE 'In review' END WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER edu_documents_sync AFTER INSERT OR UPDATE OF status ON public.edu_documents FOR EACH ROW EXECUTE FUNCTION private.edu_doc_sync();

-- Admission Agent: score and qualify every new lead; Counsellor Agent: stage Qualified/Interested → book counselling.
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
    INSERT INTO public.edu_actions (tenant_id, student_id, kind, audience, reason, agent, priority)
      VALUES (NEW.tenant_id, NEW.id, CASE WHEN sc >= 60 THEN 'Book counselling' ELSE 'Qualify lead' END, 'Student',
        CASE WHEN sc >= 60 THEN 'Lead scored '||sc||' — qualified, book a counselling session' ELSE 'Lead scored '||sc||' — call to capture class, exam, budget and target year' END,
        CASE WHEN sc >= 60 THEN 'Counsellor Agent' ELSE 'Admission Agent' END, CASE WHEN sc >= 70 THEN 1 ELSE 2 END);
  ELSIF NEW.stage IS DISTINCT FROM OLD.stage AND NEW.stage IN ('Qualified','Interested') THEN
    IF NOT EXISTS (SELECT 1 FROM public.edu_actions WHERE student_id = NEW.id AND kind = 'Book counselling' AND status = 'Open') THEN
      INSERT INTO public.edu_actions (tenant_id, student_id, kind, audience, reason, agent, priority)
        VALUES (NEW.tenant_id, NEW.id, 'Book counselling', 'Student', 'Moved to '||NEW.stage||' — offer counselling slots today', 'Counsellor Agent', 1);
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER edu_students_agents AFTER INSERT OR UPDATE OF stage ON public.edu_students FOR EACH ROW EXECUTE FUNCTION private.edu_agents_student();

-- Fee Agent: reminders for fees due within 3 days or overdue.
CREATE OR REPLACE FUNCTION private.edu_fee_agent_all(_tenant uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.edu_actions (tenant_id, student_id, fee_id, kind, audience, reason, agent, priority)
  SELECT f.tenant_id, f.student_id, f.id, CASE WHEN f.due_date < current_date THEN 'Overdue fee' ELSE 'Fee reminder' END, 'Parent',
    f.label||': ₹'||(f.amount - f.paid_amount)||CASE WHEN f.due_date < current_date THEN ' overdue since ' ELSE ' due on ' END||to_char(f.due_date,'DD Mon'),
    'Fee Agent', CASE WHEN f.due_date < current_date THEN 1 ELSE 2 END
  FROM public.edu_fees f
  WHERE f.paid_amount < f.amount AND f.due_date <= current_date + 3 AND (_tenant IS NULL OR f.tenant_id = _tenant)
    AND NOT EXISTS (SELECT 1 FROM public.edu_actions a WHERE a.fee_id = f.id AND a.status = 'Open');
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.edu_run_fee_agent(_tenant uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.rest_member(_tenant) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN private.edu_fee_agent_all(_tenant);
END $$;
REVOKE ALL ON FUNCTION public.edu_run_fee_agent(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.edu_run_fee_agent(uuid) TO authenticated;
SELECT cron.schedule('edu-fee-agent-daily', '30 3 * * *', $$SELECT private.edu_fee_agent_all(NULL)$$);