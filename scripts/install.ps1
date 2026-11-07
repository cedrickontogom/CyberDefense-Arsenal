<#>
.SYNOPSIS
    CyberDefense Arsenal - Installation Script for Windows
.DESCRIPTION
    Installs CyberDefense Arsenal unified cybersecurity defense platform on Windows.
    Supports lite, core, full, and enterprise deployment profiles.
.EXAMPLE
    PowerShell -ExecutionPolicy Bypass -File .\install.ps1 -Profile core
.EXAMPLE
    .\install.ps1 -Profile full -InstallDir "C:\CyberDefense"
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('lite', 'core', 'full', 'enterprise')]
    [string]$Profile = 'core',

    [Parameter(Mandatory=$false)]
    [string]$InstallDir = "C:\CyberDefense-Arsenal",

    [Parameter(Mandatory=$false)]
    [switch]$Force,

    [Parameter(Mandatory=$false)]
    [switch]$SkipRequirements
)

# Colors for output
$ColorMap = @{
    'Red'    = [ConsoleColor]::Red
    'Green'  = [ConsoleColor]::Green
    'Yellow' = [ConsoleColor]::Yellow
    'Blue'   = [ConsoleColor]::Cyan
    'White'  = [ConsoleColor]::White
}

function Write-Log {
    param(
        [string]$Message,
        [string]$Color = 'White'
    )
    $timestamp = Get-Date -Format "HH:mm:ss"
    $fgColor = $ColorMap[$Color]
    if ($null -eq $fgColor) { $fgColor = [ConsoleColor]::White }
    Write-Host "[$timestamp] $Message" -ForegroundColor $fgColor
}

function Write-Success { param([string]$Message) Write-Log $Message 'Green' }
function Write-Warning { param([string]$Message) Write-Log $Message 'Yellow' }
function Write-Error   { param([string]$Message) Write-Log $Message 'Red' }
function Write-Info    { param([string]$Message) Write-Log $Message 'Blue' }

# Check if running as Administrator
function Check-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    $isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Warning "Not running as Administrator. Some features may not work correctly."
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -notmatch '^[Yy]$') {
            exit 1
        }
    }
}

# Check system requirements
function Check-Requirements {
    if ($SkipRequirements) { return }

    Write-Info "Checking system requirements..."

    # Check Docker
    $dockerPath = (Get-Command docker -ErrorAction SilentlyContinue).Source
    if (-not $dockerPath) {
        Write-Error "Docker is not installed. Please install Docker Desktop for Windows first."
        Write-Info "Download from: https://www.docker.com/products/docker-desktop/"
        Write-Info "Or run: winget install Docker.DockerDesktop"
        exit 1
    }
    Write-Info "Docker found at: $dockerPath"

    # Check Docker Compose v2 (plugin)
    $composeCheck = docker compose version 2>$null
    if (-not $composeCheck) {
        Write-Error "Docker Compose v2 is not available. Please update Docker Desktop."
        Write-Info "Docker Desktop 4.12+ includes Compose v2 plugin."
        Write-Info "Check: docker compose version"
        exit 1
    }
    Write-Info "Docker Compose: $($composeCheck.Trim())"

    # Check WSL 2
    $wslVersion = wsl --status 2>$null | Select-String "WSL version"
    if (-not $wslVersion) {
        Write-Warning "WSL 2 may not be enabled. Docker Desktop requires WSL 2 on Windows."
    }

    # Check available memory
    $memTotal = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
    $memRequired = switch ($Profile) {
        'lite' { 4 }
        'core' { 8 }
        'full' { 16 }
        'enterprise' { 32 }
    }

    if ($memTotal -lt $memRequired) {
        Write-Warning "System has ${memTotal}GB RAM, but ${memRequired}GB recommended for ${Profile} profile."
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -notmatch '^[Yy]$') { exit 1 }
    }

    # Check disk space
    $disk = Get-PSDrive C
    $diskFreeGB = [math]::Round($disk.Free / 1GB, 1)
    $diskRequired = switch ($Profile) {
        'lite' { 20 }
        'core' { 50 }
        'full' { 100 }
        'enterprise' { 200 }
    }

    if ($diskFreeGB -lt $diskRequired) {
        Write-Warning "Available disk space: ${diskFreeGB}GB, recommended: ${diskRequired}GB for ${Profile} profile."
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -notmatch '^[Yy]$') { exit 1 }
    }

    Write-Success "System requirements check passed"
}

# Clone or update repository
function Clone-Repository {
    Write-Info "Cloning repository..."

    if (Test-Path $InstallDir) {
        Write-Warning "Directory $InstallDir already exists."
        if ($Force) {
            Write-Info "Removing existing directory..."
            Remove-Item -Path $InstallDir -Recurse -Force
        } else {
            $response = Read-Host "Remove and reinstall? (y/N)"
            if ($response -match '^[Yy]$') {
                Remove-Item -Path $InstallDir -Recurse -Force
            } else {
                Write-Info "Using existing directory"
                return
            }
        }
    }

    git clone "https://github.com/your-org/cyberdefense-arsenal" $InstallDir
    Set-Location $InstallDir
    Write-Success "Repository cloned to $InstallDir"
}

# Generate secrets
function Generate-Secrets {
    Write-Info "Generating secrets..."

    $envPath = Join-Path $InstallDir ".env"
    if (-not (Test-Path $envPath)) {
        $postgresPwd = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
        $redisPwd = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
        $secretKey = [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
        $clickhousePwd = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
        $neo4jPwd = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
        $opensearchPwd = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
        $grafanaPwd = [Convert]::ToBase64String((1..16 | ForEach-Object { Get-Random -Maximum 256 }))
        $scannerSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

        @"
# CyberDefense Arsenal - Generated Secrets
# DO NOT COMMIT THIS FILE

# Database
POSTGRES_PASSWORD=$postgresPwd

# Redis
REDIS_PASSWORD=$redisPwd

# Django
SECRET_KEY=$secretKey

# ClickHouse
CLICKHOUSE_PASSWORD=$clickhousePwd

# Neo4j
NEO4J_PASSWORD=$neo4jPwd

# OpenSearch
OPENSEARCH_PASSWORD=$opensearchPwd

# Grafana
GRAFANA_PASSWORD=$grafanaPwd

# Network Scanner
SCANNER_SECRET=$scannerSecret

# Profile
PROFILE=$Profile
"@ | Set-Content -Path $envPath -Encoding UTF8

        Write-Success "Secrets generated in .env"
    } else {
        Write-Info ".env already exists, skipping secret generation"
    }
}

# Create Docker Compose override
function Create-DockerOverride {
    Write-Info "Creating Docker Compose override for profile: $Profile"

    $sourceFile = Join-Path $InstallDir "deploy\docker\docker-compose.$Profile.yml"
    $destFile = Join-Path $InstallDir "docker-compose.override.yml"

    if (Test-Path $sourceFile) {
        Copy-Item -Path $sourceFile -Destination $destFile -Force
        Write-Success "Docker Compose override created from $sourceFile"
    } else {
        Write-Error "Profile compose file not found: $sourceFile"
        exit 1
    }
}

# Pull Docker images
function Pull-Images {
    Write-Info "Pulling Docker images (this may take a while)..."
    Set-Location $InstallDir
    docker compose -f docker-compose.override.yml pull
    Write-Success "Images pulled"
}

# Start services
function Start-Services {
    Write-Info "Starting services..."
    Set-Location $InstallDir
    docker compose -f docker-compose.override.yml up -d

    Write-Info "Waiting for services to be healthy..."
    $maxWait = 300
    $waitTime = 0
    $healthy = $false

    while ($waitTime -lt $maxWait) {
        $status = docker compose -f docker-compose.override.yml ps --format "table {{.Status}}"
        if ($status -match "unhealthy|starting") {
            Start-Sleep -Seconds 5
            $waitTime += 5
            Write-Host "." -NoNewline
        } else {
            $healthy = $true
            break
        }
    }
    Write-Host ""

    if (-not $healthy) {
        Write-Warning "Some services may not be fully ready yet. Check with 'docker compose ps'"
    } else {
        Write-Success "All services started"
    }
}

# Run database migrations
function Run-Migrations {
    Write-Info "Running database migrations..."
    Set-Location $InstallDir
    docker compose -f docker-compose.override.yml exec -T backend python manage.py migrate --noinput
    Write-Success "Migrations completed"
}

# Create admin user
function Create-AdminUser {
    Write-Info "Creating admin user..."

    Set-Location $InstallDir

    $adminPassword = [Convert]::ToBase64String((1..16 | ForEach-Object { Get-Random -Maximum 256 }))

    $script = @"
from apps.users.models import User, Role
User.objects.filter(email='admin@localhost').delete()
user = User.objects.create_superuser('admin', 'admin@localhost', '$adminPassword')
user.first_name = 'Admin'
user.last_name = 'User'
user.save()
role, _ = Role.objects.get_or_create(name='admin', defaults={'description': 'Administrator', 'permissions': {'permissions': ['*']}})
user.roles.add(role)
print('Admin user created')
"@

    docker compose -f docker-compose.override.yml exec -T backend python manage.py shell -c $script

    Write-Success "Admin user created"
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Admin credentials:" -ForegroundColor Green
    Write-Host "  Email: admin@localhost" -ForegroundColor Green
    Write-Host "  Password: $adminPassword" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "SAVE THIS PASSWORD - IT WILL NOT BE SHOWN AGAIN" -ForegroundColor Yellow
}

# Print summary
function Print-Summary {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  CyberDefense Arsenal Installation Complete" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Installation directory: $InstallDir" -ForegroundColor Green
    Write-Host "Profile: $Profile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access URLs:" -ForegroundColor White
    Write-Host "  Dashboard:     http://localhost:3000" -ForegroundColor Green
    Write-Host "  API:           http://localhost:8000/api" -ForegroundColor Green
    Write-Host "  API Docs:      http://localhost:8000/api/docs" -ForegroundColor Green
    Write-Host "  Network Scan:  http://localhost:7332" -ForegroundColor Green
    Write-Host "  Grafana:       http://localhost:3001 (admin / check .env)" -ForegroundColor Green
    Write-Host "  Prometheus:    http://localhost:9090" -ForegroundColor Green
    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor White
    Write-Host "  View logs:     cd $InstallDir; docker compose -f docker-compose.override.yml logs -f" -ForegroundColor Green
    Write-Host "  Stop:          cd $InstallDir; docker compose -f docker-compose.override.yml down" -ForegroundColor Green
    Write-Host "  Restart:       cd $InstallDir; docker compose -f docker-compose.override.yml restart" -ForegroundColor Green
    Write-Host "  Update:        cd $InstallDir; git pull; docker compose -f docker-compose.override.yml up -d --build" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Open http://localhost:3000 in your browser" -ForegroundColor White
    Write-Host "  2. Login with admin@localhost and the password shown above" -ForegroundColor White
    Write-Host "  3. Configure connectors in Settings > Connectors" -ForegroundColor White
    Write-Host "  4. Run a network scan from the Network Topology page" -ForegroundColor White
    Write-Host ""
}

# Main execution
try {
    Write-Host ""
    Write-Host @"
   _____ _           _     _____ _           _
  / ____| |         | |   / ____| |         | |
 | (___ | |__   ___ | |_ | |    | |__   ___ | |_
  \___ \| '_ \ / _ \| __|| |    | '_ \ / _ \| __|
  ____) | | | | (_) | |_ | |____| | | | (_) | |_
 |_____/|_| |_|\___/ \__| \_____|_| |_|\___/ \__|

   Unified Cybersecurity Defense Platform
"@ -ForegroundColor Cyan
    Write-Host ""

    Check-Admin
    Check-Requirements
    Clone-Repository
    Generate-Secrets
    Create-DockerOverride
    Pull-Images
    Start-Services
    Run-Migrations
    Create-AdminUser
    Print-Summary
}
catch {
    Write-Error "Installation failed: $($_.Exception.Message)"
    exit 1
}
</function=write>