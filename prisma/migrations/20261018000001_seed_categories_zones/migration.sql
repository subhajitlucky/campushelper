-- CampusHelper v2: seed the category taxonomy and schematic campus zones.
--
-- Idempotent: safe to replay. Uses stable, readable ids so that the same
-- taxonomy can be referenced from tests and the backfill script.

INSERT INTO "Category" ("id", "slug", "name", "icon", "sortOrder") VALUES
  ('cat_electronics',  'electronics',  'Electronics',       'Smartphone',   10),
  ('cat_id-cards',     'id-cards',     'ID Cards',          'IdCard',       20),
  ('cat-documents',    'documents',    'Documents',         'FileText',     30),
  ('cat-books',        'books',        'Books & Notes',     'BookOpen',     40),
  ('cat-keys',         'keys',         'Keys',              'KeyRound',     50),
  ('cat-bags',         'bags',         'Bags & Backpacks',  'Backpack',     60),
  ('cat-clothing',     'clothing',     'Clothing',          'Shirt',        70),
  ('cat-accessories',  'accessories',  'Accessories',       'Watch',        80),
  ('cat-sports',       'sports',       'Sports Equipment',  'Dumbbell',     90),
  ('cat-other',        'other',        'Other',             'Package',     100)
ON CONFLICT ("slug") DO NOTHING;

-- Schematic campus geography. mapX/mapY are normalised percentages (0-100) on
-- the SVG map rendered by src/components/CampusMap.tsx, not real coordinates.
INSERT INTO "CampusZone" ("id", "slug", "name", "description", "mapX", "mapY", "sortOrder") VALUES
  ('zone_admin-block',      'admin-block',      'Administration Block',   'Registrar, fees, and student services',      18, 22,  10),
  ('zone_academic-block-1', 'academic-block-1', 'Academic Block 1',       'Lecture halls and faculty offices',          38, 30,  20),
  ('zone_central-library',  'central-library',  'Central Library',        'Reading rooms, stacks, and study zones',     58, 20,  30),
  ('zone_auditorium',       'auditorium',       'Auditorium',             'Events, seminars, and cultural programmes',  78, 32,  40),
  ('zone_canteen',          'canteen',          'Canteen & Food Court',   'Main dining and snack counters',             30, 55,  50),
  ('zone_hostel-block-a',   'hostel-block-a',   'Hostel Block A',         'Residential block and common rooms',         15, 74,  60),
  ('zone_sports-complex',   'sports-complex',   'Sports Complex',         'Ground, courts, and gymnasium',              62, 70,  70),
  ('zone_parking',          'parking',          'Parking & Transit Bay',  'Two-wheeler and four-wheeler parking',       85, 62,  80)
ON CONFLICT ("slug") DO NOTHING;
