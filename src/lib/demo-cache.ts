import type { UploadImageResponse, BulkUploadResponse, ValidateResponse, Classification, UploadNextStep } from "./api"

// Pre-cached demo file responses keyed by filename pattern.
// When a file matches, the upload/validate calls return instantly without hitting the backend.

interface DemoProduct {
  product: string
  sku: string
  classification: Classification
}

interface DemoInvoice {
  matchesSku: string
  vendorName: string
  vendorGstin: string
  invoiceDate: string
  timeDeltaDays: number
  classification: Classification
}

const DEMO_PRODUCTS: Record<string, DemoProduct> = {
  "sdcz550-256g front": {
    product: "SanDisk Ultra Eco USB 3.2 Flash Drive 256GB",
    sku: "SDCZ550-256G",
    classification: {
      type: "product_image",
      chat_message: "Product identified: **SanDisk Ultra Eco USB 3.2 Flash Drive 256GB** (SDCZ550-256G). Front view captured.",
      description: "SanDisk Ultra Eco USB 3.2 Flash Drive - Front",
      tags: ["usb", "flash_drive", "ultra_eco", "256gb"],
      extracted_text: ["SanDisk", "Ultra Eco", "256GB", "USB 3.2"],
      fields: [
        { label: "Product", value: "SanDisk Ultra Eco USB 3.2 Flash Drive" },
        { label: "Capacity", value: "256GB" },
        { label: "SKU", value: "SDCZ550-256G" },
        { label: "Interface", value: "USB 3.2 Gen 1" },
      ],
      specifications: [
        { label: "Read Speed", value: "Up to 100 MB/s" },
        { label: "Interface", value: "USB 3.2 Gen 1" },
      ],
    },
  },
  "sdcz550-256g back": {
    product: "SanDisk Ultra Eco USB 3.2 Flash Drive 256GB",
    sku: "SDCZ550-256G",
    classification: {
      type: "label_serial",
      chat_message: "Label captured: **SDCZ550-256G** — serial number and batch code visible.",
      description: "SanDisk Ultra Eco USB 3.2 Flash Drive - Back Label",
      tags: ["label", "serial", "back"],
      extracted_text: ["SDCZ550-256G", "Made in China", "5-year limited warranty"],
      fields: [
        { label: "SKU", value: "SDCZ550-256G" },
        { label: "Product", value: "SanDisk Ultra Eco USB 3.2 256GB" },
      ],
      specifications: [],
    },
  },
  "sdsqua4-256g front": {
    product: "SanDisk Ultra microSDXC UHS-I 256GB",
    sku: "SDSQUA4-256G",
    classification: {
      type: "product_image",
      chat_message: "Product identified: **SanDisk Ultra microSDXC UHS-I 256GB** (SDSQUA4-256G).",
      description: "SanDisk Ultra microSDXC Card - Front",
      tags: ["microsd", "ultra", "256gb"],
      extracted_text: ["SanDisk", "Ultra", "256GB", "microSDXC", "UHS-I"],
      fields: [
        { label: "Product", value: "SanDisk Ultra microSDXC UHS-I" },
        { label: "Capacity", value: "256GB" },
        { label: "SKU", value: "SDSQUA4-256G" },
      ],
      specifications: [
        { label: "Speed Class", value: "UHS-I, C10, A1" },
        { label: "Read Speed", value: "Up to 150 MB/s" },
      ],
    },
  },
  "sdsqua4-256g back": {
    product: "SanDisk Ultra microSDXC UHS-I 256GB",
    sku: "SDSQUA4-256G",
    classification: {
      type: "label_serial",
      chat_message: "Label captured: **SDSQUA4-256G** — serial and manufacturing info visible.",
      description: "SanDisk Ultra microSDXC - Back Label",
      tags: ["label", "serial", "microsd"],
      extracted_text: ["SDSQUA4-256G", "Made in Taiwan"],
      fields: [
        { label: "SKU", value: "SDSQUA4-256G" },
        { label: "Product", value: "SanDisk Ultra microSDXC 256GB" },
      ],
      specifications: [],
    },
  },
  "sdsquac-256g front": {
    product: "SanDisk Ultra microSDXC UHS-I 256GB",
    sku: "SDSQUAC-256G",
    classification: {
      type: "product_image",
      chat_message: "Product identified: **SanDisk Ultra microSDXC UHS-I 256GB** (SDSQUAC-256G).",
      description: "SanDisk Ultra microSDXC Card - Front",
      tags: ["microsd", "ultra", "256gb"],
      extracted_text: ["SanDisk", "Ultra", "256GB"],
      fields: [
        { label: "Product", value: "SanDisk Ultra microSDXC UHS-I" },
        { label: "Capacity", value: "256GB" },
        { label: "SKU", value: "SDSQUAC-256G" },
      ],
      specifications: [
        { label: "Speed Class", value: "UHS-I, C10, A1" },
        { label: "Read Speed", value: "Up to 150 MB/s" },
      ],
    },
  },
  "sdsquac-256g back": {
    product: "SanDisk Ultra microSDXC UHS-I 256GB",
    sku: "SDSQUAC-256G",
    classification: {
      type: "label_serial",
      chat_message: "Label captured: **SDSQUAC-256G** — serial visible.",
      description: "SanDisk Ultra microSDXC - Back Label",
      tags: ["label", "serial"],
      extracted_text: ["SDSQUAC-256G"],
      fields: [
        { label: "SKU", value: "SDSQUAC-256G" },
        { label: "Product", value: "SanDisk Ultra microSDXC 256GB" },
      ],
      specifications: [],
    },
  },
  "force_rx2846066 snap1": {
    product: "SanDisk Cruzer Force 32GB",
    sku: "SDCZ71-032G",
    classification: {
      type: "product_image",
      chat_message: "Product identified: **SanDisk Cruzer Force 32GB** (SDCZ71-032G).",
      description: "SanDisk Cruzer Force USB Flash Drive",
      tags: ["usb", "cruzer_force", "32gb"],
      extracted_text: ["SanDisk", "Cruzer Force", "32GB"],
      fields: [
        { label: "Product", value: "SanDisk Cruzer Force" },
        { label: "Capacity", value: "32GB" },
        { label: "SKU", value: "SDCZ71-032G" },
      ],
      specifications: [
        { label: "Interface", value: "USB 2.0" },
      ],
    },
  },
  "force_rx2846066 snap2": {
    product: "SanDisk Cruzer Force 32GB",
    sku: "SDCZ71-032G",
    classification: {
      type: "product_image",
      chat_message: "Second angle captured for **SanDisk Cruzer Force 32GB**.",
      description: "SanDisk Cruzer Force - Second Angle",
      tags: ["usb", "cruzer_force", "32gb"],
      extracted_text: ["SanDisk", "32GB"],
      fields: [
        { label: "Product", value: "SanDisk Cruzer Force" },
        { label: "SKU", value: "SDCZ71-032G" },
      ],
      specifications: [],
    },
  },
}

const DEMO_INVOICES: Record<string, DemoInvoice> = {
  "invoice_sdcz550-256g": {
    matchesSku: "SDCZ550-256G",
    vendorName: "RK DIGITAL WORLD",
    vendorGstin: "27ABKFR5521H1ZP",
    invoiceDate: "2026-05-09",
    timeDeltaDays: 12,
    classification: {
      type: "invoice",
      chat_message: "Invoice from **RK DIGITAL WORLD** for SDCZ550-256G dated 09-May-2026. Vendor is authorized.",
      description: "Purchase invoice - RK Digital World",
      tags: ["invoice", "authorized_vendor", "gst"],
      extracted_text: ["RK DIGITAL WORLD", "SDCZ550-256G", "09/05/2026", "GSTIN: 27ABKFR5521H1ZP"],
      fields: [
        { label: "Vendor", value: "RK DIGITAL WORLD" },
        { label: "GSTIN", value: "27ABKFR5521H1ZP" },
        { label: "Product", value: "SanDisk Ultra Eco USB 3.2 256GB (SDCZ550-256G)" },
        { label: "Invoice Date", value: "09-May-2026" },
        { label: "Amount", value: "INR 1,499" },
      ],
      specifications: [],
    },
  },
  "invoice_sdsqua4-256g": {
    matchesSku: "SDSQUA4-256G",
    vendorName: "SHREE BALAJI INFOTECH",
    vendorGstin: "24AADCS1234F1Z5",
    invoiceDate: "2026-05-12",
    timeDeltaDays: 9,
    classification: {
      type: "invoice",
      chat_message: "Invoice from **SHREE BALAJI INFOTECH** for SDSQUA4-256G dated 12-May-2026. Vendor is authorized.",
      description: "Purchase invoice - Shree Balaji Infotech",
      tags: ["invoice", "authorized_vendor", "gst"],
      extracted_text: ["SHREE BALAJI INFOTECH", "SDSQUA4-256G", "12/05/2026"],
      fields: [
        { label: "Vendor", value: "SHREE BALAJI INFOTECH" },
        { label: "GSTIN", value: "24AADCS1234F1Z5" },
        { label: "Product", value: "SanDisk Ultra microSDXC 256GB (SDSQUA4-256G)" },
        { label: "Invoice Date", value: "12-May-2026" },
        { label: "Amount", value: "INR 1,899" },
      ],
      specifications: [],
    },
  },
  "invoice_sdsquac-256g": {
    matchesSku: "SDSQUAC-256G",
    vendorName: "NEXUS RETAIL VENTURES",
    vendorGstin: "29AABCN7890K1ZQ",
    invoiceDate: "2026-05-15",
    timeDeltaDays: 6,
    classification: {
      type: "invoice",
      chat_message: "Invoice from **NEXUS RETAIL VENTURES** for SDSQUAC-256G dated 15-May-2026. Vendor is authorized.",
      description: "Purchase invoice - Nexus Retail Ventures",
      tags: ["invoice", "authorized_vendor", "gst"],
      extracted_text: ["NEXUS RETAIL VENTURES", "SDSQUAC-256G", "15/05/2026"],
      fields: [
        { label: "Vendor", value: "NEXUS RETAIL VENTURES" },
        { label: "GSTIN", value: "29AABCN7890K1ZQ" },
        { label: "Product", value: "SanDisk Ultra microSDXC 256GB (SDSQUAC-256G)" },
        { label: "Invoice Date", value: "15-May-2026" },
        { label: "Amount", value: "INR 1,799" },
      ],
      specifications: [],
    },
  },
  "invoice_sdcz71-032g": {
    matchesSku: "SDCZ71-032G",
    vendorName: "STELLAR COMPUTER ZONE",
    vendorGstin: "07AAKFS6543L1ZR",
    invoiceDate: "2026-05-18",
    timeDeltaDays: 3,
    classification: {
      type: "invoice",
      chat_message: "Invoice from **STELLAR COMPUTER ZONE** for SDCZ71-032G dated 18-May-2026. Vendor is authorized.",
      description: "Purchase invoice - Stellar Computer Zone",
      tags: ["invoice", "authorized_vendor", "gst"],
      extracted_text: ["STELLAR COMPUTER ZONE", "SDCZ71-032G", "18/05/2026"],
      fields: [
        { label: "Vendor", value: "STELLAR COMPUTER ZONE" },
        { label: "GSTIN", value: "07AAKFS6543L1ZR" },
        { label: "Product", value: "SanDisk Cruzer Force 32GB (SDCZ71-032G)" },
        { label: "Invoice Date", value: "18-May-2026" },
        { label: "Amount", value: "INR 499" },
      ],
      specifications: [],
    },
  },
}

function normalizeFilename(name: string): string {
  return name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[_\-\s]+/g, " ").trim()
}

function findDemoProduct(filename: string): DemoProduct | null {
  const normalized = normalizeFilename(filename)
  for (const [key, product] of Object.entries(DEMO_PRODUCTS)) {
    if (normalized.includes(key)) return product
  }
  return null
}

function findDemoInvoice(filename: string): DemoInvoice | null {
  const normalized = normalizeFilename(filename)
  for (const [key, invoice] of Object.entries(DEMO_INVOICES)) {
    if (normalized.includes(key)) return invoice
  }
  return null
}

export function isDemoFile(filename: string): boolean {
  return findDemoProduct(filename) !== null || findDemoInvoice(filename) !== null
}

let demoImageCounter = 0
let lastDemoProductSku: string | null = null

export function getDemoUploadResponse(filename: string, kind: string): UploadImageResponse | null {
  const product = findDemoProduct(filename)
  if (product) {
    lastDemoProductSku = product.sku
    const isFront = normalizeFilename(filename).includes("front") || normalizeFilename(filename).includes("snap1")
    const nextStep: UploadNextStep = isFront ? "upload_other_side" : "upload_invoice"
    const suggestedPrompt = nextStep === "upload_other_side"
      ? `Got it — I can see the **${product.product}**. Can you also upload the back of the device showing the label/serial number?`
      : `Matched against authentic reference for **${product.product}** (${product.sku}). Now please upload your Flipkart invoice or proof of purchase.`
    return {
      image_id: `demo-img-${++demoImageCounter}`,
      kind: kind || "product",
      filename,
      classification: product.classification,
      next_step: nextStep,
      suggested_prompt: suggestedPrompt,
    }
  }

  const invoice = findDemoInvoice(filename)
  if (invoice) {
    return {
      image_id: `demo-img-${++demoImageCounter}`,
      kind: "pop",
      filename,
      classification: invoice.classification,
      next_step: "validate",
      suggested_prompt: `Invoice from **${invoice.vendorName}** received. Running verification now...`,
    }
  }

  return null
}

export function getDemoBulkUploadResponse(filenames: string[], kind: string): BulkUploadResponse | null {
  const uploads: UploadImageResponse[] = []
  let hasAuthenticMatch = false

  for (const filename of filenames) {
    const product = findDemoProduct(filename)
    if (product) {
      lastDemoProductSku = product.sku
      hasAuthenticMatch = true
      uploads.push({
        image_id: `demo-img-${++demoImageCounter}`,
        kind: kind || "product",
        filename,
        classification: product.classification,
      })
    } else {
      return null
    }
  }

  if (uploads.length === 0) return null

  const product = findDemoProduct(filenames[0])
  const productName = product?.product || "SanDisk Product"
  const sku = product?.sku || ""

  const nextStep: UploadNextStep = hasAuthenticMatch ? "upload_invoice" : "upload_other_side"
  const suggestedPrompt = hasAuthenticMatch
    ? `Matched against authentic reference for **${productName}** (${sku}). Now please upload your Flipkart invoice or proof of purchase.`
    : `Product images received. Can you upload the back of the device showing the label?`

  return {
    uploads,
    next_step: nextStep,
    suggested_prompt: suggestedPrompt,
  }
}

export function getDemoValidateResponse(caseId: string, uploadedFiles: Array<{ file: File; kind: string }>): ValidateResponse | null {
  let matchedProduct: DemoProduct | null = null
  let matchedInvoice: DemoInvoice | null = null

  for (const f of uploadedFiles) {
    const p = findDemoProduct(f.file.name)
    if (p) matchedProduct = p
    const inv = findDemoInvoice(f.file.name)
    if (inv) matchedInvoice = inv
  }

  if (!matchedProduct && !matchedInvoice) return null

  const sku = matchedProduct?.sku || lastDemoProductSku || "UNKNOWN"
  const productName = matchedProduct?.product || "SanDisk Product"

  const hasInvoice = matchedInvoice !== null
  const invoiceMatchesSku = matchedInvoice?.matchesSku === sku

  if (hasInvoice && invoiceMatchesSku) {
    return {
      case_id: caseId,
      validation_id: `demo-val-${Date.now()}`,
      decision: "auto_approve",
      risk_score: 5,
      customer_summary: {
        headline: "Product Verified - Warranty Approved",
        body: `Your ${productName} has been verified as authentic and your invoice from ${matchedInvoice!.vendorName} confirms eligible warranty coverage.`,
        risk_band: "Low",
        decision: "auto_approve",
        checks: [
          { name: "Product Authenticity", result: "Passed", detail: "Matched against verified authentic reference" },
          { name: "Invoice Validation", result: "Passed", detail: `${matchedInvoice!.vendorName} is an authorized vendor` },
          { name: "Purchase Date", result: "Passed", detail: `Invoice date ${matchedInvoice!.invoiceDate} is within warranty window (${matchedInvoice!.timeDeltaDays} days ago)` },
          { name: "Product Match", result: "Passed", detail: `Invoice SKU matches product: ${sku}` },
        ],
        warranty: "5-year limited warranty — eligible for RMA",
        next_steps: ["Your product qualifies for a warranty replacement.", "An RMA will be created for you."],
        v2: {
          verdict_reasons: ["matched_authentic_reference"],
          damage_observed: false,
          damage_description: null,
          product_family: productName,
          identified_sku: { family_prefix: sku.split("-")[0], full_sku: sku },
          playbook_used: "sandisk_flash_drive",
          counterfeit_tells_matched: [],
          pop_validation: {
            vendor_authorized: true,
            vendor_name: matchedInvoice!.vendorName,
            vendor_gstin: matchedInvoice!.vendorGstin,
            product_match: true,
            date_plausible: true,
            time_delta_days: matchedInvoice!.timeDeltaDays,
          },
          fraud_correlations: [],
          refinement: { attempted: false, succeeded: false, fields_added: [] },
          gaps: [],
          reason: "Product matched authentic reference and invoice verified from authorized vendor.",
          recommended_next_action: "proceed_with_rma",
          authentic_reference: { matched: true, product: productName, sku },
        },
      },
    }
  }

  if (matchedProduct && !hasInvoice) {
    return {
      case_id: caseId,
      validation_id: `demo-val-${Date.now()}`,
      decision: "auto_approve",
      risk_score: 15,
      customer_summary: {
        headline: "Product Verified - Invoice Needed",
        body: `Your ${productName} has been verified as authentic. Please provide your invoice to complete the warranty claim.`,
        risk_band: "Low",
        decision: "auto_approve",
        checks: [
          { name: "Product Authenticity", result: "Passed", detail: "Matched against verified authentic reference" },
          { name: "Invoice Validation", result: "Inconclusive", detail: "No proof of purchase provided" },
        ],
        warranty: "Product is eligible — invoice required to confirm purchase date",
        next_steps: ["Upload your proof of purchase to proceed with warranty claim."],
        v2: {
          verdict_reasons: ["matched_authentic_reference", "pop_missing"],
          damage_observed: false,
          damage_description: null,
          product_family: productName,
          identified_sku: { family_prefix: sku.split("-")[0], full_sku: sku },
          playbook_used: "sandisk_flash_drive",
          counterfeit_tells_matched: [],
          pop_validation: {},
          fraud_correlations: [],
          refinement: { attempted: false, succeeded: false, fields_added: [] },
          gaps: [{ missing_data_field: "proof_of_purchase", affected_checks: ["invoice_validation"], follow_up_action: "upload_invoice" }],
          reason: "Product is authentic but proof of purchase is missing.",
          recommended_next_action: "request_proof_of_purchase",
          authentic_reference: { matched: true, product: productName, sku },
        },
      },
    }
  }

  return null
}
