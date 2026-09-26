CREATE TABLE public.edu_branches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, name text NOT NULL, city text, monthly_target numeric DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.edu_courses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, name text NOT NULL, exam text, duration_months int DEFAULT 12, fee numeric NOT NULL DEFAULT 0, mode text DEFAULT 'Offline', description text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.edu_batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, course_id uuid REFERENCES public.edu_courses(id) ON DELETE CASCADE, branch_id uuid REFERENCES public.edu_branches(id) ON DELETE SET NULL, name text NOT NULL, faculty text, room text, timing text, capacity int DEFAULT 40, start_date date, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.edu_students (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, name text NOT NULL, phone text, email text, city text, class_level text, school text, board text, exam text, target_year int, current_score numeric, source text, stage text NOT NULL DEFAULT 'New Lead', temperature text DEFAULT 'Warm', counsellor text, branch_id uuid REFERENCES public.edu_branches(id) ON DELETE SET NULL, course_id uuid REFERENCES public.edu_courses(id) ON DELETE SET NULL, batch_id uuid REFERENCES public.edu_batches(id) ON DELETE SET NULL, parent_name text, parent_relation text, parent_phone text, parent_occupation text, fee_total numeric DEFAULT 0, discount numeric DEFAULT 0, scholarship numeric DEFAULT 0, budget numeric, notes text, lost_reason text, admitted_at timestamptz, last_contacted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.edu_demos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, student_id uuid NOT NULL REFERENCES public.edu_students(id) ON DELETE CASCADE, batch_id uuid REFERENCES public.edu_batches(id) ON DELETE SET NULL, scheduled_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'Scheduled', feedback text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.edu_fees (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, student_id uuid NOT NULL REFERENCES public.edu_students(id) ON DELETE CASCADE, label text NOT NULL DEFAULT 'Instalment', amount numeric NOT NULL, due_date date NOT NULL, paid_amount numeric NOT NULL DEFAULT 0, paid_at timestamptz, method text, status text NOT NULL DEFAULT 'Due', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.edu_attendance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, student_id uuid NOT NULL REFERENCES public.edu_students(id) ON DELETE CASCADE, batch_id uuid REFERENCES public.edu_batches(id) ON DELETE SET NULL, day date NOT NULL DEFAULT current_date, present boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (student_id, day));
CREATE TABLE public.edu_tests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, student_id uuid NOT NULL REFERENCES public.edu_students(id) ON DELETE CASCADE, test_name text NOT NULL, subject text, test_date date NOT NULL DEFAULT current_date, marks numeric NOT NULL, max_marks numeric NOT NULL DEFAULT 100, rank int, remarks text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.edu_actions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, student_id uuid REFERENCES public.edu_students(id) ON DELETE CASCADE, kind text NOT NULL, audience text NOT NULL DEFAULT 'Student', reason text, message text, priority int NOT NULL DEFAULT 2, status text NOT NULL DEFAULT 'Open', created_at timestamptz NOT NULL DEFAULT now());

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['edu_branches','edu_courses','edu_batches','edu_students','edu_demos','edu_fees','edu_attendance','edu_tests','edu_actions'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.rest_member(tenant_id)) WITH CHECK (private.rest_member(tenant_id))', t||'_member', t);
    EXECUTE format('CREATE INDEX ON public.%I (tenant_id)', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.edu_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now();
  IF NEW.stage IN ('Admission','Batch Allocation','Active Student') AND NEW.admitted_at IS NULL THEN NEW.admitted_at := now(); END IF;
  RETURN NEW; END $$;
CREATE TRIGGER edu_students_touch BEFORE INSERT OR UPDATE ON public.edu_students FOR EACH ROW EXECUTE FUNCTION public.edu_touch();

CREATE OR REPLACE FUNCTION public.edu_fee_status() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.paid_amount >= NEW.amount THEN NEW.status := 'Paid'; NEW.paid_at := coalesce(NEW.paid_at, now());
  ELSIF NEW.paid_amount > 0 THEN NEW.status := 'Partial';
  ELSIF NEW.status <> 'Waived' THEN NEW.status := 'Due'; END IF;
  RETURN NEW; END $$;
CREATE TRIGGER edu_fees_status BEFORE INSERT OR UPDATE ON public.edu_fees FOR EACH ROW EXECUTE FUNCTION public.edu_fee_status();