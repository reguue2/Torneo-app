"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useRef } from "react"

export default function Navbar() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Cerrar dropdown al hacer click fuera
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

        <div className="hidden md:flex items-center gap-8 text-gray-600">
          <Link href="/explorar" className="hover:text-black transition">
            Explorar Torneos
          </Link>

          <button
            onClick={() => handleProtectedRoute("/mis-torneos")}
            className="hover:text-black transition"
          >
            Mis Torneos
          </button>

          <button
            onClick={() => handleProtectedRoute("/crear-torneo")}
            className="hover:text-black transition"
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
                className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold"
              >
                {user.email?.charAt(0).toUpperCase()}
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 transition"
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