import VerifyFlow from "./verify-flow"

type SearchParams = Promise<{
  request?: string
  token?: string
  code?: string
}>

export default async function VerificarInscripcionPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { request = "", token = "", code = "" } = await searchParams

  return (
    <div className="section-spacing">
      <div className="container-custom max-w-3xl">
        <VerifyFlow
          initialRequestId={request}
          initialToken={token}
          initialCode={code}
        />
      </div>
    </div>
  )
}