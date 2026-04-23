/*
  # Create app_config table

  1. New Tables
    - `app_config`
      - `key` (text, primary key) - configuration key identifier
      - `value` (jsonb) - configuration value stored as JSON
      - `updated_at` (timestamptz) - last update timestamp

  2. Security
    - Enable RLS on `app_config` table
    - Allow anon role to read config entries scoped to 'lyzr_' prefix
    - Allow anon role to insert config entries scoped to 'lyzr_' prefix
    - Allow anon role to update config entries scoped to 'lyzr_' prefix

  3. Notes
    - Used for persisting demo app settings (Lyzr agent config) across deployments
    - Policies restrict access to only 'lyzr_' prefixed keys for the anon role
*/

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read lyzr config"
  ON app_config
  FOR SELECT
  TO anon
  USING (key LIKE 'lyzr_%');

CREATE POLICY "Anon can insert lyzr config"
  ON app_config
  FOR INSERT
  TO anon
  WITH CHECK (key LIKE 'lyzr_%');

CREATE POLICY "Anon can update lyzr config"
  ON app_config
  FOR UPDATE
  TO anon
  USING (key LIKE 'lyzr_%')
  WITH CHECK (key LIKE 'lyzr_%');
