/*
  # Create validation_results table

  Stores structured validation reports from the Validator agent for audit
  and client-facing display.

  1. New Tables
    - `validation_results`
      - `id` (bigint, auto-increment primary key)
      - `session_id` (text) - links to the chat session
      - `agent_id` (text) - which validator agent produced the result
      - `user_id` (text) - ephemeral user for this session
      - `input_summary` (text) - short label of what was validated
      - `raw_result` (jsonb) - full raw JSON from the Validator (audit trail)
      - `checks` (jsonb) - normalized array of { name, status, detail } objects
      - `overall_status` (text) - "approved" / "flagged" / "rejected"
      - `created_at` (timestamptz) - when the result was stored

  2. Indexes
    - session_id for filtering by session
    - created_at DESC for ordering

  3. Security
    - Enable RLS on `validation_results` table
    - Add policies for anon select, insert, and delete (matching agent_logs pattern)
*/

CREATE TABLE IF NOT EXISTS validation_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL DEFAULT '',
  agent_id text NOT NULL DEFAULT '',
  user_id text NOT NULL DEFAULT '',
  input_summary text NOT NULL DEFAULT '',
  raw_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_status text NOT NULL DEFAULT 'flagged',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_results_session_id ON validation_results (session_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_created_at ON validation_results (created_at DESC);

ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read validation results"
  ON validation_results
  FOR SELECT
  TO anon
  USING (session_id <> '');

CREATE POLICY "Anon can insert validation results"
  ON validation_results
  FOR INSERT
  TO anon
  WITH CHECK (session_id <> '');

CREATE POLICY "Anon can delete validation results"
  ON validation_results
  FOR DELETE
  TO anon
  USING (session_id <> '');
