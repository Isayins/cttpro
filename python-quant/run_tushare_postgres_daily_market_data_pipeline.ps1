param(
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432,
    [string]$DbUser = "postgres",
    [string]$DbPassword = "",
    [string]$DbName = "quant",
    [string]$DbSchema = "tushare_data",
    [string]$MarketDataSchema = "market_data",
    [string]$TushareToken,
    [string]$TushareHttpUrl = "http://tsy.xiaodefa.cn",
    [string]$EndDate,
    [int]$RefreshLookbackDays = 7,
    [switch]$EnableStkMins,
    [int]$StkMinsTradeDays = 1,
    [int]$StkMinsFullBackfillTradeDays = 5,
    [int]$DbConnectTimeout = 30,
    [int]$DbConnectRetries = 8,
    [double]$DbConnectRetrySleep = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$syncRunner = Join-Path $root "run_tushare_postgres_sync.py"
$marketBackfill = Join-Path $root "backfill_market_data_daily_postgres.py"

function Resolve-Python {
    if ($env:PYTHON_QUANT_PIPELINE_PYTHON) {
        return $env:PYTHON_QUANT_PIPELINE_PYTHON
    }

    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand -and $pythonCommand.Source) {
        return $pythonCommand.Source
    }

    throw "Unable to resolve python.exe. Set PYTHON_QUANT_PIPELINE_PYTHON first."
}

if (-not $TushareToken) {
    throw "TushareToken is required."
}

$pythonExe = Resolve-Python
if (-not (Test-Path $pythonExe)) {
    throw "Python not found: $pythonExe"
}

$endValue = if ($EndDate) { [datetime]::Parse($EndDate) } else { Get-Date }
$startValue = $endValue.Date.AddDays(-1 * [Math]::Max(0, $RefreshLookbackDays - 1))
$startDateText = $startValue.ToString("yyyy-MM-dd")
$endDateText = $endValue.ToString("yyyy-MM-dd")
$stateSuffix = "_daily_market_pipeline"

$syncArgs = @(
    $syncRunner,
    "--mode", "daily",
    "--db-host", $DbHost,
    "--db-port", "$DbPort",
    "--db-user", $DbUser,
    "--db-password", $DbPassword,
    "--db-name", $DbName,
    "--db-schema", $DbSchema,
    "--market-data-schema", $MarketDataSchema,
    "--tushare-token", $TushareToken,
    "--tushare-http-url", $TushareHttpUrl,
    "--end-date", $endValue.ToString("yyyyMMdd"),
    "--db-connect-timeout", "$DbConnectTimeout",
    "--db-connect-retries", "$DbConnectRetries",
    "--db-connect-retry-sleep", "$DbConnectRetrySleep",
    "--skip-setup",
    "--state-file-suffix", $stateSuffix,
    "--only-groups", "reference,marketRaw,announcementRaw,contentRaw,rangeRaw,independentApis"
)

if ($EnableStkMins) {
    $syncArgs += @("--enable-stk-mins", "--stk-mins-trade-days", "$StkMinsTradeDays", "--stk-mins-full-backfill-trade-days", "$StkMinsFullBackfillTradeDays")
}

Write-Host ("Starting tushare daily sync at {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
& $pythonExe @syncArgs
if ($LASTEXITCODE -ne 0) {
    throw "Daily tushare sync failed."
}

$years = New-Object System.Collections.Generic.HashSet[int]
for ($cursor = $startValue.Date; $cursor -le $endValue.Date; $cursor = $cursor.AddDays(1)) {
    [void]$years.Add($cursor.Year)
}

$backfillArgs = @(
    $marketBackfill,
    "--db-host", $DbHost,
    "--db-port", "$DbPort",
    "--db-user", $DbUser,
    "--db-password", $DbPassword,
    "--db-name", $DbName,
    "--source-schema", $DbSchema,
    "--target-schema", $MarketDataSchema,
    "--tushare-token", $TushareToken,
    "--tushare-http-url", $TushareHttpUrl,
    "--start-date", $startDateText,
    "--end-date", $endDateText
)

foreach ($year in ($years | Sort-Object)) {
    $backfillArgs += @("--year", "$year")
}

Write-Host ("Refreshing market_data daily tables from {0} to {1} at {2}" -f $startDateText, $endDateText, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
& $pythonExe @backfillArgs
if ($LASTEXITCODE -ne 0) {
    throw "market_data refresh failed."
}

Write-Host ("Completed daily market-data pipeline at {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
