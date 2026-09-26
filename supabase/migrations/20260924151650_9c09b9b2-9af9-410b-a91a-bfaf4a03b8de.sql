DROP TRIGGER edu_documents_sync ON public.edu_documents;
CREATE TRIGGER edu_documents_sync AFTER INSERT OR UPDATE OF status ON public.edu_documents FOR EACH ROW EXECUTE FUNCTION public.edu_doc_sync();
DROP FUNCTION IF EXISTS private.edu_doc_sync();
-- Re-sync students whose documents are already all verified
UPDATE public.edu_documents d SET status = status WHERE lower(status)='verified'
  AND d.student_id IN (SELECT student_id FROM public.edu_documents GROUP BY student_id HAVING count(*) FILTER (WHERE lower(status)='verified') >= 3);