-- MediCare database initialization
-- Runs once when the PostgreSQL container is first created.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enable case-insensitive text (for email lookups)
CREATE EXTENSION IF NOT EXISTS "citext";
