-- CyberDefense Arsenal - PostgreSQL Initialization
-- This script runs on first database creation

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS alerts;
CREATE SCHEMA IF NOT EXISTS cases;
CREATE SCHEMA IF NOT EXISTS detection;
CREATE SCHEMA IF NOT EXISTS connectors;
CREATE SCHEMA IF NOT EXISTS threatintel;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS playbooks;
CREATE SCHEMA IF NOT EXISTS network;
CREATE SCHEMA IF NOT EXISTS users;

-- Set search path
ALTER DATABASE cyberdefense SET search_path = public, alerts, cases, detection, connectors, threatintel, ai, playbooks, network, users;

-- Create indexes for common queries (will be created by Django migrations)
-- This is just a placeholder for any custom SQL needed

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cyberdefense;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cyberdefense;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO cyberdefense;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cyberdefense;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cyberdefense;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO cyberdefense;