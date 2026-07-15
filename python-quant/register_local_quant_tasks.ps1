param(
    [string]$DailyTime = "18:40",
    [string]$WeekendTime = "09:30",
    [string]$TaskPrefix = "QuantLocal",
    [string]$SourceDir = "I:\\Stock\\Stock\\Everyday2\\UnAdjustedStock",
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 3306,
    [string]$DbUser = "root",
    [string]$DbPassword = "root",
    [string]$DbName = "quant",
    [switch]$EnableTushareSync,
    [string]$TushareToken = "",
    [string]$TushareHttpUrl = "http://tsy.xiaodefa.cn"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $root "run_local_quant_pipeline.ps1"

function New-TaskCommand {
    param(
        [string]$Mode
    )

    $parts = @(
        'powershell.exe',
        '-ExecutionPolicy', 'Bypass',
        '-File', ('"{0}"' -f $runner),
        '-Mode', $Mode,
        '--source-dir', ('"{0}"' -f $SourceDir),
        '--db-host', $DbHost,
        '--db-port', $DbPort,
        '--db-user', $DbUser,
        '--db-password', $DbPassword,
        '--db-name', $DbName
    )

    if ($EnableTushareSync) {
        $parts += '--enable-tushare-sync'
        $parts += '--tushare-http-url'
        $parts += ('"{0}"' -f $TushareHttpUrl)
        if ($TushareToken) {
            $parts += '--tushare-token'
            $parts += ('"{0}"' -f $TushareToken)
        }
    }

    return $parts -join ' '
}

$dailyTaskName = "$TaskPrefix-Daily"
$weekendTaskName = "$TaskPrefix-Weekend"

$dailyCommand = New-TaskCommand -Mode "daily"
$weekendCommand = New-TaskCommand -Mode "weekend"

schtasks /Create /F /TN $dailyTaskName /SC DAILY /ST $DailyTime /TR $dailyCommand | Out-Null
schtasks /Create /F /TN $weekendTaskName /SC WEEKLY /D SAT /ST $WeekendTime /TR $weekendCommand | Out-Null

Write-Host "Created scheduled tasks:"
Write-Host "  $dailyTaskName -> $DailyTime daily"
Write-Host "  $weekendTaskName -> $WeekendTime every Saturday"
