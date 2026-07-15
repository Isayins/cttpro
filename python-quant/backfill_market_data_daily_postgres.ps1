param(
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432,
    [string]$DbUser = "postgres",
    [string]$DbPassword = "",
    [string]$DbName = "quant",
    [string]$SourceSchema = "tushare_data",
    [string]$TargetSchema = "market_data",
    [string]$TushareToken,
    [string]$TushareHttpUrl = "http://tsy.xiaodefa.cn",
    [int[]]$Year,
    [string]$StartDate,
    [string]$EndDate,
    [int]$BatchSize = 2000,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $root "backfill_market_data_daily_postgres.py"

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

$pythonExe = Resolve-Python
if (-not (Test-Path $pythonExe)) {
    throw "Python not found: $pythonExe"
}

$argList = @(
    $scriptPath,
    "--db-host", $DbHost,
    "--db-port", "$DbPort",
    "--db-user", $DbUser,
    "--db-password", $DbPassword,
    "--db-name", $DbName,
    "--source-schema", $SourceSchema,
    "--target-schema", $TargetSchema,
    "--tushare-http-url", $TushareHttpUrl,
    "--batch-size", "$BatchSize"
)

if ($TushareToken) {
    $argList += @("--tushare-token", $TushareToken)
}
if ($Year) {
    foreach ($item in $Year) {
        $argList += @("--year", "$item")
    }
}
if ($StartDate) {
    $argList += @("--start-date", $StartDate)
}
if ($EndDate) {
    $argList += @("--end-date", $EndDate)
}
if ($DryRun) {
    $argList += "--dry-run"
}

& $pythonExe @argList
