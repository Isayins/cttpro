param(
    [ValidateSet("daily", "weekend")]
    [string]$Mode = "daily",

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PipelineArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $root "run_local_quant_pipeline.py"

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

& $pythonExe $scriptPath --mode $Mode @PipelineArgs
