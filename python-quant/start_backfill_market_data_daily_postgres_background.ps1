param(
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432,
    [string]$DbUser = "postgres",
    [string]$DbPassword = "",
    [string]$DbName = "quant",
    [string]$SourceSchema = "tushare_data",
    [string]$TargetSchema = "market_data",
    [string]$TushareToken = "",
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
$runnerPath = Join-Path $root "backfill_market_data_daily_postgres.ps1"
$logDir = Join-Path $root "logs\\market-data-backfill"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stdout = Join-Path $logDir "backfill-market-data-$stamp.log"
$stderr = Join-Path $logDir "backfill-market-data-$stamp.err.log"

$argList = @(
    "-ExecutionPolicy", "Bypass",
    "-File", $runnerPath,
    "-DbHost", $DbHost,
    "-DbPort", "$DbPort",
    "-DbUser", $DbUser,
    "-DbPassword", $DbPassword,
    "-DbName", $DbName,
    "-SourceSchema", $SourceSchema,
    "-TargetSchema", $TargetSchema,
    "-TushareHttpUrl", $TushareHttpUrl,
    "-BatchSize", "$BatchSize"
)

if ($TushareToken) {
    $argList += @("-TushareToken", $TushareToken)
}
if ($Year) {
    foreach ($item in $Year) {
        $argList += @("-Year", "$item")
    }
}
if ($StartDate) {
    $argList += @("-StartDate", $StartDate)
}
if ($EndDate) {
    $argList += @("-EndDate", $EndDate)
}
if ($DryRun) {
    $argList += "-DryRun"
}

$process = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
[pscustomobject]@{
    ProcessId = $process.Id
    Script = $runnerPath
    Stdout = $stdout
    Stderr = $stderr
    StartedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}
