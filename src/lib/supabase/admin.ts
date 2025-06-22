import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client with admin privileges using the service role key
 * This should only be used in server-side contexts (e.g. API routes) where
 * privileged actions are required.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL or service role key is missing')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
} 