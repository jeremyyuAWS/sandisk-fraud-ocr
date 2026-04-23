export type AppView = "support" | "agent"

export type ChatStep =
  | "closed"
  | "welcome"
  | "issue-select"
  | "warranty-subtype"
  | "serial-entry"
  | "warranty-lookup"
  | "image-request"
  | "upload-preview"
  | "ocr-processing"
  | "ocr-result"
  | "escalation"
