const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthResponse {
  ok: boolean
  catalog: { skus: number; drives: number }
  build?: string
}

export interface CreateCaseResponse {
  case_id: string
}

export interface ClassificationField {
  label: string
  value: string
}

export interface Classification {
  type: "product_image" | "label_serial" | "packaging" | "invoice" | "transcript" | "unknown"
  chat_message: string
  description: string
  tags: string[]
  extracted_text: string[]
  fields: ClassificationField[]
}

export interface UploadImageResponse {
  image_id: string
  kind: string
  filename: string
  classification?: Classification
}

export interface ValidationCheck {
  name: string
  result: "Passed" | "Failed" | "Inconclusive"
  detail: string
}

export interface ExtractedImageFields {
  kind: string
  filename: string
  fields: ClassificationField[]
}

export interface CustomerSummary {
  headline: string
  body: string
  risk_band: "Low" | "Medium" | "High"
  decision: "auto_approve" | "auto_reject" | "human_review"
  checks: ValidationCheck[]
  warranty?: string
  extracted?: ExtractedImageFields[]
  next_steps: string[]
}

export interface ValidateResponse {
  case_id: string
  validation_id: string
  decision: "auto_approve" | "auto_reject" | "human_review"
  risk_score: number
  customer_summary: CustomerSummary
}

export interface CaseImage {
  image_id: string
  case_id: string
  kind: "product" | "label" | "packaging" | "pop"
  filename: string
  mime_type: string
  uploaded_at: string
  ocr: Record<string, unknown> | null
}

export interface MatchedSku {
  prefix: string
  product_name: string
  warranty: string
  category: string
}

export interface Indicator {
  code: string
  severity: number
  detail: string
}

export interface ValidationPayload {
  risk_score: number
  decision: string
  indicators: Indicator[]
  checks: ValidationCheck[]
  matched_sku: MatchedSku | null
  customer_summary: CustomerSummary
}

export interface CaseValidation {
  validation_id: string
  created_at: string
  payload: ValidationPayload
}

export interface CaseRecord {
  case_id: string
  created_at: string
  issue_type: string
  status: "open" | "validated" | "approved" | "rejected" | "escalated"
  decision: "auto_approve" | "auto_reject" | "human_review" | null
  risk_score: number
  summary: CustomerSummary | null
  images: CaseImage[]
  validations: CaseValidation[]
}

export interface QueueReview {
  review_id: string
  case_id: string
  queued_at: string
  issue_type: string
  risk_score: number
  decision: string
  summary: CustomerSummary
}

export interface AgentCase {
  case_id: string
  created_at: string
  issue_type: string
  status: string
  decision: string | null
  risk_score: number
  summary: CustomerSummary | null
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`)
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json()
}

export async function createCase(
  issueType: "warranty" | "authentication" | "replacement_status" | "troubleshooting",
  customerId?: string
): Promise<CreateCaseResponse> {
  const body: Record<string, string> = { issue_type: issueType }
  if (customerId) body.customer_id = customerId
  const res = await fetch(`${API_BASE}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Create case failed: ${res.status}`)
  return res.json()
}

export async function uploadImage(
  caseId: string,
  kind: "product" | "label" | "packaging" | "pop",
  file: File
): Promise<UploadImageResponse> {
  const form = new FormData()
  form.append("kind", kind)
  form.append("file", file)
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/images`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) throw new Error(`Upload image failed: ${res.status}`)
  return res.json()
}

export async function validateCase(caseId: string): Promise<ValidateResponse> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/validate`, {
    method: "POST",
    signal: AbortSignal.timeout(90000),
  })
  if (!res.ok) throw new Error(`Validate failed: ${res.status}`)
  return res.json()
}

export async function getCase(caseId: string): Promise<CaseRecord> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}`)
  if (!res.ok) throw new Error(`Get case failed: ${res.status}`)
  return res.json()
}

export function getImageUrl(caseId: string, imageId: string): string {
  return `${API_BASE}/api/cases/${caseId}/images/${imageId}`
}

export async function escalateCase(caseId: string): Promise<{ case_id: string; review_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/escalate`, {
    method: "POST",
  })
  if (!res.ok) throw new Error(`Escalate failed: ${res.status}`)
  return res.json()
}

export async function getAgentQueue(): Promise<{ reviews: QueueReview[] }> {
  const res = await fetch(`${API_BASE}/api/agent/queue`)
  if (!res.ok) throw new Error(`Queue fetch failed: ${res.status}`)
  return res.json()
}

export async function getAgentCases(limit = 100): Promise<{ cases: AgentCase[] }> {
  const res = await fetch(`${API_BASE}/api/agent/cases?limit=${limit}`)
  if (!res.ok) throw new Error(`Agent cases fetch failed: ${res.status}`)
  return res.json()
}

export async function submitAgentDecision(
  caseId: string,
  action: "approve" | "reject" | "request_info",
  notes?: string,
  agent?: string
): Promise<{ case_id: string; action: string; status: string }> {
  const body: Record<string, string> = { action }
  if (notes) body.notes = notes
  if (agent) body.agent = agent
  const res = await fetch(`${API_BASE}/api/agent/cases/${caseId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Agent decision failed: ${res.status}`)
  return res.json()
}
