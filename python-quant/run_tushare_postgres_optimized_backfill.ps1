param(
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
    [int]$TusharePauseMs = 350,
    [int]$StkMinsFullBackfillTradeDays = 5,
    [string]$StartPhase = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $root "run_tushare_postgres_sync.py"

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

$phases = @(
    @{
        Name = "phase-2000-core"
        Args = @(
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
            "--full-start-date", "20000101",
            "--reset-state",
            "--only-groups", "reference,marketRaw",
            "--only-trade-date-datasets", "daily_basic,stk_nineturn"
        )
    },
    @{
        Name = "phase-2010-market"
        Args = @(
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
            "--full-start-date", "20100101",
            "--reset-state",
            "--only-groups", "marketRaw,announcementRaw,rangeRaw",
            "--only-trade-date-datasets", "moneyflow,bak_daily,stk_limit,suspend_d,top_list,top_inst,margin,margin_detail,margin_secs,hk_hold,hsgt_top10_sh,hsgt_top10_sz",
            "--only-ann-datasets", "forecast,express,dividend,stk_holdernumber,top10_holders,top10_floatholders,stk_holdertrade",
            "--only-range-datasets", "report_rc,moneyflow_hsgt,block_trade,repurchase"
        )
    },
    @{
        Name = "phase-2010-financials"
        Args = @(
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
            "--full-start-date", "20100101",
            "--reset-state",
            "--only-groups", "financialStatements,symbolExtras",
            "--only-financial-datasets", "income,balancesheet,cashflow,fina_indicator",
            "--only-symbol-extra-datasets", "fina_audit,fina_mainbz_product,fina_mainbz_region,pledge_stat,pledge_detail"
        )
    },
    @{
        Name = "phase-2020-modern"
        Args = @(
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
            "--full-start-date", "20200101",
            "--reset-state",
            "--only-groups", "marketRaw,contentRaw,independentApis",
            "--only-trade-date-datasets", "cyq_perf,stk_auction_o,stk_auction_c",
            "--only-content-datasets", "cctv_news,index_global",
            "--enable-stk-mins",
            "--stk-mins-full-backfill-trade-days", "$StkMinsFullBackfillTradeDays"
        )
    }
)

if ($StartPhase) {
    $startIndex = -1
    for ($i = 0; $i -lt $phases.Count; $i++) {
        if ($phases[$i].Name -eq $StartPhase) {
            $startIndex = $i
            break
        }
    }

    if ($startIndex -lt 0) {
        $phaseNames = ($phases | ForEach-Object { $_.Name }) -join ", "
        throw "Unknown StartPhase '$StartPhase'. Valid values: $phaseNames"
    }

    $phases = @($phases | Select-Object -Skip $startIndex)
}

foreach ($phase in $phases) {
    Write-Host ("Starting {0} at {1}" -f $phase.Name, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    & $pythonExe $scriptPath @($phase.Args)
    if ($LASTEXITCODE -ne 0) {
        throw "Phase failed: $($phase.Name)"
    }
    Write-Host ("Completed {0} at {1}" -f $phase.Name, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
}
