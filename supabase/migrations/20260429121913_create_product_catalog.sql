/*
  # Create Product Catalog Table

  1. New Tables
    - `product_catalog`
      - `id` (serial, primary key)
      - `sku` (text, unique) - e.g. "SDCZ50-032G-B35"
      - `product_name` (text) - full product name
      - `brand` (text) - e.g. "SanDisk"
      - `category` (text) - e.g. "USB Flash Drive"
      - `product_family` (text) - e.g. "Cruzer Series"
      - `internal_model_id` (text) - e.g. "TAD-SDCZ50"
      - `manufacturer_part_number` (text) - e.g. "SDCZ50-032G"
      - `capacity` (text) - e.g. "32GB"
      - `form_factor` (text) - e.g. "USB Drive"
      - `connector_type` (text) - e.g. "USB-A"
      - `interface` (text) - e.g. "USB 2.0"
      - `color_variant` (text) - e.g. "Red / Black"
      - `material_finish` (text) - physical material description
      - `country_of_manufacture` (text) - e.g. "Malaysia"
      - `warranty_years` (integer) - warranty period
      - `expected_markings` (jsonb) - array of expected text on the physical product
      - `visual_description` (text) - physical appearance description
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `product_catalog` table
    - Add read-only policy for authenticated users
    - Add read-only policy for anon users (public catalog data)

  3. Seed Data
    - SanDisk Cruzer Blade 32GB (Red) - SDCZ50-032G-B35
    - SanDisk Cruzer Blade 32GB (Electric Blue) - SDCZ50-032G-B46
    - SanDisk Cruzer Blade 64GB (Red) - SDCZ50-064G-B35
    - SanDisk Cruzer Blade 128GB (Red) - SDCZ50-128G-B35
*/

CREATE TABLE IF NOT EXISTS product_catalog (
  id serial PRIMARY KEY,
  sku text UNIQUE NOT NULL,
  product_name text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT 'SanDisk',
  category text NOT NULL DEFAULT '',
  product_family text NOT NULL DEFAULT '',
  internal_model_id text NOT NULL DEFAULT '',
  manufacturer_part_number text NOT NULL DEFAULT '',
  capacity text NOT NULL DEFAULT '',
  form_factor text NOT NULL DEFAULT '',
  connector_type text NOT NULL DEFAULT '',
  interface text NOT NULL DEFAULT '',
  color_variant text NOT NULL DEFAULT '',
  material_finish text NOT NULL DEFAULT '',
  country_of_manufacture text NOT NULL DEFAULT '',
  warranty_years integer NOT NULL DEFAULT 2,
  expected_markings jsonb NOT NULL DEFAULT '[]'::jsonb,
  visual_description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read product catalog"
  ON product_catalog
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anonymous users can read product catalog"
  ON product_catalog
  FOR SELECT
  TO anon
  USING (true);

-- Seed: SanDisk Cruzer Blade 32GB Red
INSERT INTO product_catalog (
  sku, product_name, brand, category, product_family,
  internal_model_id, manufacturer_part_number,
  capacity, form_factor, connector_type, interface,
  color_variant, material_finish, country_of_manufacture,
  warranty_years, expected_markings, visual_description
) VALUES (
  'SDCZ50-032G-B35',
  'SanDisk Cruzer Blade 32GB USB Flash Drive',
  'SanDisk',
  'USB Flash Drive',
  'Cruzer Series',
  'TAD-SDCZ50',
  'SDCZ50-032G',
  '32GB',
  'USB Drive',
  'USB-A',
  'USB 2.0',
  'Red / Black',
  'Matte red plastic body with black USB-A connector',
  'Malaysia',
  2,
  '["Cruzer Blade 32GB", "FC", "CE", "TAD-SDCZ50", "SDCZ50-032G", "MADE IN MALAYSIA"]'::jsonb,
  'Small rectangular USB flash drive with red matte plastic body, black USB-A connector, and a lanyard loop on the rounded end. White text printed on the red body.'
) ON CONFLICT (sku) DO NOTHING;

-- Seed: SanDisk Cruzer Blade 32GB Electric Blue
INSERT INTO product_catalog (
  sku, product_name, brand, category, product_family,
  internal_model_id, manufacturer_part_number,
  capacity, form_factor, connector_type, interface,
  color_variant, material_finish, country_of_manufacture,
  warranty_years, expected_markings, visual_description
) VALUES (
  'SDCZ50-032G-B46',
  'SanDisk Cruzer Blade 32GB USB Flash Drive',
  'SanDisk',
  'USB Flash Drive',
  'Cruzer Series',
  'TAD-SDCZ50',
  'SDCZ50-032G',
  '32GB',
  'USB Drive',
  'USB-A',
  'USB 2.0',
  'Electric Blue / Black',
  'Matte blue plastic body with black USB-A connector',
  'Malaysia',
  2,
  '["Cruzer Blade 32GB", "FC", "CE", "TAD-SDCZ50", "SDCZ50-032G", "MADE IN MALAYSIA"]'::jsonb,
  'Small rectangular USB flash drive with electric blue matte plastic body, black USB-A connector, and a lanyard loop on the rounded end. White text printed on the blue body.'
) ON CONFLICT (sku) DO NOTHING;

-- Seed: SanDisk Cruzer Blade 64GB Red
INSERT INTO product_catalog (
  sku, product_name, brand, category, product_family,
  internal_model_id, manufacturer_part_number,
  capacity, form_factor, connector_type, interface,
  color_variant, material_finish, country_of_manufacture,
  warranty_years, expected_markings, visual_description
) VALUES (
  'SDCZ50-064G-B35',
  'SanDisk Cruzer Blade 64GB USB Flash Drive',
  'SanDisk',
  'USB Flash Drive',
  'Cruzer Series',
  'TAD-SDCZ50',
  'SDCZ50-064G',
  '64GB',
  'USB Drive',
  'USB-A',
  'USB 2.0',
  'Red / Black',
  'Matte red plastic body with black USB-A connector',
  'Malaysia',
  2,
  '["Cruzer Blade 64GB", "FC", "CE", "TAD-SDCZ50", "SDCZ50-064G", "MADE IN MALAYSIA"]'::jsonb,
  'Small rectangular USB flash drive with red matte plastic body, black USB-A connector, and a lanyard loop on the rounded end. White text printed on the red body.'
) ON CONFLICT (sku) DO NOTHING;

-- Seed: SanDisk Cruzer Blade 128GB Red
INSERT INTO product_catalog (
  sku, product_name, brand, category, product_family,
  internal_model_id, manufacturer_part_number,
  capacity, form_factor, connector_type, interface,
  color_variant, material_finish, country_of_manufacture,
  warranty_years, expected_markings, visual_description
) VALUES (
  'SDCZ50-128G-B35',
  'SanDisk Cruzer Blade 128GB USB Flash Drive',
  'SanDisk',
  'USB Flash Drive',
  'Cruzer Series',
  'TAD-SDCZ50',
  'SDCZ50-128G',
  '128GB',
  'USB Drive',
  'USB-A',
  'USB 2.0',
  'Red / Black',
  'Matte red plastic body with black USB-A connector',
  'Malaysia',
  2,
  '["Cruzer Blade 128GB", "FC", "CE", "TAD-SDCZ50", "SDCZ50-128G", "MADE IN MALAYSIA"]'::jsonb,
  'Small rectangular USB flash drive with red matte plastic body, black USB-A connector, and a lanyard loop on the rounded end. White text printed on the red body.'
) ON CONFLICT (sku) DO NOTHING;