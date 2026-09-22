/* Moved to supabase/functions/lead-prospector/lib.mjs, which the lead-prospector
   edge function deploys unmodified. This re-export keeps every script that
   imports it from here working, and means the script and the function can
   never run different copies. */
export * from '../../supabase/functions/lead-prospector/lib.mjs'
