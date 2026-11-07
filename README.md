# CyberDefense Arsenal

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Go](https://img.shields.io/badge/Go-1.22+-blue.svg)](https://golang.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)

**Unified Cybersecurity Defense Platform** - Combining the best of Agentic SOC Platform, NetVentory, and AiSOC into a single, powerful arsenal for defending your machine and local network.

## 🎯 Overview

CyberDefense Arsenal integrates three leading open-source security platforms:

| Platform | Contribution |
|----------|-------------|
| **Agentic SOC Platform** | Alert management, case investigation, AI-powered analysis, playbooks |
| **NetVentory** | Fast network discovery, device fingerprinting, port scanning, TUI/WebUI |
| **AiSOC** | Sigma detection engine (2966 rules), 91+ connectors, CISA KEV, MITRE ATT&CK |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CYBERDEFENSE ARSENAL DASHBOARD                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ NETWORK      │ │ THREAT       │ │ ALERTS &     │ │ AI           │       │
│  │ TOPOLOGY     │ │ INTELLIGENCE │ │ CASES        │ │ INVESTIGATION│       │
│  │ (NetVentory) │ │ (CISA KEV,   │ │ (ASP + AiSOC)│ │ (Ledger,     │       │
│  │              │ │  MITRE ATT&CK)│ │              │ │  Playbooks)  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
├─────────────────────────────────────────────────────────────────────────────┤
│                        UNIFIED BACKEND (Django + Go Services)               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Alert        │ │ Case         │ │ Detection    │ │ Connector    │       │
│  │ Ingestion    │ │ Management   │ │ Engine       │ │ Framework    │       │
│  │ (Webhook,    │ │ (Triage,     │ │ (Sigma,      │ │ (91+ sources│       │
│  │  SIEM, API)  │ │  Investigation)│ │  Correlation)│ │  + Cloud)   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
├─────────────────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ PostgreSQL   │ │ Redis        │ │ ClickHouse   │ │ Neo4j        │       │
│  │ (Alerts,     │ │ (Cache,      │ │ (Event Lake, │ │ (Entity      │       │
│  │  Cases,      │ │  Queue,      │ │  Hunting)    │ │  Graph)      │       │
│  │  Users)      │ │  Sessions)   │ │              │ │              │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## ✨ Features

### 🌐 Network Discovery (NetVentory-based)
- **Fast scanning** - ARP, ICMP, TCP SYN with configurable workers
- **Device fingerprinting** - MAC vendor, OS detection, service banners
- **Hostname resolution** - DNS, NetBIOS, SMB, RDP certificates, mDNS/Bonjour
- **Port scanning** - Top 1000 ports, service detection
- **Dual interface** - Terminal (TUI) and Web UI with real-time updates
- **No root required** - Runs without elevated privileges

### 🚨 Alert Management (ASP + AiSOC)
- **Multi-source ingestion** - Webhooks, SIEM (Splunk, Elastic), APIs
- **Smart normalization** - Unified alert schema with MITRE ATT&CK mapping
- **IOC extraction** - Automatic indicator of compromise identification
- **Threat intel enrichment** - CISA KEV, custom feeds, reputation
- **Correlation engine** - Sliding window, sequence, entity-based grouping
- **Custom rules** - Python modules with hot-reload

### 📋 Case Investigation
- **Full lifecycle** - Creation, triage, investigation, resolution
- **SLA tracking** - Configurable deadlines with breach alerts
- **Collaboration** - Comments, attachments, assignments
- **Timeline view** - Complete audit trail of all actions
- **Evidence management** - Chain of custody for artifacts

### 🤖 AI-Powered Analysis (AiSOC-based)
- **Triage Agent** - Severity, confidence, impact, priority assessment
- **Investigation Agent** - Lake queries, graph traversal, enrichment
- **Knowledge Agent** - Extract reusable patterns from closed cases
- **Investigation Ledger** - Immutable audit trail, signed evidence bundles
- **Local LLM support** - Ollama integration, no data leaves your network

### ⚡ Playbook Automation
- **YAML-based playbooks** - Version controlled, reviewable
- **Approval gates** - Human-in-the-loop for sensitive actions
- **Rollback support** - Automatic cleanup on failure
- **Integration** - Vendor APIs, custom scripts, webhooks

### 🔍 Detection Engine (Sigma)
- **2966 executable rules** from 7407-rule library
- **Sigma compiler** - YAML → SQL/ClickHouse/DSP
- **Custom rules** - Python modules for behavioral detection
- **Hot reload** - Update rules without restart
- **False positive tracking** - Automatic tuning

### 🔌 Connector Framework (91+ Connectors)
- **SIEM** - Splunk, Elastic, Sentinel, QRadar
- **EDR/XDR** - CrowdStrike, Defender, SentinelOne, Cortex XDR
- **Cloud** - AWS CloudTrail, GCP Cloud Logging, Azure Event Hubs
- **Identity** - Okta, Azure AD, JumpCloud
- **Network** - Syslog/CEF, NetFlow, Zeek
- **Vulnerability** - Qualys, Tenable, Rapid7

### 🛡️ Threat Intelligence
- **CISA KEV** - Automated Known Exploited Vulnerabilities feed
- **MITRE ATT&CK** - Full framework with technique mapping
- **Custom feeds** - STIX/TAXII, MISP, OpenCTI integration
- **IOC management** - Search, enrich, track indicators
- **Actor profiles** - Threat actor tracking with TTPs

## 🚀 Quick Start

### Prerequisites
- Docker 24.0+ with Compose v2
- 8 GB RAM (core), 16 GB (full)
- 20 GB free disk (core), 100 GB (full)
- Linux/macOS/Windows with WSL2

### One-Line Install

**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/your-org/cyberdefense-arsenal/main/scripts/install.sh | bash
```

**Windows PowerShell:**
```powershell
iwr -useb https://raw.githubusercontent.com/your-org/cyberdefense-arsenal/main/scripts/install.ps1 | iex
```

### Manual Install

```bash
# Clone repository
git clone https://github.com/your-org/cyberdefense-arsenal
cd cyberdefense-arsenal

# Choose profile: lite, core, full, enterprise
export PROFILE=core

# Generate secrets and start
./scripts/install.sh --profile $PROFILE
```

### Access Points
| Service | URL | Credentials |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3000 | admin@localhost / (shown after install) |
| **API** | http://localhost:8000/api | JWT Token |
| **API Docs** | http://localhost:8000/api/docs | - |
| **Network Scanner** | http://localhost:7332 | Token from UI |
| **Grafana** | http://localhost:3001 | admin / (in .env) |
| **Prometheus** | http://localhost:9090 | - |

## 📦 Deployment Profiles

| Profile | Services | RAM | Disk | Use Case |
|---------|----------|-----|------|----------|
| **lite** | 8 | 4 GB | 20 GB | Edge/small office, basic monitoring |
| **core** | 14 | 8 GB | 50 GB | **Recommended** - Full SOC capabilities |
| **full** | 22 | 16 GB | 100 GB | Enterprise - Hunting, graph, UEBA |
| **enterprise** | 28 | 32 GB | 200 GB | Multi-tenant, HA, advanced compliance |

## ⚙️ Configuration

### Environment Variables (.env)
```bash
# Database
POSTGRES_PASSWORD=secure_password
REDIS_PASSWORD=secure_password

# Django
SECRET_KEY=your-secret-key

# Profile
PROFILE=core

# External services (optional)
OPENAI_API_KEY=sk-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

### Profiles
Override services in `docker-compose.override.yml`:
```yaml
services:
  backend:
    environment:
      - CUSTOM_SETTING=value
  ollama:
    deploy:
      resources:
        limits:
          memory: 8G
```

## 🔧 Development

### Backend (Django)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python manage.py runserver
```

### Network Scanner (Go)
```bash
cd network-scanner
go mod download
go run ./cmd/scanner
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

### Run Tests
```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm test

# Integration
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

## 📚 API Documentation

Interactive API docs available at `/api/docs/` (Swagger UI) and `/api/redoc/` (ReDoc).

### Key Endpoints
```
GET    /api/alerts/alerts/           # List alerts
POST   /api/alerts/alerts/           # Create alert (webhook)
POST   /api/alerts/alerts/{id}/triage/  # Triage alert
GET    /api/cases/cases/             # List cases
POST   /api/cases/cases/             # Create case
GET    /api/network-api/api/v1/scans/    # Network scans
POST   /api/network-api/api/v1/scans/    # Start scan
GET    /api/ai/investigations/       # AI investigations
POST   /api/ai/investigate/          # Start investigation
GET    /api/playbooks/playbooks/     # Playbooks
POST   /api/playbooks/playbooks/{id}/execute/  # Run playbook
```

## 🛡️ Security

- **Secrets** - Generated per deployment, never committed
- **Encryption** - Credentials encrypted at rest
- **RBAC** - Role-based access on all mutating routes
- **Authentication** - JWT + OAuth2, MFA (TOTP) support
- **Local LLM** - Ollama runs locally, no data egress
- **Audit trail** - Immutable ledger for all actions
- **SSO/SAML** - Enterprise authentication ready

## 📖 Documentation

- [Installation Guide](docs/installation.md)
- [Configuration](docs/configuration.md)
- [Connector Setup](docs/connectors.md)
- [Playbook Development](docs/playbooks.md)
- [Rule Writing](docs/detection-rules.md)
- [API Reference](docs/api.md)
- [Architecture](docs/architecture.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Agentic SOC Platform](https://github.com/FunnyWolf/agentic-soc-platform) by FunnyWolf
- [NetVentory](https://github.com/RamboRogers/netventory) by RamboRogers
- [AiSOC](https://github.com/beenuar/AiSOC) by beenuar
- [Cyble](https://cyble.com) for funding AiSOC development

## 📞 Support

- [GitHub Issues](https://github.com/your-org/cyberdefense-arsenal/issues)
- [Discussions](https://github.com/your-org/cyberdefense-arsenal/discussions)
- [Security](SECURITY.md) for vulnerability reporting

---

**CyberDefense Arsenal** - Your unified shield against cyber threats. 🛡️