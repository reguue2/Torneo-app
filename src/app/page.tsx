import Link from "next/link"

const featureCards = [
  {
    title: "Creación clara y directa",
    description:
      "Configura el torneo y publícalo desde un flujo único, sin depender del sistema viejo de drafts.",
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
              <Link href="/crear-torneo" className="btn-primary text-center">
                Crear torneo
              </Link>
              <Link href="/explorar" className="btn-secondary text-center">
                Explorar torneos
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-gray-600">
              <span className="rounded-full bg-gray-100 px-3 py-1">Con o sin categorías</span>
              <span className="rounded-full bg-gray-100 px-3 py-1">Validación por email</span>
              <span className="rounded-full bg-gray-100 px-3 py-1">Efectivo y online</span>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">Flujo público actual</p>
              <ol className="mt-4 space-y-4 text-sm text-gray-700">
                <li className="rounded-xl bg-gray-50 p-4">
                  <span className="font-semibold text-gray-900">1.</span> El participante crea una
                  solicitud pública.
                </li>
                <li className="rounded-xl bg-gray-50 p-4">
                  <span className="font-semibold text-gray-900">2.</span> Valida el email antes de
                  crear la inscripción real.
                </li>
                <li className="rounded-xl bg-gray-50 p-4">
                  <span className="font-semibold text-gray-900">3.</span> El organizador gestiona
                  confirmaciones y pagos desde el panel.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="section-spacing bg-gray-50">
        <div className="container-custom">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Hoy el producto ya cubre lo importante.
            </h2>
            <p className="mt-3 text-gray-600">
              Aquí no se venden funciones fantasmas. Esto es lo que sí encaja con el estado actual
              del sistema.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-spacing">
        <div className="container-custom">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Cómo funciona ahora mismo.
            </h2>
            <p className="mt-3 text-gray-600">
              El objetivo no es complicarte el producto. Es dejar claro el recorrido operativo real.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 font-semibold text-indigo-700">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-spacing border-t border-gray-200 bg-white">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">¿Quieres montarlo ya?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Crea tu torneo, publícalo y comparte el enlace público desde el flujo nuevo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/crear-torneo" className="btn-primary text-center">
              Empezar a crear
            </Link>
            <Link href="/mis-torneos" className="btn-secondary text-center">
              Ir a mis torneos
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}