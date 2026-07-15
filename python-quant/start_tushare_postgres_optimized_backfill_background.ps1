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
$runnerPath = Join-Path $root "run_tushare_postgres_optimized_backfill.ps1"

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
    "-TusharePauseMs", "$TusharePauseMs",
    "-StkMinsFullBackfillTradeDays", "$StkMinsFullBackfillTradeDays"
)

if ($StartPhase) {
    $argList += @("-StartPhase", $StartPhase)
}

$process = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -WindowStyle Hidden -PassThru
[pscustomobject]@{
    ProcessId = $process.Id
    Script = $runnerPath
    StartedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}
*** Add File: I:\VibeCodingWorkStore\cttpro\python-quant\wait_and_resume_tushare_postgres_backfill.ps1
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
    [int]$StkMinsFullBackfillTradeDays = 5,
    [string]$StartPhase = "phase-2010-market"
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
$runnerPath = Join-Path $root "run_tushare_postgres_optimized_backfill.ps1"

Write-Host ("Watching PID {0} at {1}" -f $WaitForPid, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))

while ($true) {
    $process = Get-Process -Id $WaitForPid -ErrorAction SilentlyContinue
    if (-not $process) {
        break
    }

    Write-Host ("PID {0} still running at {1}; checking again in {2}s" -f $WaitForPid, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $PollSeconds)
    Start-Sleep -Seconds $PollSeconds
}

Write-Host ("PID {0} finished at {1}; resuming from {2}" -f $WaitForPid, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $StartPhase)

& "powershell.exe" `
    -ExecutionPolicy Bypass `
    -File $runnerPath `
    -DbHost $DbHost `
    -DbPort $DbPort `
    -DbUser $DbUser `
    -DbPassword $DbPassword `
    -DbName $DbName `
    -DbSchema $DbSchema `
    -DbConnectTimeout $DbConnectTimeout `
    -DbConnectRetries $DbConnectRetries `
    -DbConnectRetrySleep $DbConnectRetrySleep `
    -TushareToken $TushareToken `
    -TushareHttpUrl $TushareHttpUrl `
    -TusharePauseMs $TusharePauseMs `
    -StkMinsFullBackfillTradeDays $StkMinsFullBackfillTradeDays `
    -StartPhase $StartPhase

if ($LASTEXITCODE -ne 0) {
    throw "Resume backfill failed from phase $StartPhase"
}
