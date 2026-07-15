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
    [string]$EndDate,
    [string]$StartPhase = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $root "run_tushare_postgres_sync.py"
$parallelMarketRawPath = Join-Path $root "run_tushare_postgres_parallel_marketraw_backfill.ps1"

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

$baseArgs = @(
    "--mode", "full",
    "--db-host", $DbHost,
    "--db-port", "$DbPort",
    "--db-user", $DbUser,
    "--db-password", $DbPassword,
    "--db-name", $DbName,
    "--db-schema", $DbSchema,
    "--db-connect-timeout", "$DbConnectTimeout",
    "--db-connect-retries", "$DbConnectRetries",
    "--db-connect-retry-sleep", "$DbConnectRetrySleep",
    "--tushare-token", $TushareToken,
    "--tushare-http-url", $TushareHttpUrl,
    "--tushare-pause-ms", "$TusharePauseMs",
    "--skip-setup"
)

if ($EndDate) {
    $baseArgs += @("--end-date", $EndDate)
}

$marketEnhancedTradeDateDatasets = "daily_basic,moneyflow,bak_daily,stk_nineturn,stk_limit,suspend_d,top_list,top_inst,margin,margin_detail,margin_secs,hk_hold,hsgt_top10_sh,hsgt_top10_sz"

$phases = @(
    @{
        Name = "market-enhanced-full-2010"
        StateSuffix = "_full_market_enhanced_2010"
        Mode = "parallel_market"
        StartDate = "20100101"
        SegmentCount = 5
    },
    @{
        Name = "financials-full-2010"
        StateSuffix = "_full_financials_2010"
        Mode = "standard"
        Args = @(
            "--full-start-date", "20100101",
            "--only-groups", "financialStatements",
            "--only-financial-datasets", "income,balancesheet,cashflow,fina_indicator"
        )
    },
    @{
        Name = "symbol-extras-full-2010"
        StateSuffix = "_full_symbol_extras_2010"
        Mode = "standard"
        Args = @(
            "--full-start-date", "20100101",
            "--only-groups", "symbolExtras",
            "--only-symbol-extra-datasets", "fina_audit,fina_mainbz_product,fina_mainbz_region,pledge_stat,pledge_detail"
        )
    },
    @{
        Name = "announcements-full-2010"
        StateSuffix = "_full_announcements_2010"
        Mode = "standard"
        Args = @(
            "--full-start-date", "20100101",
            "--only-groups", "announcementRaw",
            "--only-ann-datasets", "forecast,express,dividend,stk_holdernumber,top10_holders,top10_floatholders,stk_holdertrade"
        )
    },
    @{
        Name = "range-full-2010"
        StateSuffix = "_full_range_2010"
        Mode = "standard"
        Args = @(
            "--full-start-date", "20100101",
            "--only-groups", "rangeRaw",
            "--only-range-datasets", "report_rc,moneyflow_hsgt,block_trade,repurchase"
        )
    },
    @{
        Name = "modern-full-2020"
        StateSuffix = "_full_modern_2020"
        Mode = "standard"
        Args = @(
            "--full-start-date", "20200101",
            "--only-groups", "marketRaw,contentRaw,independentApis",
            "--only-trade-date-datasets", "cyq_perf,stk_auction_o,stk_auction_c",
            "--only-content-datasets", "cctv_news,index_global"
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
        $validNames = ($phases | ForEach-Object { $_.Name }) -join ", "
        throw "Unknown StartPhase '$StartPhase'. Valid values: $validNames"
    }

    $phases = @($phases | Select-Object -Skip $startIndex)
}

foreach ($phase in $phases) {
    Write-Host ("Starting {0} at {1}" -f $phase.Name, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    if ($phase.Mode -eq "parallel_market") {
        $parallelArgs = @(
            "-ExecutionPolicy", "Bypass",
            "-File", $parallelMarketRawPath,
            "-StartDate", $phase.StartDate,
            "-SegmentCount", "$($phase.SegmentCount)",
            "-StateFilePrefix", $phase.StateSuffix,
            "-OnlyTradeDateDatasets", $marketEnhancedTradeDateDatasets,
            "-DbHost", $DbHost,
            "-DbPort", "$DbPort",
            "-DbUser", $DbUser,
            "-DbPassword", $DbPassword,
            "-DbName", $DbName,
            "-DbSchema", $DbSchema,
            "-DbConnectTimeout", "$DbConnectTimeout",
            "-DbConnectRetries", "$DbConnectRetries",
            "-DbConnectRetrySleep", "$DbConnectRetrySleep",
            "-TushareToken", $TushareToken,
            "-TushareHttpUrl", $TushareHttpUrl,
            "-TusharePauseMs", "$TusharePauseMs"
        )
        if ($EndDate) {
            $parallelArgs += @("-EndDate", $EndDate)
        }
        & "powershell.exe" @parallelArgs
    }
    else {
        $argList = @($baseArgs + @("--state-file-suffix", $phase.StateSuffix) + $phase.Args)
        & $pythonExe $scriptPath @argList
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Phase failed: $($phase.Name)"
    }
    Write-Host ("Completed {0} at {1}" -f $phase.Name, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
}
