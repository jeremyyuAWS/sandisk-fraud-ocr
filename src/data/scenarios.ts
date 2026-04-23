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
  warranty: WarrantyInfo
  ocr: OcrResult
  risk: RiskAssessment
  recommendation: string
}

export const scenarios: Record<string, Scenario> = {
  genuine: {
    id: "genuine",
    label: "Genuine Product",
    serialEntered: "SDKX-256-88421",
    warranty: {
      product: "SanDisk Extreme Pro microSDXC 256GB",
      serialNumber: "SDKX-256-88421",
      status: "Active",
      registered: true,
      purchaseDate: "2025-09-14",
      priorClaims: 0,
      replacementEligible: true,
    },
    ocr: {
      brandDetected: "SanDisk",
      productText: "Extreme Pro microSDXC",
      serialDetected: "SDKX-256-88421",
      capacityDetected: "256GB",
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
    serialEntered: "SDKX-256-99182",
    warranty: {
      product: "SanDisk Extreme Pro microSDXC 256GB",
      serialNumber: "SDKX-256-99182",
      status: "Active",
      registered: true,
      purchaseDate: "2025-06-02",
      priorClaims: 2,
      replacementEligible: true,
    },
    ocr: {
      brandDetected: "Unknown",
      productText: "128GB",
      serialDetected: "SDKX-128-11111",
      capacityDetected: "128GB",
      imageQuality: "High",
    },
    risk: {
      score: 88,
      level: "High",
      reasonCodes: [
        "Serial number mismatch between claim and product image",
        "Capacity mismatch: claimed 256GB, detected 128GB",
        "Branding pattern inconsistent with known SanDisk label",
      ],
    },
    recommendation: "Escalate to live agent for manual review",
  },
  unverifiable: {
    id: "unverifiable",
    label: "Unverifiable Image",
    serialEntered: "SDKX-256-44710",
    warranty: {
      product: "SanDisk Extreme Pro microSDXC 256GB",
      serialNumber: "SDKX-256-44710",
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
