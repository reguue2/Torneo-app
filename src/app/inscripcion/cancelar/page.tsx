import CancelFlow from "./cancel-flow"

type SearchParams = Promise<{
  reference?: string
  token?: string
  code?: string
}>

export default async function CancelarInscripcionPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { reference = "", token = "", code = "" } = await searchParams

  return (
    <div className="section-spacing">
      <div className="container-custom max-w-3xl">
        <CancelFlow
          initialReference={reference}
          initialToken={token}
          initialCode={code}
        />
      </div>
    </div>
  )
}