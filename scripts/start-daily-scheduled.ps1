param([string]$NodeExecutable)
$ErrorActionPreference = 'Stop'
$repoDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoDirectory
if (-not (Test-Path -LiteralPath $NodeExecutable -PathType Leaf)) { throw 'Configured Node executable is missing.' }
$logDirectory = Join-Path $repoDirectory 'data\operator\schedule'
[System.IO.Directory]::CreateDirectory($logDirectory) | Out-Null
$date = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'China Standard Time').ToString('yyyy-MM-dd')
$logPath = Join-Path $logDirectory "$date.log"
& $NodeExecutable (Join-Path $PSScriptRoot 'daily-scheduled.mjs') >> $logPath 2>&1
exit $LASTEXITCODE
