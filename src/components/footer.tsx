export default function Footer() {
  return (
    <footer className="border-t border-gray-200 py-12 mt-24">
      <div className="container-custom grid md:grid-cols-4 gap-8 text-sm text-gray-600">
        <div>
          <h4 className="font-semibold mb-3">Organiza Torneo</h4>
          <p>Crea y gestiona torneos locales para tu comunidad.</p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Producto</h4>
          <p>Explorar Torneos</p>
          <p>Crear Torneo</p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Soporte</h4>
          <p>Centro de Ayuda</p>
          <p>Contáctanos</p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Legal</h4>
          <p>Política de Privacidad</p>
          <p>Términos de Servicio</p>
        </div>
      </div>

      <div className="text-center text-gray-400 mt-10 text-sm">
        © 2026 Organiza Torneo. Todos los derechos reservados.
      </div>
    </footer>
  )
}