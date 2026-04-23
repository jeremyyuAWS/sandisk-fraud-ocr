/*
  # Create ws_events table for raw WebSocket activity

  1. New Tables
    - `ws_events`
      - `id` (bigint, auto-increment primary key)
      - `session_id` (text, not null) - Lyzr agent session identifier
      - `payload` (jsonb, not null) - full raw WebSocket message JSON
      - `event_type` (text) - extracted event_type field for filtering
      - `level` (text) - extracted log level (DEBUG, INFO, WARN, ERROR)
      - `agent_name` (text) - extracted agent_name for display
      - `created_at` (timestamptz) - row creation time

  2. Security
    - Enable RLS on `ws_events` table
    - Allow anon role to select, insert, and delete (demo app)

  3. Notes
    - Stores every raw WebSocket message for debugging and inspection
    - Indexes on session_id and created_at for fast lookups
*/

CREATE TABLE IF NOT EXISTS ws_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_type text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT '',
  agent_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ws_events_session_id ON ws_events (session_id);
CREATE INDEX IF NOT EXISTS idx_ws_events_created_at ON ws_events (created_at DESC);

ALTER TABLE ws_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read ws events"
  ON ws_events
  FOR SELECT
  TO anon
  USING (session_id <> '');

CREATE POLICY "Anon can insert ws events"
  ON ws_events
  FOR INSERT
  TO anon
  WITH CHECK (session_id <> '');

CREATE POLICY "Anon can delete ws events"
  ON ws_events
  FOR DELETE
  TO anon
  USING (session_id <> '');
