import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Database } from "@/types/database"

function isPublicTournamentRegistrationPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)

  return (
    segments.length === 3 &&
    segments[0] === "torneo" &&
    segments[2] === "inscribirse"
  )
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (isPublicTournamentRegistrationPath(pathname)) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...options })
        },
        remove: (name, options) => {
          res.cookies.set({ name, value: "", ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedRoutes = ["/mis-torneos", "/crear-torneo", "/torneo"]
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route))

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return res
}

export const config = {
  matcher: ["/mis-torneos/:path*", "/crear-torneo/:path*", "/torneo/:path*"],
}