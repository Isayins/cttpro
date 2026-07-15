param(
    [string]$StartDate = "20100101",
    [string]$EndDate = "",
    [int]$SegmentCount = 5,
    [string]$StateFilePrefix = "_full_market_enhanced_2010",
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

function Convert-ToYmdDate {
    param(
        [string]$Value,
        [string]$FieldName
    )

    try {
        return [datetime]::ParseExact(
            $Value,
            "yyyyMMdd",
            [System.Globalization.CultureInfo]::InvariantCulture
        )
    }
    catch {
        throw "$FieldName must use yyyyMMdd format."
    }
}

if (-not $TushareToken) {
    throw "TushareToken is required."
}
if ($SegmentCount -le 0) {
    throw "SegmentCount must be greater than 0."
}

$resolvedEndDate = if ($EndDate) { $EndDate } else { (Get-Date).ToString("yyyyMMdd") }
$startDateValue = Convert-ToYmdDate -Value $StartDate -FieldName "StartDate"
$endDateValue = Convert-ToYmdDate -Value $resolvedEndDate -FieldName "EndDate"

if ($endDateValue -lt $startDateValue) {
    throw "EndDate must be greater than or equal to StartDate."
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$segmentRunnerPath = Join-Path $root "run_tushare_postgres_marketraw_segment.ps1"
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$totalDays = [int](($endDateValue - $startDateValue).TotalDays) + 1
$actualSegments = [Math]::Min($SegmentCount, $totalDays)
$started = @()

Write-Host ("Starting market-enhanced parallel backfill: {0} -> {1} | segments={2}" -f $StartDate, $resolvedEndDate, $actualSegments)

for ($index = 0; $index -lt $actualSegments; $index++) {
    $segmentStartOffset = [int][Math]::Floor(($totalDays * $index) / $actualSegments)
    $segmentEndOffset = [int][Math]::Floor(($totalDays * ($index + 1)) / $actualSegments) - 1
    if ($segmentEndOffset -lt $segmentStartOffset) {
        $segmentEndOffset = $segmentStartOffset
    }

    $segmentStart = $startDateValue.AddDays($segmentStartOffset)
    $segmentEnd = $startDateValue.AddDays($segmentEndOffset)
    $segmentName = "seg_{0}" -f ($index + 1)
    $segmentStartText = $segmentStart.ToString("yyyyMMdd")
    $segmentEndText = $segmentEnd.ToString("yyyyMMdd")
    $stateFileSuffix = "{0}_{1}" -f $StateFilePrefix, $segmentName
    $stdoutPath = Join-Path $logDir ("parallel-marketraw-{0}.out.log" -f $segmentName)
    $stderrPath = Join-Path $logDir ("parallel-marketraw-{0}.err.log" -f $segmentName)
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -ErrorAction SilentlyContinue

    $args = @(
        "-ExecutionPolicy", "Bypass",
        "-File", $segmentRunnerPath,
        "-StartDate", $segmentStartText,
        "-EndDate", $segmentEndText,
        "-StateFileSuffix", $stateFileSuffix,
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

    $process = Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList $args `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath

    $started += [pscustomobject]@{
        Segment = $segmentName
        StartDate = $segmentStartText
        EndDate = $segmentEndText
        StateFileSuffix = $stateFileSuffix
        ProcessId = $process.Id
        StdoutLog = $stdoutPath
        StderrLog = $stderrPath
        Process = $process
    }
}

$failures = @()
foreach ($item in $started) {
    $item.Process.WaitForExit()
    $exitCode = $item.Process.ExitCode
    Write-Host ("Completed {0} ({1} -> {2}) with exit code {3}" -f $item.Segment, $item.StartDate, $item.EndDate, $exitCode)
    if ($exitCode -ne 0) {
        $failures += [pscustomobject]@{
            Segment = $item.Segment
            StartDate = $item.StartDate
            EndDate = $item.EndDate
            ExitCode = $exitCode
            StderrLog = $item.StderrLog
        }
    }
}

$started |
    Select-Object Segment, StartDate, EndDate, StateFileSuffix, ProcessId, StdoutLog, StderrLog |
    Format-Table -AutoSize

if ($failures.Count -gt 0) {
    $failureSummary = ($failures | ForEach-Object {
        "{0}({1}-{2}) exit={3}" -f $_.Segment, $_.StartDate, $_.EndDate, $_.ExitCode
    }) -join "; "
    throw "Parallel market-enhanced backfill failed: $failureSummary"
}

Write-Host ("All market-enhanced segments completed successfully at {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
