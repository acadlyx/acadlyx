-- Security hardening: prevent mutable search_path resolution in trigger functions.
-- All referenced objects in these functions live in the public schema.
ALTER FUNCTION public.update_fee_heads_updated_at() SET search_path = public;
ALTER FUNCTION public.update_fee_structures_updated_at() SET search_path = public;
ALTER FUNCTION public.update_fee_structure_items_updated_at() SET search_path = public;
ALTER FUNCTION public.acadlyx_set_updated_at() SET search_path = public;
ALTER FUNCTION public.acadlyx_sync_exam_schedule_legacy() SET search_path = public;
ALTER FUNCTION public.acadlyx_sync_exam_schedule_to_legacy() SET search_path = public;
