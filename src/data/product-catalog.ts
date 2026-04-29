import { supabase } from "@/lib/supabase"

export interface ProductCatalogEntry {
  id: number
  sku: string
  productName: string
  brand: string
  category: string
  productFamily: string
  internalModelId: string
  manufacturerPartNumber: string
  capacity: string
  formFactor: string
  connectorType: string
  interface: string
  colorVariant: string
  materialFinish: string
  countryOfManufacture: string
  warrantyYears: number
  expectedMarkings: string[]
  visualDescription: string
}

export interface CatalogMatchResult {
  entry: ProductCatalogEntry | null
  matchScore: number
  matchedFields: string[]
  totalChecked: number
}

function mapRow(row: Record<string, unknown>): ProductCatalogEntry {
  return {
    id: row.id as number,
    sku: row.sku as string,
    productName: row.product_name as string,
    brand: row.brand as string,
    category: row.category as string,
    productFamily: row.product_family as string,
    internalModelId: row.internal_model_id as string,
    manufacturerPartNumber: row.manufacturer_part_number as string,
    capacity: row.capacity as string,
    formFactor: row.form_factor as string,
    connectorType: row.connector_type as string,
    interface: row.interface as string,
    colorVariant: row.color_variant as string,
    materialFinish: row.material_finish as string,
    countryOfManufacture: row.country_of_manufacture as string,
    warrantyYears: row.warranty_years as number,
    expectedMarkings: (row.expected_markings as string[]) || [],
    visualDescription: row.visual_description as string,
  }
}

export async function lookupAllProducts(): Promise<ProductCatalogEntry[]> {
  const { data, error } = await supabase
    .from("product_catalog")
    .select("*")
    .order("product_name")

  if (error || !data) return []
  return data.map(mapRow)
}

export async function matchOcrToCatalog(
  ocrRaw: Record<string, unknown>
): Promise<CatalogMatchResult> {
  const products = await lookupAllProducts()
  if (products.length === 0) {
    return { entry: null, matchScore: 0, matchedFields: [], totalChecked: 0 }
  }

  const allTexts = extractAllTexts(ocrRaw)
  const joinedText = allTexts.join(" ").toUpperCase()

  let bestMatch: ProductCatalogEntry | null = null
  let bestScore = 0
  let bestFields: string[] = []
  let bestTotal = 0

  for (const product of products) {
    const { score, matched, total } = scoreProduct(product, joinedText, allTexts)
    if (score > bestScore) {
      bestScore = score
      bestMatch = product
      bestFields = matched
      bestTotal = total
    }
  }

  return {
    entry: bestScore > 0 ? bestMatch : null,
    matchScore: bestScore,
    matchedFields: bestFields,
    totalChecked: bestTotal,
  }
}

function extractAllTexts(ocrRaw: Record<string, unknown>): string[] {
  const texts: string[] = []

  // Structured agent response format (text_extractions array)
  const extractions = ocrRaw.text_extractions as Array<{ text_content?: string }> | undefined
  if (Array.isArray(extractions)) {
    for (const item of extractions) {
      if (item.text_content) texts.push(item.text_content)
    }
  }

  // Visual attributes from agent response
  const visual = ocrRaw.visual_attributes as Record<string, unknown> | undefined
  if (visual) {
    if (visual.form_factor) texts.push(String(visual.form_factor))
    if (visual.connectors) texts.push(String(visual.connectors))
    if (Array.isArray(visual.product_colors)) {
      texts.push(...(visual.product_colors as string[]))
    }
  }

  if (ocrRaw.product_type) texts.push(String(ocrRaw.product_type))

  // Flat scenario/offline format (brandDetected, productText, etc.)
  if (ocrRaw.brandDetected) texts.push(String(ocrRaw.brandDetected))
  if (ocrRaw.productText) texts.push(String(ocrRaw.productText))
  if (ocrRaw.serialDetected) texts.push(String(ocrRaw.serialDetected))
  if (ocrRaw.capacityDetected) texts.push(String(ocrRaw.capacityDetected))

  return texts.filter(Boolean)
}

function scoreProduct(
  product: ProductCatalogEntry,
  joinedText: string,
  allTexts: string[]
): { score: number; matched: string[]; total: number } {
  const matched: string[] = []
  const checks: Array<{ field: string; weight: number; pass: boolean }> = []

  // Model ID match (strongest signal)
  const modelMatch = joinedText.includes(product.internalModelId.toUpperCase())
  checks.push({ field: "Model ID", weight: 3, pass: modelMatch })
  if (modelMatch) matched.push("Model ID")

  // MPN match
  const mpnMatch = joinedText.includes(product.manufacturerPartNumber.toUpperCase())
  checks.push({ field: "Part Number", weight: 3, pass: mpnMatch })
  if (mpnMatch) matched.push("Part Number")

  // Capacity match
  const capMatch = joinedText.includes(product.capacity.toUpperCase())
  checks.push({ field: "Capacity", weight: 2, pass: capMatch })
  if (capMatch) matched.push("Capacity")

  // Connector type match
  const connMatch = joinedText.includes(product.connectorType.toUpperCase())
  checks.push({ field: "Connector", weight: 1, pass: connMatch })
  if (connMatch) matched.push("Connector")

  // Form factor match
  const ffMatch = joinedText.includes(product.formFactor.toUpperCase()) ||
    joinedText.includes(product.category.toUpperCase().replace("FLASH ", ""))
  checks.push({ field: "Form Factor", weight: 1, pass: ffMatch })
  if (ffMatch) matched.push("Form Factor")

  // Country of manufacture
  const countryMatch = joinedText.includes(product.countryOfManufacture.toUpperCase())
  checks.push({ field: "Country", weight: 1, pass: countryMatch })
  if (countryMatch) matched.push("Country")

  // Expected markings -- check how many are present
  let markingsFound = 0
  for (const marking of product.expectedMarkings) {
    if (joinedText.includes(marking.toUpperCase())) {
      markingsFound++
    }
  }
  const markingsRatio = product.expectedMarkings.length > 0
    ? markingsFound / product.expectedMarkings.length
    : 0
  const markingsPass = markingsRatio >= 0.4
  checks.push({ field: "Markings", weight: 2, pass: markingsPass })
  if (markingsPass) matched.push(`Markings (${markingsFound}/${product.expectedMarkings.length})`)

  // Color match (loose)
  const colorParts = product.colorVariant.toLowerCase().split(/[\/,\s]+/)
  const colorTexts = allTexts.map((t) => t.toLowerCase())
  const colorMatch = colorParts.some((c) =>
    colorTexts.some((t) => t.includes(c))
  )
  checks.push({ field: "Color", weight: 1, pass: colorMatch })
  if (colorMatch) matched.push("Color")

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0)
  const earnedWeight = checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0)
  const score = Math.round((earnedWeight / totalWeight) * 100)

  return { score, matched, total: checks.length }
}
