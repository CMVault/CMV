#!/bin/bash
echo "🔧 Fixing all database schema issues..."
sqlite3 data/camera-vault.db << SQL
ALTER TABLE image_attributions ADD COLUMN filename TEXT;
ALTER TABLE image_attributions ADD COLUMN source_url TEXT;
ALTER TABLE image_attributions ADD COLUMN source_name TEXT;
ALTER TABLE image_attributions ADD COLUMN attribution_text TEXT;
ALTER TABLE image_attributions ADD COLUMN downloaded_at TEXT;
SQL
echo "✅ Database schema fixed!"
