const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Decision = "auto_approve" | "auto_reject" | "human_review"
export type RiskBand = "Low" | "Medium" | "High"
export type ImageKind = "product" | "label" | "packaging" | "pop"

export interface HealthResponse {
  ok: boolean
  catalog: { skus: number; drives: number }
  build?: string
}

export type IssueType = "warranty" | "authentication" | "replacement_status" | "troubleshooting" | "general"

export interface CreateCaseResponse {
  case_id: string
  issue_type: IssueType | null
  classified_intent: IssueType | null
}

export interface ChatMessageResponse {
  message_id: string
  case_id: string
  role: "customer" | "assistant" | "system"
  text: string
  intent: IssueType | null
  ai_reply?: string
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
  specifications: ClassificationField[]
}

export type UploadNextStep = "upload_other_side" | "upload_invoice" | "validate" | "complete" | "counterfeit_detected"

export interface UploadImageResponse {
  image_id: string
  kind: string
  filename: string
  classification?: Classification
  next_step?: UploadNextStep
  suggested_prompt?: string
  validation_result?: ValidateResponse
}

export interface BulkUploadResponse {
  uploads: UploadImageResponse[]
  next_step?: UploadNextStep
  suggested_prompt?: string
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

// ---------------------------------------------------------------------------
// v2 Verdict types
// ---------------------------------------------------------------------------

export interface IdentifiedSku {
  family_prefix: string | null
  full_sku: string | null
}

export interface CounterfeitMatch {
  counterfeit_id: string
  tells_matched_count: number
  tells_matched: string[]
  page_ref: number | number[] | null
}

export interface PopValidation {
  vendor_authorized?: boolean
  vendor_name?: string
  vendor_gstin?: string
  product_match?: boolean
  date_plausible?: boolean
  time_delta_days?: number
}

export interface FraudCorrelation {
  pattern: "identical_batch_code" | "sequential_serials"
  severity: "high" | "medium_high" | "medium"
  matched_case_ids: string[]
  matched_values: string[]
  detail: string
}

export interface Gap {
  missing_data_field: string
  affected_checks: string[]
  follow_up_action: string
}

export interface RefinementMeta {
  attempted: boolean
  succeeded: boolean
  fields_added: string[]
}

export interface AuthenticReference {
  matched: boolean
  product: string
  sku: string
}

export interface V2Verdict {
  verdict_reasons: string[]
  damage_observed: boolean
  damage_description: string | null
  product_family: string
  identified_sku: IdentifiedSku
  playbook_used: string | null
  counterfeit_tells_matched: CounterfeitMatch[]
  pop_validation: PopValidation
  fraud_correlations: FraudCorrelation[]
  refinement: RefinementMeta
  gaps: Gap[]
  reason: string
  recommended_next_action: string
  authentic_reference?: AuthenticReference | null
}

// ---------------------------------------------------------------------------
// Customer summary (v1 + optional v2)
// ---------------------------------------------------------------------------

export interface CustomerSummary {
  headline: string
  body: string
  risk_band: RiskBand
  decision: Decision
  checks: ValidationCheck[]
  warranty?: string | null
  extracted?: ExtractedImageFields[]
  next_steps: string[]
  v2?: V2Verdict
}

export interface RMAReturnAddress {
  company: string
  attn: string
  street: string
  city: string
  state: string
  zip: string
  country: string
}

export interface RMAPackagingStep {
  step: number
  icon: string
  title: string
  detail: string
}

export interface RMADetails {
  rma_number: string
  case_id: string
  product: string
  status: "approved"
  return_address: RMAReturnAddress
  packaging_steps: RMAPackagingStep[]
  replacement_lead_time: string
  rma_valid_days: number
  chat_message: string
}

export interface ValidateResponse {
  case_id: string
  validation_id: string | null
  decision: Decision
  risk_score: number
  customer_summary: CustomerSummary
  rma?: RMADetails
}

export interface CaseImage {
  image_id: string
  case_id: string
  kind: ImageKind
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
  decision: Decision | null
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
// Overrides / learning-loop types
// ---------------------------------------------------------------------------

export interface OverrideRow {
  case_id: string
  action: "approve" | "reject" | "request_info" | null
  agent: string | null
  notes: string | null
  queued_at: string
  resolved_at: string
  rule_set_version: "v1" | "v2"
  v2_verdict: Decision | null
  v2_verdict_reasons: string[]
  v2_risk_score: number | null
  agreement: string | null
}

export interface OverrideStats {
  total: number
  by_operator_action: Record<string, number>
  by_v2_verdict: Record<string, number>
  by_rule_set_version: Record<string, number>
  agreement_rate_request_info: number
  top_v2_reasons_when_overridden: Array<{ reason: string; count: number }>
}

export interface CatalogSku {
  prefix: string
  product_name: string
  category: string
  warranty: string
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json()
}

export async function createCase(
  issueType?: "warranty" | "authentication" | "replacement_status" | "troubleshooting",
  options?: { customerId?: string; customerMessage?: string }
): Promise<CreateCaseResponse> {
  const body: Record<string, string> = {}
  if (issueType) body.issue_type = issueType
  if (options?.customerId) body.customer_id = options.customerId
  if (options?.customerMessage) body.customer_message = options.customerMessage
  const res = await fetch(`${API_BASE}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Create case failed: ${res.status}`)
  return res.json()
}

export async function sendMessage(
  caseId: string,
  text: string,
  role: "customer" | "assistant" | "system" = "customer"
): Promise<ChatMessageResponse> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, role }),
  })
  if (!res.ok) throw new Error(`Send message failed: ${res.status}`)
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
  const timeout = kind === "pop" ? 120000 : 60000
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/images`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(timeout),
  })
  if (!res.ok) throw new Error(`Upload image failed: ${res.status}`)
  return res.json()
}

export async function uploadImagesBulk(
  caseId: string,
  kind: "product" | "label" | "packaging" | "pop",
  files: File[]
): Promise<BulkUploadResponse> {
  const form = new FormData()
  form.append("kind", kind)
  for (const file of files) {
    form.append("files[]", file)
  }
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/images/bulk`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`Bulk upload failed: ${res.status}`)
  return res.json()
}

export async function validateCase(caseId: string): Promise<ValidateResponse> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/validate`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
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

export async function getCatalogSkus(): Promise<CatalogSku[]> {
  const res = await fetch(`${API_BASE}/api/catalog/skus`)
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`)
  return res.json()
}

export async function getAgentOverrides(): Promise<{ overrides: OverrideRow[] }> {
  const res = await fetch(`${API_BASE}/api/agent/overrides`)
  if (!res.ok) throw new Error(`Overrides fetch failed: ${res.status}`)
  return res.json()
}

export async function getAgentOverrideStats(): Promise<OverrideStats> {
  const res = await fetch(`${API_BASE}/api/agent/overrides/stats`)
  if (!res.ok) throw new Error(`Override stats fetch failed: ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// v2 verdict reason humanization
// ---------------------------------------------------------------------------

export const VERDICT_REASON_COPY: Record<string, string> = {
  matched_counterfeit_reference: "This product matches a confirmed counterfeit in our database.",
  capacity_code_structurally_invalid: "Batch code uses an invalid capacity prefix.",
  capacity_code_anomaly_with_corroborating_tells: "Capacity-code anomaly combined with other counterfeit signals.",
  multiple_counterfeit_tells_matched: "Multiple counterfeit tells matched the known-fakes catalog.",
  multiple_critical_checks_failed: "Multiple critical validation checks failed.",
  critical_check_failed: "A critical validation check failed.",
  pop_product_mismatch: "Invoice product doesn't match the photos.",
  pop_date_before_claim_impossible: "Invoice date is after the case-open date.",
  fraud_ring_identical_batch_code_across_cases: "Same batch code is on another recent case — possible fraud ring.",
  capacity_code_anomaly_needs_stamp_verification: "Capacity-code anomaly; cross-check with STAMP/Warranty Status Web.",
  multiple_counterfeit_tells_matched_low_confidence: "Possible counterfeit (2 tells matched) — review.",
  one_counterfeit_tell_matched: "Single counterfeit tell matched — low-signal review.",
  damage_coverage_review: "Physical damage observed — damage-coverage policy review required.",
  image_quality_insufficient: "One or more checks were inconclusive due to image quality.",
  validation_check_failed: "A soft validation check failed.",
  pop_missing: "No proof of purchase supplied.",
  vendor_unauthorized: "Invoice is from an unauthorized reseller.",
  no_product_images: "No product photos uploaded.",
  fraud_ring_sequential_serials_across_cases: "Near-sequential serial numbers across cases — mass-counterfeit run signal.",
  fraud_ring_correlation_detected: "Cross-case correlation detected; review related cases.",
  matched_authentic_reference: "Verified against a known-authentic SanDisk product — confirmed genuine.",
  capacity_code_mismatch: "The capacity code on the product doesn't match its labeled capacity — counterfeit.",
}

export function humanizeVerdictReason(code: string): string {
  return VERDICT_REASON_COPY[code] ?? code.replace(/_/g, " ")
}
