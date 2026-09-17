ALTER TABLE public.therapist_private_info ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.therapist_private_info pi
SET notes = t.notes
FROM public.therapists t
WHERE t.id = pi.therapist_id AND t.notes IS NOT NULL AND pi.notes IS NULL;

INSERT INTO public.therapist_private_info (therapist_id, notes)
SELECT t.id, t.notes
FROM public.therapists t
WHERE t.notes IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.therapist_private_info pi WHERE pi.therapist_id = t.id);

ALTER TABLE public.therapists DROP COLUMN IF EXISTS notes;