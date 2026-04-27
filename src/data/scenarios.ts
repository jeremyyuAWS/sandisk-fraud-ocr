export interface WarrantyInfo {
  product: string
  serialNumber: string
  status: string
  registered: boolean
  purchaseDate: string
  priorClaims: number
  replacementEligible: boolean
}

export interface OcrResult {
  brandDetected: string
  productText: string
  serialDetected: string
  capacityDetected: string
  imageQuality: string
}

export interface RiskAssessment {
  score: number
  level: "Low" | "Medium" | "High"
  reasonCodes: string[]
}

export interface Scenario {
  id: string
  label: string
  serialEntered: string
  productImage: string
  warranty: WarrantyInfo
  ocr: OcrResult
  risk: RiskAssessment
  recommendation: string
}

export const scenarios: Record<string, Scenario> = {
  genuine: {
    id: "genuine",
    label: "Genuine Product",
    serialEntered: "BM190826778W",
    productImage: "/cruiser-blade.jpg",
    warranty: {
      product: "SanDisk Cruzer Blade 32GB USB Flash Drive",
      serialNumber: "BM190826778W",
      status: "Active",
      registered: true,
      purchaseDate: "2025-09-14",
      priorClaims: 0,
      replacementEligible: true,
    },
    ocr: {
      brandDetected: "SanDisk",
      productText: "Cruzer Blade 32GB",
      serialDetected: "BM190826778W",
      capacityDetected: "32GB",
      imageQuality: "High",
    },
    risk: {
      score: 12,
      level: "Low",
      reasonCodes: ["All fields match", "Brand pattern consistent"],
    },
    recommendation: "Proceed with replacement claim",
  },
  suspicious: {
    id: "suspicious",
    label: "Suspicious / Fraudulent",
    serialEntered: "BM190826778W",
    productImage: "/sandisk-ssd.jpeg",
    warranty: {
      product: "SanDisk Cruzer Blade 32GB USB Flash Drive",
      serialNumber: "BM190826778W",
      status: "Active",
      registered: true,
      purchaseDate: "2025-06-02",
      priorClaims: 2,
      replacementEligible: true,
    },
    ocr: {
      brandDetected: "Unknown",
      productText: "128GB",
      serialDetected: "SDCZ50-128G",
      capacityDetected: "128GB",
      imageQuality: "High",
    },
    risk: {
      score: 88,
      level: "High",
      reasonCodes: [
        "Serial number mismatch between claim and product image",
        "Capacity mismatch: claimed 32GB, detected 128GB",
        "Branding pattern inconsistent with known SanDisk label",
      ],
    },
    recommendation: "Escalate to live agent for manual review",
  },
  unverifiable: {
    id: "unverifiable",
    label: "Unverifiable Image",
    serialEntered: "BM190826778W",
    productImage: "/sandisk-xtreme-hand.jpg",
    warranty: {
      product: "SanDisk Cruzer Blade 32GB USB Flash Drive",
      serialNumber: "BM190826778W",
      status: "Active",
      registered: true,
      purchaseDate: "2025-11-20",
      priorClaims: 1,
      replacementEligible: true,
    },
    ocr: {
      brandDetected: "Partial",
      productText: "Unreadable",
      serialDetected: "---",
      capacityDetected: "Unreadable",
      imageQuality: "Low",
    },
    risk: {
      score: 55,
      level: "Medium",
      reasonCodes: [
        "Image too blurry to extract serial number",
        "Brand text partially obscured",
        "Unable to confirm product capacity",
      ],
    },
    recommendation: "Request higher quality image or escalate to agent",
  },
}
