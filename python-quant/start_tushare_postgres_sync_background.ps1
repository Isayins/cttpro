param(
    [ValidateSet("daily", "weekend", "full")]
    [string]$Mode = "daily",

    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432,
    [string]$DbUser = "postgres",
    [string]$DbPassword = "",
    [string]$DbName = "quant",
    [string]$DbSchema = "tushare_data",
    [string]$TushareToken,
    [string]$TushareHttpUrl = "http://tsy.xiaodefa.cn",
    [string]$EndDate,
    [switch]$EnableStkMins,
    [int]$StkMinsTradeDays = 1,
    [int]$StkMinsFullBackfillTradeDays = 5,
    [int]$StkMinsLimitSymbols,
    [switch]$ResetState,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $root "run_tushare_postgres_sync.py"

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

$argList = @(
    $runnerPath,
    "--mode", $Mode,
    "--db-host", $DbHost,
    "--db-port", "$DbPort",
    "--db-user", $DbUser,
    "--db-password", $DbPassword,
    "--db-name", $DbName,
    "--db-schema", $DbSchema,
    "--tushare-token", $TushareToken,
    "--tushare-http-url", $TushareHttpUrl,
    "--stk-mins-trade-days", "$StkMinsTradeDays",
    "--stk-mins-full-backfill-trade-days", "$StkMinsFullBackfillTradeDays"
)

if ($EndDate) {
    $argList += @("--end-date", $EndDate)
}
if ($EnableStkMins) {
    $argList += "--enable-stk-mins"
}
if ($StkMinsLimitSymbols -gt 0) {
    $argList += @("--stk-mins-limit-symbols", "$StkMinsLimitSymbols")
}
if ($ResetState) {
    $argList += "--reset-state"
}
if ($ExtraArgs) {
    $argList += $ExtraArgs
}

$process = Start-Process -FilePath $pythonExe -ArgumentList $argList -WindowStyle Hidden -PassThru
[pscustomobject]@{
    ProcessId = $process.Id
    Mode = $Mode
    DbName = $DbName
    DbSchema = $DbSchema
    StartedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}
