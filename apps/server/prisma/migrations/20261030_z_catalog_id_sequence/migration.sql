BEGIN;
LOCK TABLE "Product" IN SHARE ROW EXCLUSIVE MODE;
SELECT setval(
  pg_get_serial_sequence('"Product"', 'id'),
  COALESCE(MAX(id), 1),
  MAX(id) IS NOT NULL
) FROM "Product";
COMMIT;
