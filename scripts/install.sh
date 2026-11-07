#!/bin/bash
# CyberDefense Arsenal - Installation Script for Linux/macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/your-org/cyberdefense-arsenal/main/scripts/install.sh | bash

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/your-org/cyberdefense-arsenal"
INSTALL_DIR="${INSTALL_DIR:-/opt/cyberdefense-arsenal}"
PROFILE="${PROFILE:-core}"  # lite, core, full, enterprise
DOCKER_COMPOSE_VERSION="v2.24.0"

# Functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. This is not recommended for production."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_requirements() {
    log_info "Checking system requirements..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose v2 is not available. Please install Docker Compose v2."
        exit 1
    fi

    # Check available memory
    local mem_total=$(free -m | awk '/^Mem:/{print $2}')
    local mem_required=0
    case $PROFILE in
        lite) mem_required=4096 ;;
        core) mem_required=8192 ;;
        full) mem_required=16384 ;;
        enterprise) mem_required=32768 ;;
    esac

    if [[ $mem_total -lt $mem_required ]]; then
        log_warning "System has ${mem_total}MB RAM, but ${mem_required}MB recommended for ${PROFILE} profile."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check disk space
    local disk_available=$(df -m . | awk 'NR==2 {print $4}')
    local disk_required=0
    case $PROFILE in
        lite) disk_required=20480 ;;
        core) disk_required=51200 ;;
        full) disk_required=102400 ;;
        enterprise) disk_required=204800 ;;
    esac

    if [[ $disk_available -lt $disk_required ]]; then
        log_warning "Available disk space: ${disk_available}MB, recommended: ${disk_required}MB for ${PROFILE} profile."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    log_success "System requirements check passed"
}

clone_repository() {
    log_info "Cloning repository..."

    if [[ -d "$INSTALL_DIR" ]]; then
        log_warning "Directory $INSTALL_DIR already exists."
        read -p "Remove and reinstall? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            log_info "Using existing directory"
            return
        fi
    fi

    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    log_success "Repository cloned to $INSTALL_DIR"
}

generate_secrets() {
    log_info "Generating secrets..."

    cd "$INSTALL_DIR"

    # Create .env file if it doesn't exist
    if [[ ! -f .env ]]; then
        cat > .env << EOF
# CyberDefense Arsenal - Generated Secrets
# DO NOT COMMIT THIS FILE

# Database
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Redis
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Django
SECRET_KEY=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)

# ClickHouse
CLICKHOUSE_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Neo4j
NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# OpenSearch
OPENSEARCH_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Grafana
GRAFANA_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

# Network Scanner
SCANNER_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Profile
PROFILE=$PROFILE
EOF
        log_success "Secrets generated in .env"
    else
        log_info ".env already exists, skipping secret generation"
    fi
}

create_docker_override() {
    log_info "Creating Docker Compose override for profile: $PROFILE"

    cd "$INSTALL_DIR"

    local compose_file="deploy/docker/docker-compose.${PROFILE}.yml"
    local override_file="docker-compose.override.yml"

    if [[ -f "$compose_file" ]]; then
        cp "$compose_file" "$override_file"
        log_success "Docker Compose override created from $compose_file"
    else
        log_error "Profile compose file not found: $compose_file"
        exit 1
    fi
}

pull_images() {
    log_info "Pulling Docker images (this may take a while)..."
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.override.yml pull
    log_success "Images pulled"
}

start_services() {
    log_info "Starting services..."
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.override.yml up -d

    log_info "Waiting for services to be healthy..."
    local max_wait=300
    local wait_time=0
    while [[ $wait_time -lt $max_wait ]]; do
        if docker compose -f docker-compose.override.yml ps | grep -q "unhealthy\|starting"; then
            sleep 5
            wait_time=$((wait_time + 5))
            echo -n "."
        else
            break
        fi
    done
    echo

    if [[ $wait_time -ge $max_wait ]]; then
        log_warning "Some services may not be fully ready yet. Check with 'docker compose ps'"
    else
        log_success "All services started"
    fi
}

run_migrations() {
    log_info "Running database migrations..."
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.override.yml exec -T backend python manage.py migrate --noinput
    log_success "Migrations completed"
}

create_superuser() {
    log_info "Creating admin user..."

    cd "$INSTALL_DIR"

    # Generate random password
    local admin_password=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

    docker compose -f docker-compose.override.yml exec -T backend python manage.py shell -c "
from apps.users.models import User, Role
User.objects.filter(email='admin@localhost').delete()
user = User.objects.create_superuser('admin', 'admin@localhost', '$admin_password')
user.first_name = 'Admin'
user.last_name = 'User'
user.save()
role, _ = Role.objects.get_or_create(name='admin', defaults={'description': 'Administrator', 'permissions': {'permissions': ['*']}})
user.roles.add(role)
print('Admin user created')
"

    log_success "Admin user created"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Admin credentials:${NC}"
    echo -e "${GREEN}  Email: admin@localhost${NC}"
    echo -e "${GREEN}  Password: $admin_password${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${YELLOW}  SAVE THIS PASSWORD - IT WILL NOT BE SHOWN AGAIN${NC}"
}

print_summary() {
    echo
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  CyberDefense Arsenal Installation Complete${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo
    echo -e "Installation directory: ${GREEN}$INSTALL_DIR${NC}"
    echo -e "Profile: ${GREEN}$PROFILE${NC}"
    echo
    echo -e "Access URLs:"
    echo -e "  Dashboard:     ${GREEN}http://localhost:3000${NC}"
    echo -e "  API:           ${GREEN}http://localhost:8000/api${NC}"
    echo -e "  API Docs:      ${GREEN}http://localhost:8000/api/docs${NC}"
    echo -e "  Network Scan:  ${GREEN}http://localhost:7332${NC}"
    echo -e "  Grafana:       ${GREEN}http://localhost:3001${NC} (admin / check .env)"
    echo -e "  Prometheus:    ${GREEN}http://localhost:9090${NC}"
    echo
    echo -e "Useful commands:"
    echo -e "  View logs:     ${GREEN}cd $INSTALL_DIR && docker compose -f docker-compose.override.yml logs -f${NC}"
    echo -e "  Stop:          ${GREEN}cd $INSTALL_DIR && docker compose -f docker-compose.override.yml down${NC}"
    echo -e "  Restart:       ${GREEN}cd $INSTALL_DIR && docker compose -f docker-compose.override.yml restart${NC}"
    echo -e "  Update:        ${GREEN}cd $INSTALL_DIR && git pull && docker compose -f docker-compose.override.yml up -d --build${NC}"
    echo
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Open ${GREEN}http://localhost:3000${NC} in your browser"
    echo -e "  2. Login with admin@localhost and the password shown above"
    echo -e "  3. Configure connectors in Settings > Connectors"
    echo -e "  4. Run a network scan from the Network Topology page"
    echo
}

main() {
    echo -e "${BLUE}"
    cat << 'EOF'
   _____ _           _     _____ _           _
  / ____| |         | |   / ____| |         | |
 | (___ | |__   ___ | |_ | |    | |__   ___ | |_
  \___ \| '_ \ / _ \| __|| |    | '_ \ / _ \| __|
  ____) | | | | (_) | |_ | |____| | | | (_) | |_
 |_____/|_| |_|\___/ \__| \_____|_| |_|\___/ \__|

   Unified Cybersecurity Defense Platform
EOF
    echo -e "${NC}"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --profile)
                PROFILE="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--dir DIR] [--profile PROFILE]"
                echo "Profiles: lite, core, full, enterprise"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    log_info "Installing CyberDefense Arsenal ($PROFILE profile) to $INSTALL_DIR"

    check_root
    check_requirements
    clone_repository
    generate_secrets
    create_docker_override
    pull_images
    start_services
    run_migrations
    create_superuser
    print_summary
}

main "$@"