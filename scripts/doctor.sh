#!/bin/bash
# CyberDefense Arsenal - Health Check Script

set -euo pipefail

COMPOSE_FILE="docker-compose.override.yml"
INSTALL_DIR="${INSTALL_DIR:-/opt/cyberdefense-arsenal}"

cd "$INSTALL_DIR" 2>/dev/null || {
    echo "Error: Not in installation directory. Set INSTALL_DIR or run from install directory."
    exit 1
}

check_docker() {
    echo "=== Docker Status ==="
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not installed"
        return 1
    fi
    echo "✅ Docker: $(docker --version)"

    if ! docker compose version &> /dev/null; then
        echo "❌ Docker Compose not available"
        return 1
    fi
    echo "✅ Docker Compose: $(docker compose version --short)"
}

check_compose_file() {
    echo ""
    echo "=== Compose File ==="
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        echo "❌ $COMPOSE_FILE not found"
        return 1
    fi
    echo "✅ $COMPOSE_FILE exists"
}

check_services() {
    echo ""
    echo "=== Service Status ==="
    docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

check_service_health() {
    echo ""
    echo "=== Service Health ==="

    local services=("postgres" "redis" "backend" "frontend" "network-scanner" "ollama")
    local all_healthy=true

    for service in "${services[@]}"; do
        local status=$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
        local container_status=$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not-found")

        if [[ "$container_status" == "running" ]]; then
            if [[ "$status" == "healthy" ]] || [[ "$status" == "no-healthcheck" ]]; then
                echo "✅ $service: running ($status)"
            else
                echo "⚠️  $service: running but $status"
                all_healthy=false
            fi
        else
            echo "❌ $service: $container_status"
            all_healthy=false
        fi
    done

    # Check profile-specific services
    if grep -q "clickhouse" "$COMPOSE_FILE" 2>/dev/null; then
        local status=$(docker compose -f "$COMPOSE_FILE" ps -q clickhouse 2>/dev/null | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
        local container_status=$(docker compose -f "$COMPOSE_FILE" ps -q clickhouse 2>/dev/null | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not-found")
        if [[ "$container_status" == "running" ]]; then
            echo "✅ clickhouse: running ($status)"
        else
            echo "❌ clickhouse: $container_status"
            all_healthy=false
        fi
    fi

    if grep -q "neo4j" "$COMPOSE_FILE" 2>/dev/null; then
        local status=$(docker compose -f "$COMPOSE_FILE" ps -q neo4j 2>/dev/null | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
        local container_status=$(docker compose -f "$COMPOSE_FILE" ps -q neo4j 2>/dev/null | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not-found")
        if [[ "$container_status" == "running" ]]; then
            echo "✅ neo4j: running ($status)"
        else
            echo "❌ neo4j: $container_status"
            all_healthy=false
        fi
    fi

    return $([[ "$all_healthy" == "true" ]] && echo 0 || echo 1)
}

check_endpoints() {
    echo ""
    echo "=== Endpoint Checks ==="

    local endpoints=(
        "http://localhost:3000|Frontend Dashboard"
        "http://localhost:8000/api/health/|Backend API"
        "http://localhost:7331/health|Network Scanner API"
        "http://localhost:7332|Network Scanner WebUI"
        "http://localhost:9090/-/healthy|Prometheus"
        "http://localhost:3001/api/health|Grafana"
    )

    for endpoint in "${endpoints[@]}"; do
        IFS='|' read -r url name <<< "$endpoint"
        if curl -sf -o /dev/null --max-time 5 "$url" 2>/dev/null; then
            echo "✅ $name: $url"
        else
            echo "❌ $name: $url (unreachable)"
        fi
    done
}

check_database() {
    echo ""
    echo "=== Database Checks ==="

    # PostgreSQL
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U cyberdefense -d cyberdefense &>/dev/null; then
        echo "✅ PostgreSQL: accepting connections"
    else
        echo "❌ PostgreSQL: not ready"
    fi

    # Redis
    if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping &>/dev/null; then
        echo "✅ Redis: responding to PING"
    else
        echo "❌ Redis: not responding"
    fi
}

check_disk_space() {
    echo ""
    echo "=== Disk Space ==="
    df -h "$INSTALL_DIR" | awk 'NR==2 {printf "Usage: %s / %s (%s used)\n", $3, $2, $5}'
}

check_memory() {
    echo ""
    echo "=== Memory Usage ==="
    free -h | awk 'NR==2 {printf "RAM: %s / %s used\n", $3, $2}'
    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null | head -20
}

check_logs() {
    echo ""
    echo "=== Recent Errors (last 50 lines) ==="
    docker compose -f "$COMPOSE_FILE" logs --tail=50 2>&1 | grep -i "error\|exception\|traceback\|fatal" | tail -20 || echo "No recent errors found"
}

main() {
    echo "========================================"
    echo "  CyberDefense Arsenal Health Check"
    echo "========================================"
    echo "Installation: $INSTALL_DIR"
    echo "Profile: $(grep '^PROFILE=' .env 2>/dev/null | cut -d= -f2 || echo 'unknown')"
    echo ""

    local failed=0

    check_docker || failed=1
    check_compose_file || failed=1
    check_services
    check_service_health || failed=1
    check_endpoints
    check_database
    check_disk_space
    check_memory
    check_logs

    echo ""
    echo "========================================"
    if [[ $failed -eq 0 ]]; then
        echo "✅ All critical checks passed"
    else
        echo "⚠️  Some checks failed - review output above"
    fi
    echo "========================================"

    exit $failed
}

main "$@"