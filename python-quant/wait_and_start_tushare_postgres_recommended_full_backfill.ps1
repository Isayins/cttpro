param(
    [int]$WaitForPid,
    [int]$PollSeconds = 30,
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
    [string]$StartPhase = "financials-full-2010"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($WaitForPid -le 0) {
    throw "WaitForPid must be a positive integer."
}

if (-not $TushareToken) {
    throw "TushareToken is required."
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $root "run_tushare_postgres_recommended_full_backfill.ps1"

Write-Host ("Watching PID {0} at {1}" -f $WaitForPid, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))

while ($true) {
    $process = Get-Process -Id $WaitForPid -ErrorAction SilentlyContinue
    if (-not $process) {
        break
    }

    Write-Host ("PID {0} still running at {1}; checking again in {2}s" -f $WaitForPid, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $PollSeconds)
    Start-Sleep -Seconds $PollSeconds
}

Write-Host ("PID {0} finished at {1}; starting recommended full backfill from {2}" -f $WaitForPid, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $StartPhase)

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
    "-TusharePauseMs", "$TusharePauseMs",
    "-StartPhase", $StartPhase
)

if ($EndDate) {
    $argList += @("-EndDate", $EndDate)
}

& "powershell.exe" @argList
if ($LASTEXITCODE -ne 0) {
    throw "Recommended full backfill failed from phase $StartPhase"
}
