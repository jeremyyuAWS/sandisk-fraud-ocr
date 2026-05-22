# Bolt.new ↔ v2 Backend Integration — PRD

This document is everything a bolt.new project needs to wire a frontend to the SanDisk Warranty Triage v2 backend. Paste it into a bolt.new prompt or attach it as context.

---

## 1. What the backend is

A FastAPI service that takes warranty / RMA submissions (drive photos + invoices), runs each one through an OCR + rules pipeline, and returns a structured verdict with reasoning. The v2 rules engine layers on top of v1 with richer fields — both shapes are returned in the same response so the frontend can render either.

**One-line elevator pitch:** customer uploads photos, gets a verdict (`auto_approve` / `human_review` / `auto_reject`) plus a human-readable trace of why.

What v2 adds beyond v1:
- Per-SKU **playbooks** (Cruzer Blade, Ultra Luxe, Ultra Flair, Dual Drive Go, Ultra Type-C, Extreme PRO microSD) loaded on demand
- **Cross-case fraud-ring correlation** (identical batch codes / sequential serials)
- **Self-correcting OCR** — targeted second-pass vision when the first pass misses a field
- **Damage detection** separate from counterfeit tampering
- **Operator-override learning loop** (for the agent dashboard)
- Structured `verdict_reasons[]`, `gaps[]`, `fraud_correlations[]`, etc.

---

## 2. Architecture

```
[bolt.new browser app]   --HTTPS-->   [FastAPI v2 backend]   -->   [SQLite or Postgres]
        |                                     |
        +- React/Vue/Svelte/anything          +- Anthropic vision (OCR + refiner)
        +- Calls JSON endpoints               +- Pure-Python rule engine
        +- POSTs multipart for uploads        +- Reads Training files/ for rules
```

The backend is stateless across requests; all state lives in the DB. The frontend never reaches the rules engine directly — only through the HTTP API.

---

## 3. Connectivity & configuration

### 3.1 Where the backend runs

Local dev: `http://localhost:8000` (default uvicorn port — adjust with `--port`).

Deployed: wherever the deploy target is (`deploy/azure/` has Azure Container Apps config). The URL will be something like `https://sandisk-warranty-demo.<region>.azurecontainerapps.io`.

### 3.2 CORS

The backend already allows ALL origins:
```python
allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
```
**No backend changes required for bolt.new** — its preview origin will be accepted. (Tighten before going to production.)

### 3.3 Frontend config

One env var:
```
VITE_API_BASE_URL=https://your-deployed-backend.example.com
```

In bolt.new, expose it via `import.meta.env.VITE_API_BASE_URL`. The fetch wrapper should fall back to `''` (same-origin) for relative paths if needed:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, init);
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}
```

### 3.4 Backend env vars (operator-side, not the frontend's concern)

These control v2 behavior server-side. Set them in `backend/.env`:
- `ANTHROPIC_API_KEY` — required for real OCR; without it the backend stubs OCR results
- `RULE_SET_VERSION=v2` — enables the v2 rule set (default `v1` for backwards compat)
- `OCR_REFINER_ENABLED=true` — enables the targeted second-pass OCR (default `true`; set `false` to disable for cost)
- `DEMO_DATABASE_URL` — optional Postgres URL; falls back to SQLite

---

## 4. API reference

All endpoints prefixed with `/api`. All responses are JSON unless noted. All times are ISO-8601 UTC.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness + catalog stats |
| GET | `/api/catalog/skus` | List of known SanDisk SKUs (for autocomplete / display) |
| POST | `/api/cases` | Create a new warranty case |
| POST | `/api/cases/{id}/images` | Upload an image or invoice PDF to a case (one at a time) |
| POST | `/api/cases/{id}/validate` | Run the rules pipeline on the case's uploads |
| GET | `/api/cases/{id}` | Read a case, its images (with OCR), and validation history |
| GET | `/api/cases/{id}/images/{image_id}` | Serve an uploaded image blob (for the agent UI) |
| POST | `/api/cases/{id}/escalate` | Manually queue for review (rarely needed; `validate` auto-queues) |
| GET | `/api/agent/queue` | List of cases pending human review |
| GET | `/api/agent/cases?limit=N` | All cases (operator dashboard) |
| POST | `/api/agent/cases/{id}/decision` | Operator records approve/reject/request_info |
| GET | `/api/agent/overrides` | Resolved reviews joined with v2 verdict snapshot (learning loop) |
| GET | `/api/agent/overrides/stats` | Aggregate accuracy/disagreement metrics |
| POST | `/api/cases/{id}/messages` | Append a chat message to a case (customer or assistant) |
| GET | `/api/cases/{id}/messages` | List all chat messages on a case, oldest first |

### 4.1 `GET /api/health`

```bash
curl https://api.example.com/api/health
# → {"ok": true, "catalog": {"skus": 94, "drives": 213}, "build": "..."}
```

Use for connection + deploy sanity checks.

### 4.2 `POST /api/cases`

Request body:
```json
{
  "issue_type": "warranty | authentication | replacement_status | troubleshooting | general",
  "customer_id": "optional string",
  "customer_message": "optional free-form opening message"
}
```

All three fields are optional. The frontend can:
- **Pill flow** (legacy): send only `issue_type` from one of the 4 button clicks.
- **Chat flow** (new): send only `customer_message` with whatever the customer typed. The backend keyword-classifies it into one of the 4 buckets (or `general`) and stores it as the first chat message on the case.
- **Hybrid**: send both. An explicit `issue_type` always wins over classification.

Response:
```json
{
  "case_id": "case_055ac366ce7a",
  "issue_type": "troubleshooting",
  "classified_intent": "troubleshooting"
}
```

`classified_intent` is non-null only when the backend ran the classifier (i.e. `customer_message` was supplied and `issue_type` wasn't). The frontend can use it to show "Got it — sounds like a troubleshooting issue" or similar.

### 4.2a `POST /api/cases/{case_id}/messages`

Append a message to the case's chat history. Use for ongoing free-form chat after case creation, OR to record assistant/system replies.

Request body:
```json
{
  "text": "My drive stopped working after 6 months",
  "role": "customer | assistant | system"   // defaults to "customer"
}
```

Response:
```json
{
  "message_id": "msg_a1b2c3d4e5f6",
  "case_id": "case_055ac366ce7a",
  "role": "customer",
  "text": "My drive stopped working after 6 months",
  "intent": "troubleshooting"   // null for non-customer roles
}
```

Customer messages get classified; assistant/system messages don't.

### 4.2b `GET /api/cases/{case_id}/messages`

Returns the full chat history for a case, oldest first.

```json
{
  "messages": [
    {
      "message_id": "msg_aaa",
      "case_id": "case_xxx",
      "role": "customer",
      "text": "Is this a real SanDisk?",
      "intent": "authentication",
      "created_at": "2026-05-18T17:21:09.123456+00:00"
    },
    {
      "message_id": "msg_bbb",
      "case_id": "case_xxx",
      "role": "assistant",
      "text": "Thanks — please upload a photo of the back of the drive.",
      "intent": null,
      "created_at": "2026-05-18T17:21:10.456789+00:00"
    }
  ]
}
```

Messages are also embedded under `messages[]` in the `GET /api/cases/{id}` response.

### 4.3 `POST /api/cases/{case_id}/images`

**Multipart form** (not JSON):
- `kind` (text): one of `product | label | packaging | pop`
- `file` (file): JPG/PNG/PDF

```ts
const fd = new FormData();
fd.append("kind", "product");
fd.append("file", fileFromInput);
const resp = await fetch(`${API_BASE}/api/cases/${caseId}/images`, {
  method: "POST",
  body: fd,
});
```

Response:
```json
{
  "image_id": "img_da435610a705",
  "kind": "product",
  "filename": "drive.jpg",
  "classification": {
    "type": "product_image",
    "chat_message": "Thanks for uploading your SanDisk Cruzer Blade!",
    "description": "A SanDisk Cruzer Blade USB flash drive...",
    "tags": ["USB Flash Drive", "Cruzer Blade", "SanDisk"],
    "extracted_text": ["SanDisk", "128GB", "SDCZ50-128G"],
    "fields": [
      { "label": "Brand", "value": "SanDisk" },
      { "label": "Model", "value": "SDCZ50-128G" }
    ],
    "specifications": [
      { "label": "Capacity", "value": "128 GB" },
      { "label": "Country of origin", "value": "Malaysia" }
    ]
  }
}
```

Latency: typically 3-8s per upload (synchronous OCR vision call). Show a spinner; do not block subsequent uploads.

### 4.4 `POST /api/cases/{case_id}/validate`

No request body. Runs the full v2 pipeline against all uploads on the case.

Response (v1-compatible + v2 extensions):
```json
{
  "case_id": "case_055ac366ce7a",
  "validation_id": "val_03da9b590ee0",
  "decision": "human_review",
  "risk_score": 0.15,
  "customer_summary": {
    "headline": "Sent for review",
    "body": "Some of our checks need a closer look...",
    "risk_band": "Low",
    "decision": "human_review",
    "checks": [
      { "name": "SanDisk / WD branding detected", "result": "Passed", "detail": "" },
      { "name": "Capacity code matches claimed capacity", "result": "Passed", "detail": "Batch BP23030119BM matches 128GB" }
    ],
    "warranty": "SanDisk USB Flash Drive — 5 Years coverage",
    "extracted": [
      { "kind": "product", "filename": "back.jpg", "fields": [...] }
    ],
    "next_steps": ["A specialist will review your case...", "..."],
    "v2": {
      "verdict_reasons": ["damage_coverage_review"],
      "damage_observed": true,
      "damage_description": "USB-A connector inner plastic tongue cracked.",
      "product_family": "usb_flash",
      "identified_sku": { "family_prefix": "SDCZ50", "full_sku": "SDCZ50-128G" },
      "playbook_used": "playbook_cruzer_blade_sdcz50.md",
      "counterfeit_tells_matched": [],
      "pop_validation": {
        "vendor_authorized": true,
        "vendor_name": "MAA ENTERPRISE",
        "vendor_gstin": "24KSYPD2272R1ZQ",
        "product_match": true,
        "date_plausible": true,
        "time_delta_days": 10
      },
      "fraud_correlations": [],
      "refinement": {
        "attempted": false,
        "succeeded": false,
        "fields_added": []
      },
      "gaps": [],
      "reason": "Genuine product with physical damage. Damage-coverage policy review required.",
      "recommended_next_action": "escalate_to_damage_policy_review"
    }
  }
}
```

The `customer_summary.v2` block is present **only when the backend has v2 enabled** (`RULE_SET_VERSION=v2`). When absent, just render the legacy fields.

### 4.5 `GET /api/cases/{case_id}`

Returns the full case row: metadata + image list (with OCR payload per image) + validations history. Used by the agent dashboard's case-detail view.

### 4.6 `POST /api/agent/cases/{case_id}/decision`

Request body:
```json
{ "action": "approve | reject | request_info", "notes": "optional string", "agent": "optional, defaults to demo-agent" }
```

Response:
```json
{ "case_id": "...", "action": "approve", "status": "resolved" }
```

This is the operator's verdict on a `human_review` case. The backend records it in the `reviews` table and feeds the learning loop. The case `status` becomes `approved` / `rejected` / `escalated`.

### 4.7 `GET /api/agent/overrides` & `/api/agent/overrides/stats`

Surfaces operator-vs-v2 agreement data. Use for the "Did the AI get it right?" dashboard widget.

```json
// /api/agent/overrides/stats
{
  "total": 47,
  "by_operator_action": { "approve": 28, "reject": 9, "request_info": 10 },
  "by_v2_verdict": { "human_review": 47 },
  "by_rule_set_version": { "v2": 47 },
  "agreement_rate_request_info": 0.213,
  "top_v2_reasons_when_overridden": [
    { "reason": "pop_missing", "count": 18 },
    { "reason": "image_quality_insufficient", "count": 12 },
    { "reason": "damage_coverage_review", "count": 5 }
  ]
}
```

---

## 5. TypeScript type definitions

Copy-paste into your bolt.new project:

```ts
// ---- Shared primitives ----
export type Decision = "auto_approve" | "auto_reject" | "human_review";
export type RiskBand = "Low" | "Medium" | "High";
export type ImageKind = "product" | "label" | "packaging" | "pop";

export interface CheckResult {
  name: string;
  result: "Passed" | "Failed" | "Inconclusive";
  detail?: string;
}

export interface KeyValue {
  label: string;
  value: string;
}

// ---- Create case ----
export type IssueType =
  | "warranty" | "authentication" | "replacement_status" | "troubleshooting" | "general";

export interface CreateCaseRequest {
  issue_type?: IssueType;
  customer_id?: string;
  customer_message?: string;
}
export interface CreateCaseResponse {
  case_id: string;
  issue_type: IssueType | null;
  classified_intent: IssueType | null;  // populated only when backend classified
}

// ---- Chat messages ----
export type MessageRole = "customer" | "assistant" | "system";

export interface ChatMessage {
  message_id: string;
  case_id: string;
  role: MessageRole;
  text: string;
  intent: IssueType | null;
  created_at: string;
}

export interface CreateMessageRequest {
  text: string;
  role?: MessageRole;  // defaults to "customer"
}

// ---- Upload image ----
export type ClassificationType =
  | "product_image" | "label_serial" | "packaging" | "invoice" | "transcript" | "unknown";

export interface Classification {
  type: ClassificationType;
  chat_message: string;
  description: string;
  tags: string[];
  extracted_text: string[];
  fields: KeyValue[];
  specifications: KeyValue[];
}

export interface ImageUploaded {
  image_id: string;
  kind: ImageKind;
  filename: string;
  classification: Classification;
}

// ---- v2 verdict block ----
export interface IdentifiedSku {
  family_prefix: string | null;
  full_sku: string | null;
}

export interface CounterfeitMatch {
  counterfeit_id: string;
  tells_matched_count: number;
  tells_matched: string[];
  page_ref: number | number[] | null;
}

export interface PopValidation {
  vendor_authorized?: boolean;
  vendor_name?: string;
  vendor_gstin?: string;
  product_match?: boolean;
  date_plausible?: boolean;
  time_delta_days?: number;
}

export interface FraudCorrelation {
  pattern: "identical_batch_code" | "sequential_serials";
  severity: "high" | "medium_high" | "medium";
  matched_case_ids: string[];
  matched_values: string[];
  detail: string;
}

export interface Gap {
  missing_data_field: string;
  affected_checks: string[];
  follow_up_action: string;
}

export interface RefinementMeta {
  attempted: boolean;
  succeeded: boolean;
  fields_added: string[];
}

export interface V2Verdict {
  verdict_reasons: string[];
  damage_observed: boolean;
  damage_description: string | null;
  product_family: string;
  identified_sku: IdentifiedSku;
  playbook_used: string | null;
  counterfeit_tells_matched: CounterfeitMatch[];
  pop_validation: PopValidation;
  fraud_correlations: FraudCorrelation[];
  refinement: RefinementMeta;
  gaps: Gap[];
  reason: string;
  recommended_next_action: string;
}

export interface CustomerSummary {
  headline: string;
  body: string;
  risk_band: RiskBand;
  decision: Decision;
  checks: CheckResult[];
  warranty: string | null;
  extracted: Array<{ kind: string; filename: string; fields: KeyValue[] }>;
  next_steps: string[];
  v2?: V2Verdict; // present only when backend runs v2
}

// ---- Validate ----
export interface ValidateResponse {
  case_id: string;
  validation_id: string | null;
  decision: Decision;
  risk_score: number;          // 0-1 (v1-compatible)
  customer_summary: CustomerSummary;
}

// ---- Agent dashboard ----
export interface QueueRow {
  review_id: string;
  case_id: string;
  queued_at: string;
  issue_type: string | null;
  decision: Decision;
  risk_score: number;
  summary: CustomerSummary | null;
}

export interface OverrideRow {
  case_id: string;
  action: "approve" | "reject" | "request_info" | null;
  agent: string | null;
  notes: string | null;
  queued_at: string;
  resolved_at: string;
  rule_set_version: "v1" | "v2";
  v2_verdict: Decision | null;
  v2_verdict_reasons: string[];
  v2_risk_score: number | null;
  agreement: "operator_approved_v2_held_for_review"
    | "operator_rejected_v2_held_for_review"
    | "operator_concurred_more_data_needed"
    | null;
}

export interface OverrideStats {
  total: number;
  by_operator_action: Record<string, number>;
  by_v2_verdict: Record<string, number>;
  by_rule_set_version: Record<string, number>;
  agreement_rate_request_info: number;
  top_v2_reasons_when_overridden: Array<{ reason: string; count: number }>;
}

export interface AgentDecisionRequest {
  action: "approve" | "reject" | "request_info";
  notes?: string;
  agent?: string;
}
```

---

## 6. User flows

### 6.0 Customer chat-input flow (recommended)

The simplest way to support both the 4 pill buttons AND a free-form chat input:

1. Render 4 pill buttons + a text input + "Send" button.
2. **Pill click** → `POST /api/cases` with `{ issue_type: "warranty" }`.
3. **Text submit** → `POST /api/cases` with `{ customer_message: "<typed text>" }`.
4. Both paths return `{ case_id, issue_type, classified_intent }`. Show the customer "Got it, this looks like a `<issue_type>` issue" using `issue_type` (which is either what they picked OR what was classified).
5. After case creation, render the chat thread by polling `GET /api/cases/{id}/messages` (or hold local state of what's been sent).
6. Subsequent customer messages → `POST /api/cases/{id}/messages` with `{ text, role: "customer" }`.
7. Subsequent bot responses (e.g. echoing back what photos to upload) → `POST /api/cases/{id}/messages` with `{ text, role: "assistant" }`.

```tsx
async function handleChatInput(text: string) {
  // Empty case yet? Create it from this message.
  if (!caseId) {
    const r = await api("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_message: text }),
    });
    setCaseId(r.case_id);
    setIssueType(r.issue_type);   // for UI badge / routing
    setMessages([{ role: "customer", text, intent: r.classified_intent }]);
    return;
  }
  // Otherwise append.
  const r = await api(`/api/cases/${caseId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, role: "customer" }),
  });
  setMessages(m => [...m, r]);
}
```

The intent classifier is keyword-based — see `backend/app/agents/intent.py`. Patterns include warranty/coverage/claim → `warranty`; authentic/genuine/fake/counterfeit → `authentication`; rma/replacement/exchange → `replacement_status`; broken/stopped/error/cracked → `troubleshooting`. Anything else → `general`.

### 6.1 Customer flow

1. **Pick issue type** → `POST /api/cases` → store the returned `case_id` in component state.
2. **Upload photos one at a time** → `POST /api/cases/{id}/images` (one call per file). After each upload, the response's `classification.chat_message` is a friendly acknowledgement to show in the chat ("Thanks for uploading your SanDisk Cruzer Blade!").
3. **Run verification** → `POST /api/cases/{id}/validate`. Latency: 5-15s (vision call + rules; longer if the self-correcting refiner kicks in).
4. **Render verdict** → use `response.customer_summary` (legacy fields) + `customer_summary.v2` (new fields when present).
5. **Optional escalate** → `POST /api/cases/{id}/escalate` (if the customer disputes an auto-reject).

```ts
async function submitCase(file1: File, file2: File, invoice: File) {
  const { case_id } = await api("/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_type: "warranty" }),
  });

  for (const [kind, file] of [["product", file1], ["label", file2], ["pop", invoice]] as const) {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    await fetch(`${API_BASE}/api/cases/${case_id}/images`, { method: "POST", body: fd });
  }

  const result = await api(`/api/cases/${case_id}/validate`, { method: "POST" });
  return result as ValidateResponse;
}
```

### 6.2 Agent dashboard flow

1. **Open dashboard** → poll `GET /api/agent/queue` every 10-30s (no SSE/WebSocket yet).
2. **Pick a case** → `GET /api/cases/{id}` for full detail.
3. **Render the v2 reasoning trace** (see §7 below).
4. **Render uploaded images** → `<img src="${API_BASE}/api/cases/${caseId}/images/${imageId}" />` — direct blob serving with auth headers if any.
5. **Submit decision** → `POST /api/agent/cases/{id}/decision`. Refresh the queue.
6. **Show learning-loop stats** → `GET /api/agent/overrides/stats` on the dashboard summary card.

---

## 7. Component → field mapping

Translate v2 response fields into UI elements. The recommended layout for the customer-facing summary:

| UI element | Source field | Notes |
|---|---|---|
| Headline + body | `customer_summary.headline` / `body` | Pre-written friendly copy |
| Risk band badge | `customer_summary.risk_band` | Color: Low=green, Medium=amber, High=rose |
| Verdict pill | `customer_summary.decision` | auto_approve / human_review / auto_reject |
| Checks list | `customer_summary.checks[]` | Each `{name, result, detail}` |
| Warranty line | `customer_summary.warranty` | Hide if null |
| Next steps | `customer_summary.next_steps[]` | Bulleted action list |
| Per-photo extraction view | `customer_summary.extracted[]` | One card per upload |

Customer-facing **v2 extras** (under `customer_summary.v2`):

| UI element | Source field | When to show |
|---|---|---|
| Damage callout banner | `v2.damage_observed` + `v2.damage_description` | Show prominently when `damage_observed: true` |
| "We need…" panel | `v2.gaps[]` | One row per gap, surface `follow_up_action` as button label |
| Verdict-reason summary | `v2.reason` | One short sentence above the checks list |
| Next-action CTA | `v2.recommended_next_action` | Use to drive the primary button text |

Agent-facing **v2 extras** (rendered on the dashboard case detail):

| UI element | Source field | Notes |
|---|---|---|
| Playbook reference | `v2.playbook_used` | Link / tooltip to the playbook MD if available |
| SKU identification | `v2.identified_sku.family_prefix` + `full_sku` | "Detected: SDCZ50 (SanDisk Cruzer Blade)" |
| Counterfeit tells | `v2.counterfeit_tells_matched[]` | Each entry has `counterfeit_id`, `tells_matched[]`, `page_ref` linking back to auth guide page |
| Fraud-ring callout | `v2.fraud_correlations[]` | **HIGH visibility** — link to each `matched_case_ids[]` |
| POP validation grid | `v2.pop_validation` | vendor authorized? product match? date plausible? |
| Refinement trace | `v2.refinement.fields_added[]` | "OCR found these on second pass: [serial_number]" |
| Verdict reasons (raw) | `v2.verdict_reasons[]` | List of canonical codes — map to human copy (see §8) |

---

## 8. `verdict_reasons[]` humanization

The backend emits machine-readable codes (e.g. `damage_coverage_review`, `capacity_code_anomaly_needs_stamp_verification`). The frontend should humanize them. Recommended mapping:

```ts
const REASON_COPY: Record<string, string> = {
  // Auto-reject
  "capacity_code_structurally_invalid": "Batch code uses an invalid capacity prefix.",
  "capacity_code_anomaly_with_corroborating_tells": "Capacity-code anomaly combined with other counterfeit signals.",
  "multiple_counterfeit_tells_matched": "Multiple counterfeit tells matched the known-fakes catalog.",
  "multiple_critical_checks_failed": "Multiple critical validation checks failed.",
  "critical_check_failed": "A critical validation check failed.",
  "pop_product_mismatch": "Invoice product doesn't match the photos.",
  "pop_date_before_claim_impossible": "Invoice date is after the case-open date.",
  "fraud_ring_identical_batch_code_across_cases": "Same batch code is on another recent case — possible fraud ring.",
  // Human review
  "capacity_code_anomaly_needs_stamp_verification": "Capacity-code anomaly; cross-check with STAMP/Warranty Status Web.",
  "multiple_counterfeit_tells_matched_low_confidence": "Possible counterfeit (2 tells matched) — review.",
  "one_counterfeit_tell_matched": "Single counterfeit tell matched — low-signal review.",
  "damage_coverage_review": "Physical damage observed — damage-coverage policy review required.",
  "image_quality_insufficient": "One or more checks were inconclusive due to image quality.",
  "validation_check_failed": "A soft validation check failed.",
  "pop_missing": "No proof of purchase supplied.",
  "vendor_unauthorized": "Invoice is from an unauthorized reseller.",
  "no_product_images": "No product photos uploaded.",
  "fraud_ring_sequential_serials_across_cases": "Near-sequential serial numbers across cases — mass-counterfeit run signal.",
  "fraud_ring_correlation_detected": "Cross-case correlation detected; review related cases.",
};
```

The canonical list lives at `backend/app/agents/prompts/auth_rules_glossary.md` — keep this in sync if rules change.

---

## 9. Error handling

| Status | Meaning | Frontend behavior |
|---|---|---|
| 200 | Success | Render the response |
| 400 | Bad input (unknown image kind, malformed body) | Inline error, don't retry |
| 404 | Case/image not found | Redirect home or reload list |
| 422 | Pydantic validation failure | Show specific error from `detail[]` |
| 500 | Backend error | Show retry banner, allow user retry |
| network failure | Backend unreachable | Show offline indicator |

Long requests:
- `POST /images` — 3-8s typical (one vision call). Show spinner per upload.
- `POST /validate` — 5-15s typical. If v2 refinement triggers, can extend to 20s. Show progress: "Reading drive… Running checks… Cross-checking other cases…"

Recommended timeouts:
- Health/lightweight reads: 5s
- Uploads: 30s
- Validate: 45s

---

## 10. Things to know about v2 specifically

These are quirks the bolt.new dev should be aware of, not bugs:

- **`risk_score` is 0-1** in the top-level response (v1 compat) but `0-100` inside the `v2` block. The `risk_band` field is always Low/Medium/High; prefer that for UI.
- **`damage_observed: true` does NOT mean auto-reject.** Genuine damaged drives route to `human_review` with `damage_coverage_review` reason for warranty policy review.
- **A case with no POP defaults to `human_review`** with `pop_missing` reason. The customer hasn't done anything wrong — they just haven't uploaded the receipt yet.
- **`gaps[]` are actionable; `verdict_reasons[]` are explanatory.** Drive UI primary CTAs off `gaps[].follow_up_action` (e.g. `request_sharper_back_of_drive_photo` → button "Add a clearer photo of the back").
- **`fraud_correlations[]` is empty unless cross-case data exists.** First few demo submissions will never trigger it; you need ≥2 cases with shared batch codes for it to fire.
- **`refinement.attempted: true` + `succeeded: false`** means the backend tried a second OCR pass but the field genuinely isn't in the photos — that's a signal to ask the customer to retake, not a bug.
- **Invoice OCR returns `invoice_fields[]` (new in v2.2)** — when an uploaded PDF or photo is classified as `pop_invoice`, the OCR populates a structured `invoice_fields: [{label, value}, ...]` array on the per-image OCR payload. Typical labels: `Invoice Number`, `Invoice Date`, `Sold By`, `Seller GSTIN`, `Buyer Name`, `Total`, `Taxable Value`, `IGST`, `HSN`, `Channel`, `Product Description`. The backend reads these directly in `validate_pop` (no regex), so the frontend can display them confidently. For product photos this array is empty; product specs go in `specifications[]` as before.

---

## 11. Open questions / things NOT in scope

- **Authentication**: there is currently no auth on the API. Wide open. Production deployment must add API-key or JWT middleware. bolt.new dev: no auth header needed.
- **Real-time updates**: agent dashboard must poll `/api/agent/queue`. No WebSocket/SSE yet.
- **Image storage**: blobs live on disk at `backend/uploads/`. For multi-instance deploy, move to S3/Azure Blob.
- **STAMP integration**: `capacity_code_anomaly_needs_stamp_verification` recommends a STAMP lookup — currently a manual step. If the bolt.new app gets STAMP credentials, surface "Check in STAMP" as a button.
- **Vendor authorization registry**: `pop_validation.vendor_authorized` is a binary "is Flipkart-or-sandisk.com" today. Per-seller GSTIN allow-list is Phase 2.
- **More SKU playbooks**: today's coverage = SDCZ50, SDCZ74, SDCZ73, SDCZ460, SDDDC3, Extreme PRO microSD. Submissions outside these families get the family-level fallback rules.

---

## 12. Minimal worked example

A complete customer flow in ~30 lines of TS:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function submitWarrantyCase(files: { product: File; back: File; invoice: File }) {
  // 1. Create case
  const create = await fetch(`${API_BASE}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_type: "warranty" }),
  }).then(r => r.json());
  const caseId = create.case_id;

  // 2. Upload (sequential — show per-photo feedback as each lands)
  for (const [kind, file] of [["product", files.product], ["label", files.back], ["pop", files.invoice]] as const) {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    const up = await fetch(`${API_BASE}/api/cases/${caseId}/images`, { method: "POST", body: fd })
      .then(r => r.json());
    console.log(up.classification.chat_message);
  }

  // 3. Validate
  const result = await fetch(`${API_BASE}/api/cases/${caseId}/validate`, { method: "POST" })
    .then(r => r.json());

  // 4. Render
  const cs = result.customer_summary;
  console.log(`Verdict: ${cs.decision}  Risk: ${cs.risk_band}`);
  console.log(`Reason: ${cs.v2?.reason ?? cs.body}`);
  cs.checks.forEach(c => console.log(`  ${c.result === "Passed" ? "✓" : "✗"} ${c.name}`));
  if (cs.v2?.damage_observed) {
    console.warn(`Damage: ${cs.v2.damage_description}`);
  }
  if (cs.v2?.gaps.length) {
    console.warn(`We need: ${cs.v2.gaps.map(g => g.follow_up_action).join(", ")}`);
  }

  return result;
}
```

That's the entire integration surface. Drop it in, hand it to bolt.new with this PRD, and the agent should be able to wire the UI directly.

---

# Addendum A (2026-05-22) — Authenticity engine: authentic references, capacity-code check, and the call-flow

This addendum covers three capabilities added after the original PRD. They change the verdict logic and add response fields; everything below is additive (existing fields unchanged).

## A.1 The call flow this implements

Bolt is also being given the **Call_flow Chart** image. The backend implements the **"Verify Product Authenticity"** node of that flow. Map it like this:

```
Start
 → Capture Customer Details (Bolt UI: name/email/contact + the chat input from §6.0)
 → Verify Product Authenticity   ←★ THIS is POST /api/cases/{id}/validate
 → Troubleshoot Issue            (Bolt UI / future)
 → Issue Resolved?  Yes → educate + close   No ↓
 → Educate About Replacement
 → Check Invoice & Warranty      (uses pop_validation + invoice_fields from the verdict)
 → Eligible for Warranty?  Yes → Process RMA   No → Inform Warranty Void
```

Key point for Bolt: **authentication and warranty-eligibility are two different decisions.** The `validate` verdict answers "is it genuine?" Damage/warranty checks happen *after* (the "Check Invoice & Warranty" node). So a genuine-but-damaged product still passes authentication — see A.3.

## A.2 Authentic-reference fast path

The backend ships a curated set of **known-genuine reference images** (`Training files/authentic/`). When a customer uploads one of those exact files (byte-for-byte), the backend recognizes it instantly and returns `auto_approve` — skipping all the counterfeit checks, because the product is already confirmed genuine.

The verdict carries a new block:

```json
"customer_summary": {
  "v2": {
    "authentic_reference": {
      "matched": true,
      "product": "SanDisk Ultra Eco USB 3.2 Flash Drive 256GB",
      "sku": "SDCZ550-256G"
    },
    "verdict_reasons": ["matched_authentic_reference"],
    ...
  }
}
```

**Bolt UX:** when `authentic_reference.matched === true`, show a green "Verified authentic — <product>" badge and proceed straight to the next step in the call flow. The 4 currently-registered authentic products: `SDCZ550-256G` (Ultra Eco USB), `SDSQUA4-256G` + `SDSQUAC-256G` (Ultra microSDXC), `SDCZ71-032G` (Cruzer Force).

The knowledge base of these products lives at `Training files/authentic/authentic_references.json` (sku → product name, family, file hashes, extracted specs) if Bolt wants to display catalog details.

## A.3 Capacity-code (CC) check — the fast counterfeit screen

Per SanDisk's authentication guide (Manufacturing Codes, p70): *"Many counterfeit products can be quickly identified if [the capacity] code does not match the capacity labeled on the product."* The backend now enforces this strictly.

**How it works:** every SanDisk product carries a 2-letter **capacity code (CC)** as the first characters of its manufacturing/batch code. On USB drives it's the first 2 chars of the batch code (`BQ2406003755W` → `BQ`); on microSD/SD it's a standalone token before "MADE IN" (`BQ MADE IN CHINA`). The CC maps to a capacity (BM=32GB, BN=64GB, BP=128GB, BQ=256GB, BR=512GB, CA=1TB, …). The backend compares the CC's capacity to the labeled capacity:

| Situation | Verdict | `verdict_reasons` entry |
|---|---|---|
| CC present and **matches** labeled capacity | passes this check (continues) | — |
| CC present but **maps to a different capacity** | `auto_reject` | `capacity_code_mismatch` |
| CC present but **not in the SanDisk table** at all | `auto_reject` | `capacity_code_structurally_invalid` |
| CC **not detectable** (blurry, not in frame) | `human_review` | `image_quality_insufficient` (gap surfaced) |

Real example: every counterfeit USB in the test set is labeled 64GB or 256GB but carries a `BP` (=128GB) batch code → `capacity_code_mismatch` → `auto_reject`.

**Bolt UX:**
- `capacity_code_mismatch` / `capacity_code_structurally_invalid` → show a red "Failed authentication — capacity code doesn't match" result with the human-readable `reason`.
- Missing code (`human_review`) → show "We couldn't read the product code — please upload a sharper photo of the back" using the `gaps[]` follow-up action.

## A.4 Verdict-reason additions

Add these to the `REASON_COPY` map from §8:

```ts
const REASON_COPY_ADDENDUM: Record<string, string> = {
  "matched_authentic_reference": "Verified against a known-authentic SanDisk product — confirmed genuine.",
  "capacity_code_mismatch": "The capacity code on the product doesn't match its labeled capacity — counterfeit.",
  "capacity_code_structurally_invalid": "The capacity code isn't a valid SanDisk code — counterfeit.",
};
```

## A.5 TypeScript additions

```ts
export interface AuthenticReference {
  matched: boolean;
  product: string;   // e.g. "SanDisk Ultra Eco USB 3.2 Flash Drive 256GB"
  sku: string;       // e.g. "SDCZ550-256G"
}

// Add to the V2Verdict interface:
//   authentic_reference?: AuthenticReference | null;
```

`authentic_reference` is `null` (or absent) for normal submissions; populated only when an authentic-reference fast-path match occurs.

## A.6 Demo script (what to expect when testing)

| Upload | Result | What Bolt shows |
|---|---|---|
| Any file from `Training files/authentic/` | `auto_approve` + `matched_authentic_reference` | Green "Verified authentic — <product>" |
| Counterfeit USB (labeled 256GB, BP batch code) | `auto_reject` + `capacity_code_mismatch` | Red "Capacity code mismatch — counterfeit" |
| Product photo with no readable code | `human_review` + `image_quality_insufficient` | "Please upload a sharper photo of the product code" |
| Genuine product photo, code matches, with invoice | `auto_approve` (or `human_review` if no playbook/POP) | Proceeds to warranty step |

No backend changes are needed for Bolt to use any of this — it's all in the existing `POST /api/cases/{id}/validate` response under `customer_summary.v2`.
