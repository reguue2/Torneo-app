import Navbar from "@/components/navbar"
import Link from "next/link"

export default function HomePage() {
  return (
    <>

      {/* HERO */}
      <section className="section-spacing text-center">
        <div className="container-custom">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Organiza Torneos Locales <br />
            <span className="text-indigo-600">Sin Esfuerzo</span>
          </h1>

          <p className="mt-6 text-gray-600 text-lg max-w-2xl mx-auto">
            Crea, gestiona y ejecuta torneos para tu comunidad. Perfecto para
            fútbol, pádel, tenis y cualquier evento deportivo local.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            <Link href="/login" className="btn-primary">
              Crear Torneo
            </Link>
            <Link href="#" className="btn-secondary">
              Explorar Torneos
            </Link>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="section-spacing bg-gray-50">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold">Cómo Funciona</h2>
          <p className="text-gray-500 mt-2">
            Comienza en tres simples pasos
          </p>

          <div className="grid md:grid-cols-3 gap-12 mt-16">
            <div>
              <div className="text-4xl">🏆</div>
              <h3 className="mt-4 font-semibold text-lg">
                1. Crea el Torneo
              </h3>
              <p className="text-gray-600 mt-2">
                Configura tu torneo con detalles, reglas, precios y ajustes de
                inscripción.
              </p>
            </div>

            <div>
              <div className="text-4xl">👥</div>
              <h3 className="mt-4 font-semibold text-lg">
                2. Comparte e Inscribe
              </h3>
              <p className="text-gray-600 mt-2">
                Comparte el enlace del torneo vía WhatsApp o redes sociales.
                Los jugadores se inscriben online.
              </p>
            </div>

            <div>
              <div className="text-4xl">🎯</div>
              <h3 className="mt-4 font-semibold text-lg">
                3. Gestiona y Juega
              </h3>
              <p className="text-gray-600 mt-2">
                Rastrea inscripciones, gestiona pagos y ejecuta tu torneo sin
                problemas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section-spacing">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold">Todo lo que Necesitas</h2>
          <p className="text-gray-500 mt-2">
            Funciones poderosas para gestionar torneos de cualquier tamaño
          </p>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="card">
              <h3 className="font-semibold text-lg">Inscripción Fácil</h3>
              <p className="text-gray-600 mt-2">
                Formularios simples para inscripciones individuales o en
                equipo.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-lg">Pagos Flexibles</h3>
              <p className="text-gray-600 mt-2">
                Acepta pagos en efectivo o online y controla quién ha pagado.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-lg">
                Gestión de Participantes
              </h3>
              <p className="text-gray-600 mt-2">
                Visualiza equipos inscritos y controla límites de inscripción.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-lg">Generador de Cuadros</h3>
              <p className="text-gray-600 mt-2">
                Genera automáticamente cuadros de eliminación simple o doble.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-lg">Resultados en Vivo</h3>
              <p className="text-gray-600 mt-2">
                Actualiza resultados en tiempo real.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-lg">Compartir Rápido</h3>
              <p className="text-gray-600 mt-2">
                Comparte enlaces del torneo al instante.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center">
        <div className="container-custom">
          <h2 className="text-3xl font-bold">
            ¿Listo para Crear tu Torneo?
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Únete a organizadores que confían en Organiza Torneo
          </p>

          <Link
            href="/login"
            className="mt-8 inline-block bg-white text-indigo-600 px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
          >
            Comenzar Gratis
          </Link>
        </div>
      </section>
    </>
  )
}