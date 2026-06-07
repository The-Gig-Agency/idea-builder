-- gen_random_bytes lives in the extensions schema in Supabase; the function's
-- search_path was locked to 'public' so it couldn't resolve. Replace with
-- gen_random_uuid() (available in pgcrypto, also exposed in public via
-- pg_catalog) using a hex-encoded form for the share token.
CREATE OR REPLACE FUNCTION public.sessions_assign_share_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.share_token IS NULL THEN
    NEW.share_token := encode(extensions.gen_random_bytes(12), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;
