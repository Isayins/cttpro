param(
    [string]$StartDate,
    [string]$EndDate,
    [string]$StateFileSuffix,
    [string]$OnlyTradeDateDatasets = "daily_basic,moneyflow,bak_daily,stk_nineturn,stk_limit,suspend_d,top_list,top_inst,margin,margin_detail,margin_secs,hk_hold,hsgt_top10_sh,hsgt_top10_sz",
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432,
    [string]$DbUser = "postgres",
    [string]$DbPassword = "",
    [string]$DbName = "quant",
    [string]$DbSchema = "tushare_data",
    [int]$DbConnectTimeout = 30,
    [int]$DbConnectRetries = 8,
    [double]$DbConnectRetrySleep = 3,
    [string]$TushareToken,
    [string]$TushareHttpUrl = "http://tsy.xiaodefa.cn",
    [int]$TusharePauseMs = 350
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $StartDate) {
    throw "StartDate is required."
}
if (-not $EndDate) {
    throw "EndDate is required."
}
if (-not $StateFileSuffix) {
    throw "StateFileSuffix is required."
}
if (-not $TushareToken) {
    throw "TushareToken is required."
}

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

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $root "run_tushare_postgres_sync.py"
$pythonPath = Resolve-Python

if (-not (Test-Path $pythonPath)) {
    throw "Python not found: $pythonPath"
}

$argList = @(
    $runnerPath,
    "--mode", "full",
    "--db-host", $DbHost,
    "--db-port", "$DbPort",
    "--db-user", $DbUser,
    "--db-password", $DbPassword,
    "--db-name", $DbName,
    "--db-connect-timeout", "$DbConnectTimeout",
    "--db-connect-retries", "$DbConnectRetries",
    "--db-connect-retry-sleep", "$DbConnectRetrySleep",
    "--db-schema", $DbSchema,
    "--tushare-token", $TushareToken,
    "--tushare-http-url", $TushareHttpUrl,
    "--tushare-pause-ms", "$TusharePauseMs",
    "--full-start-date", $StartDate,
    "--end-date", $EndDate,
    "--skip-setup",
    "--state-file-suffix", $StateFileSuffix,
    "--only-groups", "marketRaw",
    "--only-trade-date-datasets", $OnlyTradeDateDatasets
)

& $pythonPath @argList

if ($LASTEXITCODE -ne 0) {
    throw "MarketRaw segment sync failed for $StartDate to $EndDate."
}
