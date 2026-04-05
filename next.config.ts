import type { NextConfig } from "next"

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = []
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

if (supabaseUrl) {
  const { protocol, hostname } = new URL(supabaseUrl)

  remotePatterns.push({
    protocol: protocol.replace(":", "") as "http" | "https",
    hostname,
    pathname: "/storage/v1/object/public/**",
  })
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns,
  },
}

export default nextConfig