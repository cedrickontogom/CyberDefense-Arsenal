-- CyberDefense Arsenal - ClickHouse Initialization
-- Event Lake Schema for Security Events

-- Create database
CREATE DATABASE IF NOT EXISTS cyberdefense;

-- Events table (main event storage)
CREATE TABLE IF NOT EXISTS cyberdefense.events (
    id UUID DEFAULT generateUUIDv4(),
    timestamp DateTime64(3),
    received_at DateTime64(3) DEFAULT now(),

    -- Source identification
    connector_id UUID,
    connector_type LowCardinality(String),
    source_event_id String,

    -- Event classification
    severity LowCardinality(String),
    category LowCardinality(String),
    title String,
    description String,

    -- Entities
    host String,
    user String,
    source_ip IPv4,
    destination_ip IPv4,
    destination_port UInt16,

    -- MITRE ATT&CK
    mitre_techniques Array(String),
    mitre_tactics Array(String),

    -- IOCs
    iocs Map(String, String),

    -- Raw data
    raw_data String,

    -- Enrichment
    enrichment Map(String, String),
    threat_intel_matches Array(String),

    -- Correlation
    correlation_id UUID,
    is_correlated Boolean DEFAULT false,

    -- Tags
    tags Array(String),

    -- Metadata
    metadata Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, connector_id, severity)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Alerts table (derived from events)
CREATE TABLE IF NOT EXISTS cyberdefense.alerts (
    id UUID DEFAULT generateUUIDv4(),
    event_id UUID,
    alert_id String,
    timestamp DateTime64(3),
    received_at DateTime64(3) DEFAULT now(),

    connector_id UUID,
    connector_type LowCardinality(String),

    severity LowCardinality(String),
    status LowCardinality(String),
    title String,
    description String,

    host String,
    user String,
    source_ip IPv4,
    destination_ip IPv4,

    mitre_techniques Array(String),
    mitre_tactics Array(String),
    iocs Map(String, String),

    assigned_to UUID,
    triaged_at Nullable(DateTime64(3)),
    resolved_at Nullable(DateTime64(3)),

    correlation_id UUID,
    is_correlated Boolean DEFAULT false,
    parent_alert_id UUID,

    tags Array(String),
    metadata Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, severity, status)
TTL timestamp + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;

-- Network scan results
CREATE TABLE IF NOT EXISTS cyberdefense.network_scans (
    id UUID DEFAULT generateUUIDv4(),
    scan_id String,
    started_at DateTime64(3),
    completed_at Nullable(DateTime64(3)),
    interface String,
    cidr String,
    ports Array(UInt16),
    status LowCardinality(String),

    device_ip IPv4,
    device_mac String,
    device_vendor String,
    device_hostnames Array(String),
    device_ports Array(Tuple(UInt16, String, String, String)), -- port, protocol, state, service
    device_os String,
    device_type String,
    device_first_seen DateTime64(3),
    device_last_seen DateTime64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(started_at)
ORDER BY (started_at, scan_id, device_ip)
TTL started_at + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Threat intelligence IOCs
CREATE TABLE IF NOT EXISTS cyberdefense.threat_intel_iocs (
    id UUID DEFAULT generateUUIDv4(),
    ioc_type LowCardinality(String),
    ioc_value String,
    description String,
    source String,
    confidence UInt8,
    tags Array(String),
    first_seen DateTime,
    last_seen DateTime,
    related_cves Array(String),
    related_actors Array(String),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (ioc_type, ioc_value)
TTL last_seen + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;

-- CVE database
CREATE TABLE IF NOT EXISTS cyberdefense.cves (
    id UUID DEFAULT generateUUIDv4(),
    cve_id String,
    description String,
    severity LowCardinality(String),
    cvss_score Float32,
    published_date Date,
    last_modified Date,
    references Array(String),
    affected_products Array(String),
    mitre_techniques Array(String),
    kev_listed Boolean DEFAULT false,
    epss_score Float32,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (cve_id)
SETTINGS index_granularity = 8192;

-- Threat actors
CREATE TABLE IF NOT EXISTS cyberdefense.threat_actors (
    id UUID DEFAULT generateUUIDv4(),
    name String,
    aliases Array(String),
    description String,
    country String,
    motivation String,
    sophistication String,
    first_seen Date,
    last_seen Date,
    mitre_techniques Array(String),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY name
SETTINGS index_granularity = 8192;

-- AI Investigations
CREATE TABLE IF NOT EXISTS cyberdefense.ai_investigations (
    id UUID DEFAULT generateUUIDv4(),
    case_id UUID,
    case_title String,
    status LowCardinality(String),
    verdict LowCardinality(String),
    confidence Float32,
    severity LowCardinality(String),
    summary String,
    reasoning String,
    evidence Array(String),
    recommendations Array(String),
    tokens_used UInt32,
    cost_usd Float64,
    model_used String,
    created_at DateTime64(3),
    completed_at Nullable(DateTime64(3))
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (created_at, case_id)
TTL created_at + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;

-- Playbook runs
CREATE TABLE IF NOT EXISTS cyberdefense.playbook_runs (
    id UUID DEFAULT generateUUIDv4(),
    playbook_id UUID,
    playbook_name String,
    status LowCardinality(String),
    started_at DateTime64(3),
    completed_at Nullable(DateTime64(3)),
    duration_ms UInt32,
    steps_completed UInt16,
    steps_total UInt16,
    error String,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(started_at)
ORDER BY (started_at, playbook_id)
TTL started_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Detection rule matches
CREATE TABLE IF NOT EXISTS cyberdefense.rule_matches (
    id UUID DEFAULT generateUUIDv4(),
    rule_id UUID,
    rule_name String,
    rule_severity LowCardinality(String),
    event_id UUID,
    alert_id UUID,
    matched_at DateTime64(3),
    matched_fields Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(matched_at)
ORDER BY (matched_at, rule_id)
TTL matched_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Connector metrics
CREATE TABLE IF NOT EXISTS cyberdefense.connector_metrics (
    id UUID DEFAULT generateUUIDv4(),
    connector_id UUID,
    timestamp DateTime,
    events_received UInt32,
    events_processed UInt32,
    events_failed UInt32,
    alerts_created UInt32,
    alerts_suppressed UInt32,
    processing_time_ms Float32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, connector_id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Create users and grants
CREATE USER IF NOT EXISTS cyberdefense IDENTIFIED BY 'changeme';
GRANT ALL ON cyberdefense.* TO cyberdefense;