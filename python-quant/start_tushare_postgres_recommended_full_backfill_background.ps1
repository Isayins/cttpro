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
$runnerPath = Join-Path $root "run_tushare_postgres_recommended_full_backfill.ps1"

if (-not $TushareToken) {
    throw "TushareToken is required."
}

$argList = @(
    "-ExecutionPolicy", "Bypass",
    "-File", $runnerPath,
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
if ($StartPhase) {
    $argList += @("-StartPhase", $StartPhase)
}

$process = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -WindowStyle Hidden -PassThru
[pscustomobject]@{
    ProcessId = $process.Id
    Script = $runnerPath
    StartedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}
