/*
  # Seed Additional SanDisk Products

  Adds products across multiple categories to the product_catalog table:

  1. USB Flash Drives
    - SanDisk Ultra Flair USB 3.0 (32GB, 64GB, 128GB, 256GB, 512GB)
    - SanDisk Ultra Fit USB 3.2 (32GB, 64GB, 128GB, 256GB, 512GB)
    - SanDisk Extreme Go USB 3.2 (64GB, 128GB, 256GB)
    - SanDisk Ultra Dual Drive Go USB Type-C (64GB, 128GB, 256GB)
    - SanDisk Cruzer Glide USB 2.0 (32GB, 64GB, 128GB)

  2. Portable SSDs
    - SanDisk Extreme Portable SSD V2 (500GB, 1TB, 2TB, 4TB)
    - SanDisk Extreme PRO Portable SSD V2 (1TB, 2TB, 4TB)

  3. Memory Cards
    - SanDisk Extreme PRO microSDXC UHS-I (64GB, 128GB, 256GB, 512GB, 1TB)
    - SanDisk Extreme microSDXC UHS-I (64GB, 128GB, 256GB, 512GB)
    - SanDisk Ultra microSDXC UHS-I (32GB, 64GB, 128GB, 256GB, 512GB)

  4. Internal SSDs
    - SanDisk Ultra 3D NAND SATA SSD (500GB, 1TB, 2TB, 4TB)

  All entries include expected physical markings for OCR validation matching.
*/

-- =========================================================================
-- USB FLASH DRIVES: SanDisk Ultra Flair USB 3.0
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDCZ73-032G-G46', 'SanDisk Ultra Flair 32GB USB 3.0 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Flair Series', 'SDCZ73', 'SDCZ73-032G', '32GB', 'USB Drive', 'USB-A', 'USB 3.0', 'Silver / Black', 'Brushed metal casing with black plastic trim', 'China', 5, '["Ultra Flair 32GB", "USB 3.0", "SDCZ73-032G", "SDCZ73", "150MB/s"]'::jsonb, 'Compact sleek metal casing USB flash drive with silver brushed finish, black USB-A connector end, and small loop for lanyard attachment.'),
('SDCZ73-064G-G46', 'SanDisk Ultra Flair 64GB USB 3.0 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Flair Series', 'SDCZ73', 'SDCZ73-064G', '64GB', 'USB Drive', 'USB-A', 'USB 3.0', 'Silver / Black', 'Brushed metal casing with black plastic trim', 'China', 5, '["Ultra Flair 64GB", "USB 3.0", "SDCZ73-064G", "SDCZ73", "150MB/s"]'::jsonb, 'Compact sleek metal casing USB flash drive with silver brushed finish, black USB-A connector end, and small loop for lanyard attachment.'),
('SDCZ73-128G-G46', 'SanDisk Ultra Flair 128GB USB 3.0 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Flair Series', 'SDCZ73', 'SDCZ73-128G', '128GB', 'USB Drive', 'USB-A', 'USB 3.0', 'Silver / Black', 'Brushed metal casing with black plastic trim', 'China', 5, '["Ultra Flair 128GB", "USB 3.0", "SDCZ73-128G", "SDCZ73", "150MB/s"]'::jsonb, 'Compact sleek metal casing USB flash drive with silver brushed finish, black USB-A connector end, and small loop for lanyard attachment.'),
('SDCZ73-256G-G46', 'SanDisk Ultra Flair 256GB USB 3.0 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Flair Series', 'SDCZ73', 'SDCZ73-256G', '256GB', 'USB Drive', 'USB-A', 'USB 3.0', 'Silver / Black', 'Brushed metal casing with black plastic trim', 'China', 5, '["Ultra Flair 256GB", "USB 3.0", "SDCZ73-256G", "SDCZ73", "150MB/s"]'::jsonb, 'Compact sleek metal casing USB flash drive with silver brushed finish, black USB-A connector end, and small loop for lanyard attachment.'),
('SDCZ73-512G-G46', 'SanDisk Ultra Flair 512GB USB 3.0 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Flair Series', 'SDCZ73', 'SDCZ73-512G', '512GB', 'USB Drive', 'USB-A', 'USB 3.0', 'Silver / Black', 'Brushed metal casing with black plastic trim', 'China', 5, '["Ultra Flair 512GB", "USB 3.0", "SDCZ73-512G", "SDCZ73", "150MB/s"]'::jsonb, 'Compact sleek metal casing USB flash drive with silver brushed finish, black USB-A connector end, and small loop for lanyard attachment.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- USB FLASH DRIVES: SanDisk Ultra Fit USB 3.2
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDCZ430-032G-G46', 'SanDisk Ultra Fit 32GB USB 3.2 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Fit Series', 'SDCZ430', 'SDCZ430-032G', '32GB', 'USB Drive (Nano)', 'USB-A', 'USB 3.2 Gen 1', 'Black', 'Matte black plastic ultra-compact body', 'China', 5, '["Ultra Fit 32GB", "USB 3.2", "SDCZ430-032G", "SDCZ430", "400MB/s"]'::jsonb, 'Ultra-compact nano USB flash drive with matte black body, barely protrudes from USB port. Small enough to plug in and leave.'),
('SDCZ430-064G-G46', 'SanDisk Ultra Fit 64GB USB 3.2 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Fit Series', 'SDCZ430', 'SDCZ430-064G', '64GB', 'USB Drive (Nano)', 'USB-A', 'USB 3.2 Gen 1', 'Black', 'Matte black plastic ultra-compact body', 'China', 5, '["Ultra Fit 64GB", "USB 3.2", "SDCZ430-064G", "SDCZ430", "400MB/s"]'::jsonb, 'Ultra-compact nano USB flash drive with matte black body, barely protrudes from USB port. Small enough to plug in and leave.'),
('SDCZ430-128G-G46', 'SanDisk Ultra Fit 128GB USB 3.2 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Fit Series', 'SDCZ430', 'SDCZ430-128G', '128GB', 'USB Drive (Nano)', 'USB-A', 'USB 3.2 Gen 1', 'Black', 'Matte black plastic ultra-compact body', 'China', 5, '["Ultra Fit 128GB", "USB 3.2", "SDCZ430-128G", "SDCZ430", "400MB/s"]'::jsonb, 'Ultra-compact nano USB flash drive with matte black body, barely protrudes from USB port. Small enough to plug in and leave.'),
('SDCZ430-256G-G46', 'SanDisk Ultra Fit 256GB USB 3.2 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Fit Series', 'SDCZ430', 'SDCZ430-256G', '256GB', 'USB Drive (Nano)', 'USB-A', 'USB 3.2 Gen 1', 'Black', 'Matte black plastic ultra-compact body', 'China', 5, '["Ultra Fit 256GB", "USB 3.2", "SDCZ430-256G", "SDCZ430", "400MB/s"]'::jsonb, 'Ultra-compact nano USB flash drive with matte black body, barely protrudes from USB port. Small enough to plug in and leave.'),
('SDCZ430-512G-G46', 'SanDisk Ultra Fit 512GB USB 3.2 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Ultra Fit Series', 'SDCZ430', 'SDCZ430-512G', '512GB', 'USB Drive (Nano)', 'USB-A', 'USB 3.2 Gen 1', 'Black', 'Matte black plastic ultra-compact body', 'China', 5, '["Ultra Fit 512GB", "USB 3.2", "SDCZ430-512G", "SDCZ430", "400MB/s"]'::jsonb, 'Ultra-compact nano USB flash drive with matte black body, barely protrudes from USB port. Small enough to plug in and leave.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- USB FLASH DRIVES: SanDisk Extreme Go USB 3.2
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDCZ810-064G-G46', 'SanDisk Extreme Go 64GB USB 3.2 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Extreme Go Series', 'SDCZ810', 'SDCZ810-064G', '64GB', 'USB Drive', 'USB-A', 'USB 3.2 Gen 1', 'Black', 'Rubberized matte black body with retractable connector', 'China', 5, '["Extreme Go 64GB", "USB 3.2", "SDCZ810-064G", "SDCZ810", "395MB/s"]'::jsonb, 'Slim black USB flash drive with rubberized coating, retractable USB-A connector with thumb-slide mechanism, SanDisk red accent stripe.'),
('SDCZ810-128G-G46', 'SanDisk Extreme Go 128GB USB 3.2 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Extreme Go Series', 'SDCZ810', 'SDCZ810-128G', '128GB', 'USB Drive', 'USB-A', 'USB 3.2 Gen 1', 'Black', 'Rubberized matte black body with retractable connector', 'China', 5, '["Extreme Go 128GB", "USB 3.2", "SDCZ810-128G", "SDCZ810", "395MB/s"]'::jsonb, 'Slim black USB flash drive with rubberized coating, retractable USB-A connector with thumb-slide mechanism, SanDisk red accent stripe.'),
('SDCZ810-256G-G46', 'SanDisk Extreme Go 256GB USB 3.2 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Extreme Go Series', 'SDCZ810', 'SDCZ810-256G', '256GB', 'USB Drive', 'USB-A', 'USB 3.2 Gen 1', 'Black', 'Rubberized matte black body with retractable connector', 'China', 5, '["Extreme Go 256GB", "USB 3.2", "SDCZ810-256G", "SDCZ810", "395MB/s"]'::jsonb, 'Slim black USB flash drive with rubberized coating, retractable USB-A connector with thumb-slide mechanism, SanDisk red accent stripe.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- USB FLASH DRIVES: SanDisk Ultra Dual Drive Go USB-C
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDDDC3-064G-G46', 'SanDisk Ultra Dual Drive Go 64GB USB Type-C', 'SanDisk', 'USB Flash Drive', 'Ultra Dual Drive Go Series', 'SDDDC3', 'SDDDC3-064G', '64GB', 'USB Drive (Dual)', 'USB-C + USB-A', 'USB 3.1 Gen 1', 'Lavender', 'Rounded plastic swivel body with dual connectors', 'China', 5, '["Ultra Dual Drive Go 64GB", "USB 3.1", "SDDDC3-064G", "SDDDC3", "Type-C"]'::jsonb, 'Rounded swivel-style USB flash drive with USB-C on one end and USB-A on the other, plastic body with colorful finish and SanDisk branding.'),
('SDDDC3-128G-G46', 'SanDisk Ultra Dual Drive Go 128GB USB Type-C', 'SanDisk', 'USB Flash Drive', 'Ultra Dual Drive Go Series', 'SDDDC3', 'SDDDC3-128G', '128GB', 'USB Drive (Dual)', 'USB-C + USB-A', 'USB 3.1 Gen 1', 'Lavender', 'Rounded plastic swivel body with dual connectors', 'China', 5, '["Ultra Dual Drive Go 128GB", "USB 3.1", "SDDDC3-128G", "SDDDC3", "Type-C"]'::jsonb, 'Rounded swivel-style USB flash drive with USB-C on one end and USB-A on the other, plastic body with colorful finish and SanDisk branding.'),
('SDDDC3-256G-G46', 'SanDisk Ultra Dual Drive Go 256GB USB Type-C', 'SanDisk', 'USB Flash Drive', 'Ultra Dual Drive Go Series', 'SDDDC3', 'SDDDC3-256G', '256GB', 'USB Drive (Dual)', 'USB-C + USB-A', 'USB 3.1 Gen 1', 'Lavender', 'Rounded plastic swivel body with dual connectors', 'China', 5, '["Ultra Dual Drive Go 256GB", "USB 3.1", "SDDDC3-256G", "SDDDC3", "Type-C"]'::jsonb, 'Rounded swivel-style USB flash drive with USB-C on one end and USB-A on the other, plastic body with colorful finish and SanDisk branding.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- USB FLASH DRIVES: SanDisk Cruzer Glide USB 2.0
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDCZ60-032G-B35', 'SanDisk Cruzer Glide 32GB USB 2.0 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Cruzer Series', 'SDCZ60', 'SDCZ60-032G', '32GB', 'USB Drive', 'USB-A', 'USB 2.0', 'Black / Red', 'Matte black plastic body with retractable red slider', 'Malaysia', 2, '["Cruzer Glide 32GB", "USB 2.0", "SDCZ60-032G", "SDCZ60", "MADE IN MALAYSIA"]'::jsonb, 'Slim black USB flash drive with retractable red slider mechanism to extend/retract the USB-A connector. SanDisk logo printed in white.'),
('SDCZ60-064G-B35', 'SanDisk Cruzer Glide 64GB USB 2.0 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Cruzer Series', 'SDCZ60', 'SDCZ60-064G', '64GB', 'USB Drive', 'USB-A', 'USB 2.0', 'Black / Red', 'Matte black plastic body with retractable red slider', 'Malaysia', 2, '["Cruzer Glide 64GB", "USB 2.0", "SDCZ60-064G", "SDCZ60", "MADE IN MALAYSIA"]'::jsonb, 'Slim black USB flash drive with retractable red slider mechanism to extend/retract the USB-A connector. SanDisk logo printed in white.'),
('SDCZ60-128G-B35', 'SanDisk Cruzer Glide 128GB USB 2.0 Flash Drive', 'SanDisk', 'USB Flash Drive', 'Cruzer Series', 'SDCZ60', 'SDCZ60-128G', '128GB', 'USB Drive', 'USB-A', 'USB 2.0', 'Black / Red', 'Matte black plastic body with retractable red slider', 'Malaysia', 2, '["Cruzer Glide 128GB", "USB 2.0", "SDCZ60-128G", "SDCZ60", "MADE IN MALAYSIA"]'::jsonb, 'Slim black USB flash drive with retractable red slider mechanism to extend/retract the USB-A connector. SanDisk logo printed in white.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- PORTABLE SSDs: SanDisk Extreme Portable SSD V2
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDSSDE61-500G-G25', 'SanDisk Extreme Portable SSD 500GB', 'SanDisk', 'Portable SSD', 'Extreme Portable SSD Series', 'SDSSDE61', 'SDSSDE61-500G', '500GB', 'Portable SSD', 'USB-C', 'USB 3.2 Gen 2', 'Black', 'Rugged textured silicone shell with forged aluminum core', 'China', 5, '["Extreme Portable SSD", "500GB", "SDSSDE61-500G", "SDSSDE61", "USB 3.2", "IP65"]'::jsonb, 'Compact rugged portable SSD with textured dark gray silicone exterior, orange carabiner loop, and forged aluminum core. IP65 rated.'),
('SDSSDE61-1T00-G25', 'SanDisk Extreme Portable SSD 1TB', 'SanDisk', 'Portable SSD', 'Extreme Portable SSD Series', 'SDSSDE61', 'SDSSDE61-1T00', '1TB', 'Portable SSD', 'USB-C', 'USB 3.2 Gen 2', 'Black', 'Rugged textured silicone shell with forged aluminum core', 'China', 5, '["Extreme Portable SSD", "1TB", "SDSSDE61-1T00", "SDSSDE61", "USB 3.2", "IP65"]'::jsonb, 'Compact rugged portable SSD with textured dark gray silicone exterior, orange carabiner loop, and forged aluminum core. IP65 rated.'),
('SDSSDE61-2T00-G25', 'SanDisk Extreme Portable SSD 2TB', 'SanDisk', 'Portable SSD', 'Extreme Portable SSD Series', 'SDSSDE61', 'SDSSDE61-2T00', '2TB', 'Portable SSD', 'USB-C', 'USB 3.2 Gen 2', 'Black', 'Rugged textured silicone shell with forged aluminum core', 'China', 5, '["Extreme Portable SSD", "2TB", "SDSSDE61-2T00", "SDSSDE61", "USB 3.2", "IP65"]'::jsonb, 'Compact rugged portable SSD with textured dark gray silicone exterior, orange carabiner loop, and forged aluminum core. IP65 rated.'),
('SDSSDE61-4T00-G25', 'SanDisk Extreme Portable SSD 4TB', 'SanDisk', 'Portable SSD', 'Extreme Portable SSD Series', 'SDSSDE61', 'SDSSDE61-4T00', '4TB', 'Portable SSD', 'USB-C', 'USB 3.2 Gen 2', 'Black', 'Rugged textured silicone shell with forged aluminum core', 'China', 5, '["Extreme Portable SSD", "4TB", "SDSSDE61-4T00", "SDSSDE61", "USB 3.2", "IP65"]'::jsonb, 'Compact rugged portable SSD with textured dark gray silicone exterior, orange carabiner loop, and forged aluminum core. IP65 rated.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- PORTABLE SSDs: SanDisk Extreme PRO Portable SSD V2
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDSSDE81-1T00-G25', 'SanDisk Extreme PRO Portable SSD 1TB', 'SanDisk', 'Portable SSD', 'Extreme PRO Portable SSD Series', 'SDSSDE81', 'SDSSDE81-1T00', '1TB', 'Portable SSD', 'USB-C', 'USB 3.2 Gen 2x2', 'Black', 'Premium rugged aluminum body with silicone bumper', 'China', 5, '["Extreme PRO Portable SSD", "1TB", "SDSSDE81-1T00", "SDSSDE81", "USB 3.2", "IP65", "2000MB/s"]'::jsonb, 'Premium portable SSD with dark forged aluminum body, thick silicone bumper, and carabiner loop. Smaller than a smartphone. IP65 rated.'),
('SDSSDE81-2T00-G25', 'SanDisk Extreme PRO Portable SSD 2TB', 'SanDisk', 'Portable SSD', 'Extreme PRO Portable SSD Series', 'SDSSDE81', 'SDSSDE81-2T00', '2TB', 'Portable SSD', 'USB-C', 'USB 3.2 Gen 2x2', 'Black', 'Premium rugged aluminum body with silicone bumper', 'China', 5, '["Extreme PRO Portable SSD", "2TB", "SDSSDE81-2T00", "SDSSDE81", "USB 3.2", "IP65", "2000MB/s"]'::jsonb, 'Premium portable SSD with dark forged aluminum body, thick silicone bumper, and carabiner loop. Smaller than a smartphone. IP65 rated.'),
('SDSSDE81-4T00-G25', 'SanDisk Extreme PRO Portable SSD 4TB', 'SanDisk', 'Portable SSD', 'Extreme PRO Portable SSD Series', 'SDSSDE81', 'SDSSDE81-4T00', '4TB', 'Portable SSD', 'USB-C', 'USB 3.2 Gen 2x2', 'Black', 'Premium rugged aluminum body with silicone bumper', 'China', 5, '["Extreme PRO Portable SSD", "4TB", "SDSSDE81-4T00", "SDSSDE81", "USB 3.2", "IP65", "2000MB/s"]'::jsonb, 'Premium portable SSD with dark forged aluminum body, thick silicone bumper, and carabiner loop. Smaller than a smartphone. IP65 rated.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- MEMORY CARDS: SanDisk Extreme PRO microSDXC UHS-I
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDSQXCD-064G-GN6MA', 'SanDisk Extreme PRO microSDXC 64GB UHS-I', 'SanDisk', 'Memory Card', 'Extreme PRO microSD Series', 'SDSQXCD', 'SDSQXCD-064G', '64GB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Black / Gold', 'Standard microSD card with black body and gold accents', 'China', 10, '["Extreme PRO", "64GB", "microSDXC", "SDSQXCD", "200MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with black body, gold speed rating stripe, SanDisk Extreme PRO branding, capacity and speed class markings printed in gold and white.'),
('SDSQXCD-128G-GN6MA', 'SanDisk Extreme PRO microSDXC 128GB UHS-I', 'SanDisk', 'Memory Card', 'Extreme PRO microSD Series', 'SDSQXCD', 'SDSQXCD-128G', '128GB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Black / Gold', 'Standard microSD card with black body and gold accents', 'China', 10, '["Extreme PRO", "128GB", "microSDXC", "SDSQXCD", "200MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with black body, gold speed rating stripe, SanDisk Extreme PRO branding, capacity and speed class markings printed in gold and white.'),
('SDSQXCD-256G-GN6MA', 'SanDisk Extreme PRO microSDXC 256GB UHS-I', 'SanDisk', 'Memory Card', 'Extreme PRO microSD Series', 'SDSQXCD', 'SDSQXCD-256G', '256GB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Black / Gold', 'Standard microSD card with black body and gold accents', 'China', 10, '["Extreme PRO", "256GB", "microSDXC", "SDSQXCD", "200MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with black body, gold speed rating stripe, SanDisk Extreme PRO branding, capacity and speed class markings printed in gold and white.'),
('SDSQXCD-512G-GN6MA', 'SanDisk Extreme PRO microSDXC 512GB UHS-I', 'SanDisk', 'Memory Card', 'Extreme PRO microSD Series', 'SDSQXCD', 'SDSQXCD-512G', '512GB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Black / Gold', 'Standard microSD card with black body and gold accents', 'China', 10, '["Extreme PRO", "512GB", "microSDXC", "SDSQXCD", "200MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with black body, gold speed rating stripe, SanDisk Extreme PRO branding, capacity and speed class markings printed in gold and white.'),
('SDSQXCD-1T00-GN6MA', 'SanDisk Extreme PRO microSDXC 1TB UHS-I', 'SanDisk', 'Memory Card', 'Extreme PRO microSD Series', 'SDSQXCD', 'SDSQXCD-1T00', '1TB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Black / Gold', 'Standard microSD card with black body and gold accents', 'China', 10, '["Extreme PRO", "1TB", "microSDXC", "SDSQXCD", "200MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with black body, gold speed rating stripe, SanDisk Extreme PRO branding, capacity and speed class markings printed in gold and white.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- MEMORY CARDS: SanDisk Extreme microSDXC UHS-I
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDSQXAV-064G-GN6MA', 'SanDisk Extreme microSDXC 64GB UHS-I', 'SanDisk', 'Memory Card', 'Extreme microSD Series', 'SDSQXAV', 'SDSQXAV-064G', '64GB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Gold / Red', 'Standard microSD card with gold body and red accent', 'China', 10, '["Extreme", "64GB", "microSDXC", "SDSQXAV", "160MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with gold/yellow body, red SanDisk accent stripe, Extreme branding and speed class markings.'),
('SDSQXAV-128G-GN6MA', 'SanDisk Extreme microSDXC 128GB UHS-I', 'SanDisk', 'Memory Card', 'Extreme microSD Series', 'SDSQXAV', 'SDSQXAV-128G', '128GB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Gold / Red', 'Standard microSD card with gold body and red accent', 'China', 10, '["Extreme", "128GB", "microSDXC", "SDSQXAV", "160MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with gold/yellow body, red SanDisk accent stripe, Extreme branding and speed class markings.'),
('SDSQXAV-256G-GN6MA', 'SanDisk Extreme microSDXC 256GB UHS-I', 'SanDisk', 'Memory Card', 'Extreme microSD Series', 'SDSQXAV', 'SDSQXAV-256G', '256GB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Gold / Red', 'Standard microSD card with gold body and red accent', 'China', 10, '["Extreme", "256GB", "microSDXC", "SDSQXAV", "160MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with gold/yellow body, red SanDisk accent stripe, Extreme branding and speed class markings.'),
('SDSQXAV-512G-GN6MA', 'SanDisk Extreme microSDXC 512GB UHS-I', 'SanDisk', 'Memory Card', 'Extreme microSD Series', 'SDSQXAV', 'SDSQXAV-512G', '512GB', 'microSDXC', 'microSD slot', 'UHS-I / U3 / V30 / A2', 'Gold / Red', 'Standard microSD card with gold body and red accent', 'China', 10, '["Extreme", "512GB", "microSDXC", "SDSQXAV", "160MB/s", "A2", "V30", "U3"]'::jsonb, 'Standard microSD card with gold/yellow body, red SanDisk accent stripe, Extreme branding and speed class markings.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- MEMORY CARDS: SanDisk Ultra microSDXC UHS-I
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDSQUAB-032G-GN6MA', 'SanDisk Ultra microSDHC 32GB UHS-I', 'SanDisk', 'Memory Card', 'Ultra microSD Series', 'SDSQUAB', 'SDSQUAB-032G', '32GB', 'microSDHC', 'microSD slot', 'UHS-I / U1 / A1', 'Gray / Red', 'Standard microSD card with gray body and red accent', 'China', 10, '["Ultra", "32GB", "microSDHC", "SDSQUAB", "120MB/s", "A1", "U1"]'::jsonb, 'Standard microSD card with light gray body and red SanDisk accent line, Ultra branding in white text.'),
('SDSQUAB-064G-GN6MA', 'SanDisk Ultra microSDXC 64GB UHS-I', 'SanDisk', 'Memory Card', 'Ultra microSD Series', 'SDSQUAB', 'SDSQUAB-064G', '64GB', 'microSDXC', 'microSD slot', 'UHS-I / U1 / A1', 'Gray / Red', 'Standard microSD card with gray body and red accent', 'China', 10, '["Ultra", "64GB", "microSDXC", "SDSQUAB", "120MB/s", "A1", "U1"]'::jsonb, 'Standard microSD card with light gray body and red SanDisk accent line, Ultra branding in white text.'),
('SDSQUAB-128G-GN6MA', 'SanDisk Ultra microSDXC 128GB UHS-I', 'SanDisk', 'Memory Card', 'Ultra microSD Series', 'SDSQUAB', 'SDSQUAB-128G', '128GB', 'microSDXC', 'microSD slot', 'UHS-I / U1 / A1', 'Gray / Red', 'Standard microSD card with gray body and red accent', 'China', 10, '["Ultra", "128GB", "microSDXC", "SDSQUAB", "120MB/s", "A1", "U1"]'::jsonb, 'Standard microSD card with light gray body and red SanDisk accent line, Ultra branding in white text.'),
('SDSQUAB-256G-GN6MA', 'SanDisk Ultra microSDXC 256GB UHS-I', 'SanDisk', 'Memory Card', 'Ultra microSD Series', 'SDSQUAB', 'SDSQUAB-256G', '256GB', 'microSDXC', 'microSD slot', 'UHS-I / U1 / A1', 'Gray / Red', 'Standard microSD card with gray body and red accent', 'China', 10, '["Ultra", "256GB", "microSDXC", "SDSQUAB", "120MB/s", "A1", "U1"]'::jsonb, 'Standard microSD card with light gray body and red SanDisk accent line, Ultra branding in white text.'),
('SDSQUAB-512G-GN6MA', 'SanDisk Ultra microSDXC 512GB UHS-I', 'SanDisk', 'Memory Card', 'Ultra microSD Series', 'SDSQUAB', 'SDSQUAB-512G', '512GB', 'microSDXC', 'microSD slot', 'UHS-I / U1 / A1', 'Gray / Red', 'Standard microSD card with gray body and red accent', 'China', 10, '["Ultra", "512GB", "microSDXC", "SDSQUAB", "120MB/s", "A1", "U1"]'::jsonb, 'Standard microSD card with light gray body and red SanDisk accent line, Ultra branding in white text.')
ON CONFLICT (sku) DO NOTHING;

-- =========================================================================
-- INTERNAL SSDs: SanDisk Ultra 3D NAND SATA SSD
-- =========================================================================

INSERT INTO product_catalog (sku, product_name, brand, category, product_family, internal_model_id, manufacturer_part_number, capacity, form_factor, connector_type, interface, color_variant, material_finish, country_of_manufacture, warranty_years, expected_markings, visual_description)
VALUES
('SDSSDH3-500G-G26', 'SanDisk Ultra 3D NAND 500GB SATA SSD', 'SanDisk', 'Internal SSD', 'Ultra 3D SSD Series', 'SDSSDH3', 'SDSSDH3-500G', '500GB', '2.5" SATA SSD', 'SATA III', 'SATA 6Gb/s', 'Dark Gray', 'Dark gray metal 2.5-inch drive enclosure', 'China', 5, '["Ultra 3D", "500GB", "SATA III", "SDSSDH3-500G", "SDSSDH3", "560MB/s"]'::jsonb, 'Standard 2.5-inch form factor SATA SSD with dark gray metal enclosure, SanDisk Ultra 3D branding on label.'),
('SDSSDH3-1T00-G26', 'SanDisk Ultra 3D NAND 1TB SATA SSD', 'SanDisk', 'Internal SSD', 'Ultra 3D SSD Series', 'SDSSDH3', 'SDSSDH3-1T00', '1TB', '2.5" SATA SSD', 'SATA III', 'SATA 6Gb/s', 'Dark Gray', 'Dark gray metal 2.5-inch drive enclosure', 'China', 5, '["Ultra 3D", "1TB", "SATA III", "SDSSDH3-1T00", "SDSSDH3", "560MB/s"]'::jsonb, 'Standard 2.5-inch form factor SATA SSD with dark gray metal enclosure, SanDisk Ultra 3D branding on label.'),
('SDSSDH3-2T00-G26', 'SanDisk Ultra 3D NAND 2TB SATA SSD', 'SanDisk', 'Internal SSD', 'Ultra 3D SSD Series', 'SDSSDH3', 'SDSSDH3-2T00', '2TB', '2.5" SATA SSD', 'SATA III', 'SATA 6Gb/s', 'Dark Gray', 'Dark gray metal 2.5-inch drive enclosure', 'China', 5, '["Ultra 3D", "2TB", "SATA III", "SDSSDH3-2T00", "SDSSDH3", "560MB/s"]'::jsonb, 'Standard 2.5-inch form factor SATA SSD with dark gray metal enclosure, SanDisk Ultra 3D branding on label.'),
('SDSSDH3-4T00-G26', 'SanDisk Ultra 3D NAND 4TB SATA SSD', 'SanDisk', 'Internal SSD', 'Ultra 3D SSD Series', 'SDSSDH3', 'SDSSDH3-4T00', '4TB', '2.5" SATA SSD', 'SATA III', 'SATA 6Gb/s', 'Dark Gray', 'Dark gray metal 2.5-inch drive enclosure', 'China', 5, '["Ultra 3D", "4TB", "SATA III", "SDSSDH3-4T00", "SDSSDH3", "560MB/s"]'::jsonb, 'Standard 2.5-inch form factor SATA SSD with dark gray metal enclosure, SanDisk Ultra 3D branding on label.')
ON CONFLICT (sku) DO NOTHING;