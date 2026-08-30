import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  is_admin: boolean
  created_at: string
}

export async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_admin, created_at')
    .eq('id', user.id)
    .single()

  return (data as Profile) ?? null
}
