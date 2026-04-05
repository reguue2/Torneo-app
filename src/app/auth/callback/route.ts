import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

type SupabaseCookieOptions = {
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "lax" | "strict" | "none" | boolean
}

function buildErrorRedirect(origin: string, message: string) {
  const url = new URL("/login", origin)
  url.searchParams.set("authError", message)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const origin = new URL(request.url).origin
  const code = searchParams.get("code")
  const authError = searchParams.get("error_description") ?? searchParams.get("error")

  if (authError) {
    return buildErrorRedirect(origin, authError)
  }

  if (!code) {
    return buildErrorRedirect(origin, "No se recibió el código de autenticación.")
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return buildErrorRedirect(origin, error.message)
  }

  return NextResponse.redirect(`${origin}/`)
}