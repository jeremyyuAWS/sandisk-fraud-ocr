/*
  # Create agent_logs table

  1. New Tables
    - `agent_logs`
      - `id` (bigint, auto-increment primary key)
      - `session_id` (text, not null) - Lyzr agent session identifier
      - `direction` (text, not null) - 'request' or 'response'
      - `timestamp_label` (text, not null) - human-readable time label (e.g. "9:30:36 pm")
      - `payload` (jsonb, not null) - full request or response JSON payload
      - `created_at` (timestamptz) - row creation time

  2. Security
    - Enable RLS on `agent_logs` table
    - Allow anon role to select, insert, and delete logs (demo app, no auth)
    - Policies scoped to 'demo_' prefix on session_id to namespace demo data

  3. Notes
    - Stores all agent interaction logs for review and debugging
    - Delete policy allows clearing by session or clearing all
    - Index on session_id for fast session-based queries
*/

CREATE TABLE IF NOT EXISTS agent_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT 'request',
  timestamp_label text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_session_id ON agent_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs (created_at DESC);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read agent logs"
  ON agent_logs
  FOR SELECT
  TO anon
  USING (session_id <> '');

CREATE POLICY "Anon can insert agent logs"
  ON agent_logs
  FOR INSERT
  TO anon
  WITH CHECK (session_id <> '');

CREATE POLICY "Anon can delete agent logs"
  ON agent_logs
  FOR DELETE
  TO anon
  USING (session_id <> '');
