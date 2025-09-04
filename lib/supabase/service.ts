import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Service role client for bypassing RLS in server-side operations
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}