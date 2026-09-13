import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSmmMarkupPercent, smmProviderErrorResponse } from "@/lib/smm-orders"
import { getSmmCatalog, isSmmProviderConfigured } from "@/lib/smmProvider"
import { smmCatalogSchema } from "@/lib/validations/smm"
import { PLATFORM_ICON_MAP } from "@/lib/smm-catalog"

export const dynamic = "force-dynamic"

function derivePlatformsFromServices(
  services: { platform: string }[]
): { code: string; name: string; icon: string }[] {
  const seen = new Set<string>()
  const platforms: { code: string; name: string; icon: string }[] = []
  for (const s of services) {
    const name = (s.platform || "Other").trim()
    const code = name.toLowerCase()
    if (!name || seen.has(code)) continue
    seen.add(code)
    platforms.push({
      code,
      name,
      icon: PLATFORM_ICON_MAP[code] ?? PLATFORM_ICON_MAP[name.toLowerCase()] ?? "🌐",
    })
  }
  return platforms
}

/**
 * Catalog for the SMM storefront: platforms and services derived from the
 * supplier API. Platforms are extracted from the live service catalog so any
 * new platform returned by the supplier appears automatically.
 */
export async function GET(request: NextRequest) {
  try {
    const { platform } = smmCatalogSchema.parse({
      platform: request.nextUrl.searchParams.get("platform") ?? undefined,
    })

    if (!isSmmProviderConfigured()) {
      return NextResponse.json(
        { error: "SMM provider is not configured. Please try again later.", code: "NOT_CONFIGURED" },
        { status: 503 }
      )
    }

    const services = await getSmmCatalog()

    const filtered = platform
      ? services.filter((s) => s.platform.toLowerCase() === platform.toLowerCase())
      : services

    const platforms = derivePlatformsFromServices(services)

    return NextResponse.json({
      platforms,
      services: filtered,
      markupPercent: await getSmmMarkupPercent(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    console.error("SMM catalog error:", error)
    const providerResponse = smmProviderErrorResponse(error)
    if (providerResponse) return providerResponse
    return NextResponse.json(
      { error: "Could not load SMM services. Please try again." },
      { status: 500 }
    )
  }
}
