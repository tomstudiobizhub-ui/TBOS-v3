-- TBOS Tech in Schools (TIS) workspace schema
-- REVIEW DRAFT ONLY. Do not run in production until reviewed against the live helper functions.
-- Preserves all existing TBOS profile IDs. Facilitators are linked by existing public.users.id.
-- Requires existing helpers: public.tbos_my_profile_id() and public.tbos_my_role().
BEGIN;

CREATE OR REPLACE FUNCTION public.tbos_tis_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $
  SELECT lower(coalesce(public.tbos_my_role(), '')) = 'administrator';
$$;

REVOKE ALL ON FUNCTION public.tbos_tis_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tbos_tis_is_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.tis_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  contact_person text,
  contact_phone text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On Hold','Closed')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tis_school_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.tis_schools(id) ON DELETE RESTRICT,
  facilitator_profile_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  facilitator_name text NOT NULL,
  facilitator_email text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, facilitator_profile_id)
);

CREATE OR REPLACE FUNCTION public.tbos_tis_can_access_school(target_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $
  SELECT public.tbos_tis_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.tis_school_assignments a
        WHERE a.school_id = target_school_id
          AND a.facilitator_profile_id = public.tbos_my_profile_id()
          AND a.active = true
      );
$;
REVOKE ALL ON FUNCTION public.tbos_tis_can_access_school(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tbos_tis_can_access_school(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.tis_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.tis_schools(id) ON DELETE RESTRICT,
  name text NOT NULL,
  academic_year text NOT NULL,
  term text NOT NULL CHECK (term IN ('First','Second','Third')),
  UNIQUE (id, school_id),
  student_count integer NOT NULL DEFAULT 0 CHECK (student_count >= 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tis_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.tis_schools(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL,
  student_name text NOT NULL,
  student_code text,
  parent_contact text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Transferred')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tis_students_class_school_fk FOREIGN KEY (class_id, school_id) REFERENCES public.tis_classes(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tis_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.tis_schools(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL,
  facilitator_profile_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  visit_date date NOT NULL,
  students_present integer NOT NULL CHECK (students_present >= 0),
  students_total integer NOT NULL CHECK (students_total >= 0),
  notes text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (students_present <= students_total),
  CONSTRAINT tis_attendance_class_school_fk FOREIGN KEY (class_id, school_id) REFERENCES public.tis_classes(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tis_school_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.tis_schools(id) ON DELETE RESTRICT,
  visit_date date NOT NULL,
  payment_type text NOT NULL DEFAULT 'Onsite' CHECK (payment_type IN ('Onsite','Termly')),
  academic_term text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('Cash','Transfer','POS')),
  reference text,
  approval_status text NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Pending','Approved','Rejected')),
  recorded_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tis_facilitator_remittances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.tis_schools(id) ON DELETE RESTRICT,
  facilitator_profile_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('Cash','Transfer','POS')),
  reference text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Verified','Rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  evidence_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tis_visit_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.tis_schools(id) ON DELETE RESTRICT,
  facilitator_profile_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  visit_date date NOT NULL,
  receipt_number text NOT NULL UNIQUE,
  student_count integer NOT NULL DEFAULT 0 CHECK (student_count >= 0),
  commission_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  remarks text,
  facilitator_signature text NOT NULL,
  school_rep_signature text NOT NULL,
  evidence_path text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tis_commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.tis_schools(id) ON DELETE RESTRICT,
  facilitator_profile_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  source_payment_id uuid REFERENCES public.tis_school_payments(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  basis_note text NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Paid','Rejected')),
  created_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tis_commission_facilitator_idx ON public.tis_commission_entries(facilitator_profile_id, created_at);
CREATE INDEX IF NOT EXISTS tis_assignments_facilitator_idx ON public.tis_school_assignments(facilitator_profile_id, active);
CREATE INDEX IF NOT EXISTS tis_students_school_class_idx ON public.tis_students(school_id, class_id, status);
CREATE INDEX IF NOT EXISTS tis_classes_school_idx ON public.tis_classes(school_id);
CREATE INDEX IF NOT EXISTS tis_attendance_school_date_idx ON public.tis_attendance_sessions(school_id, visit_date);
CREATE INDEX IF NOT EXISTS tis_payments_school_date_idx ON public.tis_school_payments(school_id, visit_date);
CREATE INDEX IF NOT EXISTS tis_remittances_facilitator_date_idx ON public.tis_facilitator_remittances(facilitator_profile_id, submitted_at);
CREATE INDEX IF NOT EXISTS tis_receipts_school_date_idx ON public.tis_visit_receipts(school_id, visit_date);

ALTER TABLE public.tis_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tis_school_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tis_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tis_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tis_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tis_school_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tis_facilitator_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tis_visit_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tis_commission_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tis_schools, public.tis_school_assignments, public.tis_classes, public.tis_students,
 public.tis_attendance_sessions, public.tis_school_payments,
 public.tis_facilitator_remittances, public.tis_visit_receipts, public.tis_commission_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tis_schools, public.tis_school_assignments, public.tis_classes, public.tis_students,
 public.tis_attendance_sessions, public.tis_school_payments,
 public.tis_facilitator_remittances, public.tis_visit_receipts, public.tis_commission_entries TO authenticated;
GRANT INSERT, UPDATE ON public.tis_schools, public.tis_school_assignments,
 public.tis_classes, public.tis_students TO authenticated;
GRANT INSERT ON public.tis_attendance_sessions, public.tis_school_payments,
 public.tis_facilitator_remittances, public.tis_visit_receipts TO authenticated;
GRANT UPDATE (approval_status, reviewed_by, reviewed_at) ON public.tis_school_payments TO authenticated;
GRANT UPDATE (status, reviewed_by, reviewed_at) ON public.tis_facilitator_remittances TO authenticated;
GRANT UPDATE (evidence_path) ON public.tis_facilitator_remittances, public.tis_visit_receipts TO authenticated;
GRANT INSERT, UPDATE (status, reviewed_by, reviewed_at) ON public.tis_commission_entries TO authenticated;

CREATE POLICY tis_schools_read_scope ON public.tis_schools
 FOR SELECT TO authenticated USING (public.tbos_tis_can_access_school(id));
CREATE POLICY tis_schools_admin_manage ON public.tis_schools
 FOR ALL TO authenticated USING (public.tbos_tis_is_admin()) WITH CHECK (public.tbos_tis_is_admin());

CREATE POLICY tis_assignments_read_scope ON public.tis_school_assignments
 FOR SELECT TO authenticated USING (
   public.tbos_tis_is_admin() OR facilitator_profile_id = public.tbos_my_profile_id()
 );
CREATE POLICY tis_assignments_admin_manage ON public.tis_school_assignments
 FOR ALL TO authenticated USING (public.tbos_tis_is_admin()) WITH CHECK (public.tbos_tis_is_admin());

CREATE POLICY tis_classes_read_scope ON public.tis_classes
 FOR SELECT TO authenticated USING (public.tbos_tis_can_access_school(school_id));
CREATE POLICY tis_classes_admin_manage ON public.tis_classes
 FOR ALL TO authenticated USING (public.tbos_tis_is_admin()) WITH CHECK (public.tbos_tis_is_admin());

CREATE POLICY tis_students_read_scope ON public.tis_students
 FOR SELECT TO authenticated USING (public.tbos_tis_can_access_school(school_id));
CREATE POLICY tis_students_admin_manage ON public.tis_students
 FOR ALL TO authenticated USING (public.tbos_tis_is_admin()) WITH CHECK (public.tbos_tis_is_admin());

CREATE POLICY tis_attendance_read_scope ON public.tis_attendance_sessions
 FOR SELECT TO authenticated USING (public.tbos_tis_can_access_school(school_id));
CREATE POLICY tis_attendance_insert_scope ON public.tis_attendance_sessions
 FOR INSERT TO authenticated WITH CHECK (
   facilitator_profile_id = public.tbos_my_profile_id()
   AND recorded_by = public.tbos_my_profile_id()
   AND public.tbos_tis_can_access_school(school_id)
 );

CREATE POLICY tis_payments_read_scope ON public.tis_school_payments
 FOR SELECT TO authenticated USING (
   public.tbos_tis_is_admin()
   OR (recorded_by = public.tbos_my_profile_id() AND public.tbos_tis_can_access_school(school_id))
 );
CREATE POLICY tis_payments_insert_scope ON public.tis_school_payments
 FOR INSERT TO authenticated WITH CHECK (
   recorded_by = public.tbos_my_profile_id()
   AND public.tbos_tis_can_access_school(school_id)
 );
CREATE POLICY tis_payments_admin_review ON public.tis_school_payments
 FOR UPDATE TO authenticated USING (public.tbos_tis_is_admin()) WITH CHECK (public.tbos_tis_is_admin());

CREATE POLICY tis_remittances_read_scope ON public.tis_facilitator_remittances
 FOR SELECT TO authenticated USING (
   public.tbos_tis_is_admin()
   OR (facilitator_profile_id = public.tbos_my_profile_id() AND public.tbos_tis_can_access_school(school_id))
 );
CREATE POLICY tis_remittances_insert_scope ON public.tis_facilitator_remittances
 FOR INSERT TO authenticated WITH CHECK (
   facilitator_profile_id = public.tbos_my_profile_id()
   AND public.tbos_tis_can_access_school(school_id)
 );
CREATE POLICY tis_remittances_admin_review ON public.tis_facilitator_remittances
 FOR UPDATE TO authenticated USING (public.tbos_tis_is_admin()) WITH CHECK (public.tbos_tis_is_admin());
CREATE POLICY tis_remittances_attach_own_evidence ON public.tis_facilitator_remittances
 FOR UPDATE TO authenticated USING (facilitator_profile_id = public.tbos_my_profile_id() AND status = 'Pending')
 WITH CHECK (facilitator_profile_id = public.tbos_my_profile_id() AND status = 'Pending');

CREATE POLICY tis_commissions_read_scope ON public.tis_commission_entries
 FOR SELECT TO authenticated USING (
   public.tbos_tis_is_admin()
   OR (facilitator_profile_id = public.tbos_my_profile_id() AND public.tbos_tis_can_access_school(school_id))
 );
CREATE POLICY tis_commissions_admin_manage ON public.tis_commission_entries
 FOR ALL TO authenticated USING (public.tbos_tis_is_admin()) WITH CHECK (public.tbos_tis_is_admin());

CREATE POLICY tis_receipts_read_scope ON public.tis_visit_receipts
 FOR SELECT TO authenticated USING (public.tbos_tis_can_access_school(school_id));
CREATE POLICY tis_receipts_insert_scope ON public.tis_visit_receipts
 FOR INSERT TO authenticated WITH CHECK (
   facilitator_profile_id = public.tbos_my_profile_id()
   AND recorded_by = public.tbos_my_profile_id()
   AND public.tbos_tis_can_access_school(school_id)
 );
CREATE POLICY tis_receipts_attach_own_evidence ON public.tis_visit_receipts
 FOR UPDATE TO authenticated USING (facilitator_profile_id = public.tbos_my_profile_id() AND recorded_by = public.tbos_my_profile_id())
 WITH CHECK (facilitator_profile_id = public.tbos_my_profile_id() AND recorded_by = public.tbos_my_profile_id());

-- Private receipt bucket. Uploads are scoped to the authenticated profile's folder.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tis-receipts','tis-receipts',false,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS tis_receipts_storage_read ON storage.objects;
CREATE POLICY tis_receipts_storage_read ON storage.objects
 FOR SELECT TO authenticated USING (
   bucket_id = 'tis-receipts'
   AND (
     public.tbos_tis_is_admin()
     OR EXISTS (
       SELECT 1 FROM public.tis_school_assignments a
       WHERE a.facilitator_profile_id = public.tbos_my_profile_id()
         AND a.active = true
         AND (storage.foldername(name))[1] = a.facilitator_profile_id::text
     )
   )
 );
DROP POLICY IF EXISTS tis_receipts_storage_insert ON storage.objects;
CREATE POLICY tis_receipts_storage_insert ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
   bucket_id = 'tis-receipts'
   AND (storage.foldername(name))[1] = public.tbos_my_profile_id()::text
 );

COMMIT;

-- Follow-up required before production:
-- 1) Confirm tbos_my_profile_id() returns the existing public.users.id and tbos_my_role() is current.
-- 2) Verify storage schema permissions and ensure existing storage policies do not conflict.
-- 3) Add admin review UI for payment/remittance approvals and commission-rate configuration.
-- 4) Commission amounts are entered explicitly with a basis note; no commission rate is assumed or fabricated.
-- 5) Test with an administrator and two facilitators assigned to different schools; verify cross-school denial.
-- 6) Run the TIS frontend only after this migration has been reviewed and applied.
