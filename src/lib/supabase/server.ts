import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"

type SupabaseCookieOptions = {
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "lax" | "strict" | "none" | boolean
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: SupabaseCookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: SupabaseCookieOptions) {
          cookieStore.set({ name, value: "", ...options })
        },
      },
    }
  )
}