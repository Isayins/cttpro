param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SyncArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyvenvCfg = Join-Path $root ".venv\\pyvenv.cfg"
$sitePackages = Join-Path $root ".venv\\Lib\\site-packages"
$scriptPath = Join-Path $root "sync_tushare.py"

function Resolve-BasePython {
    if ($env:PYTHON_QUANT_BASE_PYTHON) {
        return $env:PYTHON_QUANT_BASE_PYTHON
    }

    if (Test-Path $pyvenvCfg) {
        foreach ($line in Get-Content $pyvenvCfg) {
            if ($line -match "^executable = (.+)$") {
                return $Matches[1].Trim()
            }
            if ($line -match "^home = (.+)$") {
                return (Join-Path $Matches[1].Trim() "python.exe")
            }
        }
    }

    throw "Unable to resolve the base Python executable. Set PYTHON_QUANT_BASE_PYTHON first."
}

$pythonExe = Resolve-BasePython
if (-not (Test-Path $pythonExe)) {
    throw "Base Python not found: $pythonExe"
}

if (-not (Test-Path $sitePackages)) {
    throw "Missing local site-packages: $sitePackages"
}

$existingPythonPath = $env:PYTHONPATH
if ([string]::IsNullOrWhiteSpace($existingPythonPath)) {
    $env:PYTHONPATH = "$sitePackages;$root"
} else {
    $env:PYTHONPATH = "$sitePackages;$root;$existingPythonPath"
}

& $pythonExe $scriptPath @SyncArgs
