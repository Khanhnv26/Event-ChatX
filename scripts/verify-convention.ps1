# Script kiem tra tuan thu Code Convention cho toan bo du an EventChat

$ErrorActionPreference = "Stop"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " EventChat - Code Convention Verification " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Kiem tra Frontend (Lint va Build)
Write-Host "`n[1/3] Kiem tra Frontend (Lint va Build)..." -ForegroundColor Yellow
Push-Location frontend
try {
    Write-Host "-> Chay oxlint..." -ForegroundColor Gray
    cmd.exe /c "npm.cmd run lint"
    if ($LASTEXITCODE -ne 0) { throw "Frontend Lint that bai!" }

    Write-Host "-> Chay kiem tra kieu (tsc) va Build..." -ForegroundColor Gray
    cmd.exe /c "npm.cmd run build"
    if ($LASTEXITCODE -ne 0) { throw "Frontend Build that bai!" }
    
    Write-Host "-> Frontend kiem tra hoan tat: PASS" -ForegroundColor Green
} finally {
    Pop-Location
}

# 2. Kiem tra Backend (Maven Compile)
Write-Host "`n[2/3] Kiem tra Backend (Maven Compile)..." -ForegroundColor Yellow
Push-Location backend
try {
    Write-Host "-> Bien dich ma nguon va tests (mvn test-compile)..." -ForegroundColor Gray
    cmd.exe /c "mvn test-compile -q"
    if ($LASTEXITCODE -ne 0) { throw "Backend Test-Compile that bai!" }
    
    Write-Host "-> Backend kiem tra hoan tat: PASS" -ForegroundColor Green
} finally {
    Pop-Location
}

# 3. Kiem tra An toan va Ro ri Thong tin nhay cam
Write-Host "`n[3/3] Quet kiem tra bao mat (Secrets va Tokens)..." -ForegroundColor Yellow
$forbiddenPatterns = @(
    "application-secrets.properties.local",
    "BEGIN PRIVATE KEY",
    "BEGIN RSA PRIVATE KEY"
)

$gitFiles = git ls-files
$secretFound = $false

foreach ($pattern in $forbiddenPatterns) {
    $matched = $gitFiles | Where-Object { $_ -match $pattern }
    if ($matched) {
        Write-Host "CANH BAO: Tim thay file nhay cam trong Git tracking: $matched" -ForegroundColor Red
        $secretFound = $true
    }
}

if ($secretFound) {
    throw "Phat hien file nhay cam duoc theo doi boi Git!"
} else {
    Write-Host "-> Quet bao mat Git tracking: SACH" -ForegroundColor Green
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " TAT CA KIEM TRA DA QUA THANH CONG! (PASS) " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
