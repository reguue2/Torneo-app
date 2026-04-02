"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useRef } from "react"

export default function Navbar() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleProtectedRoute = (path: string) => {
    if (!user) {
      router.push("/login")
    } else {
      router.push(path)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <nav className="w-full border-b border-gray-200 bg-white">
      <div className="container-custom flex items-center justify-between py-4">
        <Link href="/" className="text-xl font-semibold">
          🏆 Organiza Torneo
        </Link>

        <div className="hidden items-center gap-8 text-gray-600 md:flex">
          <Link href="/explorar" className="transition hover:text-black">
            Explorar Torneos
          </Link>

          <button
            onClick={() => handleProtectedRoute("/mis-torneos")}
            className="transition hover:text-black"
          >
            Mis Torneos
          </button>

          <button
            onClick={() => handleProtectedRoute("/crear-torneo")}
            className="transition hover:text-black"
          >
            Crear Torneo
          </button>

          {!user && (
            <button
              onClick={() => router.push("/login")}
              className="btn-primary"
            >
              Comenzar
            </button>
          )}

          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen(!open)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white"
              >
                {user.email?.charAt(0).toUpperCase()}
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-sm transition hover:bg-gray-100"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}