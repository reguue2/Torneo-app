"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import GoogleIcon from "@/components/icons/GoogleIcon"

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const authError = searchParams.get("authError")
    if (!authError) return

    setError(decodeURIComponent(authError))
  }, [searchParams])

  const handleAuth = async () => {
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (authError) throw authError
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (authError) throw authError
      }

      router.push("/")
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Ha ocurrido un error inesperado."
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md card">
        <h1 className="text-2xl font-semibold text-center">
          {isLogin ? "Iniciar sesión" : "Crear cuenta"}
        </h1>

        <p className="text-center text-sm text-gray-500 mt-2">
          {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 hover:underline"
          >
            {isLogin ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>

        <button
          onClick={handleGoogle}
          className="mt-6 w-full border border-gray-300 rounded-lg py-3 font-medium hover:bg-gray-100 transition flex items-center justify-center gap-3"
        >
          <GoogleIcon />
          Continuar con Google
        </button>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
          />

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading
              ? "Cargando..."
              : isLogin
                ? "Iniciar sesión"
                : "Registrarse"}
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          Al iniciar sesión, aceptas los Términos y Política de privacidad
        </p>
      </div>
    </div>
  )
}