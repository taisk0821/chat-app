import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[chat] Supabase env vars が未設定です。' +
    'VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を .env または Vercel の環境変数に設定してください。'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
