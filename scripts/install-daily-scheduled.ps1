# Explicit owner-operated registration. Does not start the job or send mail.
$ErrorActionPreference = 'Stop'
$taskName = 'Observer-Daily-0730'
$repoDirectory = Split-Path -Parent $PSScriptRoot
if ((Get-TimeZone).Id -ne 'China Standard Time') { throw 'Task requires Windows China Standard Time (Asia/Shanghai).' }
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'Existing Observer task found; inspect it before changing it.' }
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launcher = Join-Path $PSScriptRoot 'start-daily-scheduled.ps1'
Set-Location -LiteralPath $repoDirectory
& $nodePath (Join-Path $PSScriptRoot 'daily-scheduled.mjs') --check
if ($LASTEXITCODE -ne 0) { throw 'Read-only daily prerequisites check failed.' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$nextStart = [DateTime]::Today.AddHours(7).AddMinutes(30)
if ($nextStart -le [DateTime]::Now) { $nextStart = $nextStart.AddDays(1) }
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument "-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File `"$launcher`" -NodeExecutable `"$nodePath`"" -WorkingDirectory $repoDirectory
$trigger = New-ScheduledTaskTrigger -Daily -At $nextStart
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Observer: daily 07:30 Asia/Shanghai cutoff; six HTML editions per subscriber before 08:30. Current user must remain logged in. No automatic repeat of daily claims or SMTP attempts.'
Register-ScheduledTask -TaskName $taskName -InputObject $task | Out-Null
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object NextRunTime, LastTaskResult
