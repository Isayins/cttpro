param(
    [string]$StartDate = "20240101",
    [string]$EndDate,
    [int]$Limit = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $root "run_sync.ps1"

function Invoke-SyncCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Host ""
    Write-Host ">>> Running: $($Arguments -join ' ')" -ForegroundColor Cyan
    powershell -ExecutionPolicy Bypass -File $runner @Arguments
}

$commonRange = @("--start-date", $StartDate)
if ($EndDate) {
    $commonRange += @("--end-date", $EndDate)
}
if ($Limit -gt 0) {
    $commonRange += @("--limit", "$Limit")
}

$commandArgs = @("all-ingestion") + $commonRange
Invoke-SyncCommand -Arguments $commandArgs

# High-value generic interfaces that are not prewired as dedicated jobs yet.
$commandArgs = @("raw-by-trade-dates", "--api-name", "ggt_daily") + $commonRange
Invoke-SyncCommand -Arguments $commandArgs
$commandArgs = @("raw-by-trade-dates", "--api-name", "ggt_top10") + $commonRange
Invoke-SyncCommand -Arguments $commandArgs
$commandArgs = @("raw-by-trade-dates", "--api-name", "bak_daily") + $commonRange
Invoke-SyncCommand -Arguments $commandArgs
$commandArgs = @("raw-by-trade-dates", "--api-name", "limit_list_d") + $commonRange
Invoke-SyncCommand -Arguments $commandArgs
$commandArgs = @("raw-by-trade-dates", "--api-name", "limit_list_ths") + $commonRange
Invoke-SyncCommand -Arguments $commandArgs

# Static or low-volume interfaces can be mirrored directly.
$commandArgs = @("raw-api", "--api-name", "hm_list")
Invoke-SyncCommand -Arguments $commandArgs
