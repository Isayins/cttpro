param(
    [string]$StartDate = "20100101",
    [string]$EndDate = "",
    [int]$SegmentCount = 5,
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

if (-not $TushareToken) {
    throw "TushareToken is required."
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $root "run_tushare_postgres_parallel_marketraw_backfill.ps1"
$argList = @(
    "-ExecutionPolicy", "Bypass",
    "-File", $runnerPath,
    "-StartDate", $StartDate,
    "-SegmentCount", "$SegmentCount",
    "-OnlyTradeDateDatasets", $OnlyTradeDateDatasets,
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
    $argList += @("-EndDate", $EndDate)
}

$process = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -WindowStyle Hidden -PassThru
[pscustomobject]@{
    ProcessId = $process.Id
    Script = $runnerPath
    StartDate = $StartDate
    EndDate = $(if ($EndDate) { $EndDate } else { "" })
    SegmentCount = $SegmentCount
    StartedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}
