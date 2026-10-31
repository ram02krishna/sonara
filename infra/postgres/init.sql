-- Sonara database bootstrap (runs once, when the Postgres volume is first created).
--
-- Only extensions live here. Tables, indexes and foreign keys are owned by the API:
-- on startup it runs GORM AutoMigrate (see EnsureSchema in apps/api/internal/repository),
-- which also upgrades databases created by older versions of this file.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
