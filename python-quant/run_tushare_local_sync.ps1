param(
    [ValidateSet("daily", "weekend", "full")]
    [string]$Mode = "daily",

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SyncArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $root "run_tushare_local_sync.py"

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

$pythonExe = Resolve-Python
if (-not (Test-Path $pythonExe)) {
    throw "Python not found: $pythonExe"
}

& $pythonExe $scriptPath --mode $Mode @SyncArgs
