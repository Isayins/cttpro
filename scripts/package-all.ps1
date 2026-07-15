param(
  [switch]$RunTests
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$javaDir = Join-Path $repoRoot "java-backend"
$distDir = Join-Path $repoRoot "dist"
$artifactsDir = Join-Path $repoRoot "artifacts"

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Title"
  & $Command
}

function Get-Sha256Hash {
  param([string]$Path)

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
      $hash = -join ($sha256.ComputeHash($stream) | ForEach-Object { $_.ToString("x2") })
      return $hash.ToUpperInvariant()
    } finally {
      $stream.Dispose()
    }
  } finally {
    $sha256.Dispose()
  }
}

Invoke-Step "Build frontend" {
  Push-Location $repoRoot
  try {
    npm run build
  } finally {
    Pop-Location
  }
}

$isWindows = ($PSVersionTable.PSEdition -eq "Desktop") -or ($env:OS -eq "Windows_NT")
$mavenWrapper = if ($isWindows) {
  Join-Path $javaDir "mvnw.cmd"
} else {
  Join-Path $javaDir "mvnw"
}

if (-not (Test-Path $mavenWrapper)) {
  throw "Maven wrapper not found: $mavenWrapper"
}

$mavenArgs = @("clean", "package")
if (-not $RunTests) {
  $mavenArgs = @("-DskipTests") + $mavenArgs
}

Invoke-Step "Build backend" {
  Push-Location $javaDir
  try {
    & $mavenWrapper @mavenArgs
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $distDir)) {
  throw "Frontend dist not found: $distDir"
}

$backendSourceJar = Join-Path $javaDir "target/java-backend-1.0.0.jar"
if (-not (Test-Path $backendSourceJar)) {
  throw "Backend jar not found: $backendSourceJar"
}

New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$frontendDir = Join-Path $artifactsDir "frontend-dist-$stamp"
$frontendZip = Join-Path $artifactsDir "frontend-dist-$stamp.zip"
$backendJar = Join-Path $artifactsDir "java-backend-1.0.0-$stamp.jar"

Invoke-Step "Create artifacts" {
  New-Item -ItemType Directory -Path $frontendDir | Out-Null
  Copy-Item -Path (Join-Path $distDir "*") -Destination $frontendDir -Recurse -Force
  Compress-Archive -Path (Join-Path $frontendDir "*") -DestinationPath $frontendZip -CompressionLevel Optimal
  Copy-Item -Path $backendSourceJar -Destination $backendJar -Force
}

$frontendHash = Get-Sha256Hash $frontendZip
$backendHash = Get-Sha256Hash $backendJar

Write-Host ""
Write-Host "Package complete."
Write-Host "Frontend zip: $frontendZip"
Write-Host "Frontend SHA256: $frontendHash"
Write-Host "Backend jar: $backendJar"
Write-Host "Backend SHA256: $backendHash"
