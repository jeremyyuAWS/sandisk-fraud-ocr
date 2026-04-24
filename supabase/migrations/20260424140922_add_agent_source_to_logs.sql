/*
  # Add agent_source column to agent_logs

  1. Modified Tables
    - `agent_logs`
      - Added `agent_source` (text, nullable) - identifies which agent produced the log entry
        Values: 'ocr', 'validator', 'managerial'

  2. Notes
    - Nullable so existing rows remain valid
    - No RLS changes needed (table already has policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_logs' AND column_name = 'agent_source'
  ) THEN
    ALTER TABLE agent_logs ADD COLUMN agent_source text;
  END IF;
END $$;
