"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

const featureCards = [
  {
    title: "Creación clara y directa",
    description:
      "Configura el torneo y publícalo desde un flujo único, sin pasos intermedios innecesarios.",
  },
  {
    title: "Con o sin categorías",
    description:
      "Puedes montar torneos simples o con categorías donde precio y cupos mandan de verdad.",
  },
  {
    title: "Inscripción pública controlada",
    description:
      "La entrada pública pasa por solicitud previa y validación por email antes de crear la inscripción real.",
  },
  {
    title: "Pagos contemplados",
    description:
      "Acepta efectivo con validación manual del organizador y deja preparado el canal online para evolución posterior.",
  },
  {
    title: "Panel del organizador",
    description:
      "Revisa confirmadas, pendientes de efectivo, pendientes online y operaciones clave desde el mismo sitio.",
  },
  {
    title: "Difusión rápida",
    description:
      "Comparte el enlace público del torneo en segundos y centraliza la entrada de participantes.",
  },
] as const

const steps = [
  {
    title: "Crea y publica",
    description:
      "Define estructura, cupos, reglas, premios y método de pago. Publicas el torneo al terminar.",
  },
  {
    title: "Comparte el enlace",
    description:
      "Los participantes entran a la página pública y generan una solicitud de inscripción.",
  },
  {
    title: "Valida y gestiona",
    description:
      "Primero se valida el email y después gestionas confirmaciones y pagos desde tu panel.",
  },
] as const

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)

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

  const handleCreateTournament = () => {
    if (!user) {
      router.push("/login?next=%2Fcrear-torneo")
      return
    }

    router.push("/crear-torneo")
  }

  return (
    <>
      <section className="section-spacing">
        <div className="container-custom grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Organiza Torneo
            </p>
            <h1 className="mt-4 text-5xl font-bold leading-tight tracking-tight text-gray-900 md:text-6xl">
              Organiza torneos locales con un flujo más limpio y coherente.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-gray-600">
              Crea, publica y gestiona torneos para tu comunidad. Comparte un enlace público,
              recoge solicitudes de inscripción y mantén el control real de estados, cupos y pagos.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={handleCreateTournament} className="btn-primary text-center">
                Crear torneo
              </button>

              <Link href="/explorar" className="btn-secondary text-center">
                Explorar torneos
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-gray-600">
              <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-gray-200">
                Publicación directa
              </span>
              <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-gray-200">
                Inscripción pública controlada
              </span>
              <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-gray-200">
                Gestión centralizada
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-100">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 p-6 text-white">
              <p className="text-sm uppercase tracking-[0.18em] text-indigo-100">
                Flujo principal
              </p>
              <div className="mt-6 space-y-5">
                {steps.map((step, index) => (
                  <div key={step.title} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">
                      Paso {index + 1}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">{step.title}</h2>
                    <p className="mt-2 text-sm text-indigo-50">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="container-custom space-y-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Qué resuelve
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              Menos ambigüedad, más control operativo.
            </h2>
            <p className="mt-3 text-lg text-gray-600">
              La app está pensada para que el organizador no dependa de hojas sueltas, mensajes
              perdidos o estados confusos.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-xl font-semibold tracking-tight text-gray-900">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}