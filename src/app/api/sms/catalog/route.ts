import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { computeCharge, smsProviderErrorResponse } from "@/lib/sms-orders"
import { SMS_COUNTRIES, SMS_MOCK_SENTINELS, getProviderCatalog } from "@/lib/smsProvider"
import { resolveServiceOption, SmsServiceOption } from "@/lib/sms-catalog"
import { smsCatalogSchema } from "@/lib/validations/sms"

export const dynamic = "force-dynamic"

/**
 * Public SMS price list for a country.
 *
 * WHITE-LABEL: this response is customer-facing, so it exposes ONLY the final
 * selling price per service. The supplier base cost, the flat profit markup and
 * the identity of the upstream provider are all stripped here — never widen
 * this payload, it is readable in the browser's page source.
 */
export async function GET(request: NextRequest) {
  try {
    const { country } = smsCatalogSchema.parse({
      country: request.nextUrl.searchParams.get("country") ?? "usa",
    })

    const costByService = await getProviderCatalog(country)

    const prices: Record<string, { price: number } | null> = {}
    const services: SmsServiceOption[] = []
    for (const code of Object.keys(costByService).sort()) {
      // The mock provider prices a few sentinel services (`noship`, `ratelimit`,
      // `slowcode`, `outofstock`) so the order API can exercise its failure and
      // compensation paths. They are not real products, so they must never reach
      // the storefront — see SMS_MOCK_SENTINELS.
      if (SMS_MOCK_SENTINELS.has(code)) continue
      const cost = costByService[code]
      if (cost === undefined) continue
      prices[code] = { price: (await computeCharge(cost)).toNumber() }
      const option = resolveServiceOption(code)
      services.push(option)
    }

    return NextResponse.json({
      country,
      countries: SMS_COUNTRIES,
      services,
      prices,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    const providerResponse = smsProviderErrorResponse(error)
    if (providerResponse) return providerResponse

    console.error("SMS catalog error:", error)
    return NextResponse.json(
      { error: "Could not load SMS pricing. Please try again." },
      { status: 500 }
    )
  }
}
