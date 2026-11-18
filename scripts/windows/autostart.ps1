# Цахим номын санг Windows асахад автоматаар ажиллуулах тохиргоо.
#
# Ашиглах ("Run as administrator" сонгож нээсэн PowerShell-д):
#   cd C:\nomiin-san
#   powershell -ExecutionPolicy Bypass -File scripts\windows\autostart.ps1
#
# Буцааж устгах:
#   powershell -ExecutionPolicy Bypass -File scripts\windows\autostart.ps1 -Remove
#
# Хийх зүйлс:
#   1. Windows асахад серверийг асаадаг "TsahimNomiinSan" нэртэй даалгавар үүсгэнэ
#      (хэн ч нэвтрээгүй байсан ч ажиллана, унтарвал 1 минутын дараа дахин асна).
#   2. Серверийн мэдээллийг data\server.log файлд бичнэ.
#   3. Дотоод сүлжээнээс хандах Firewall зөвшөөрөл нэмнэ.
#   4. Цахилгаанд залгаатай үед компьютер унтдаггүй болгоно.

param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$TaskName = 'TsahimNomiinSan'
$FirewallRule = 'Tsahim Nomiin San'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = ([Security.Principal.WindowsPrincipal]$identity).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host 'PowerShell-ийг "Run as administrator" сонгож нээгээд дахин ажиллуулна уу.' -ForegroundColor Red
  exit 1
}

if ($Remove) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Remove-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue
  Write-Host 'Автоматаар асах тохиргоог устгалаа.' -ForegroundColor Green
  exit 0
}

$project = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Host 'Node.js олдсонгүй. https://nodejs.org -оос LTS хувилбарыг суулгаад PowerShell-ээ дахин нээнэ үү.' -ForegroundColor Red
  exit 1
}
$node = $nodeCommand.Source

if (-not (Test-Path (Join-Path $project 'node_modules'))) {
  Write-Host 'Эхлээд төслийн хавтсанд "npm install" командыг ажиллуулна уу.' -ForegroundColor Red
  exit 1
}

$envFile = Join-Path $project '.env'
$port = 3000
if (Test-Path $envFile) {
  $match = Select-String -Path $envFile -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
  if ($match) { $port = [int]$match.Matches[0].Groups[1].Value }
  if (-not (Select-String -Path $envFile -Pattern '^\s*ADMIN_PASSWORD\s*=\s*\S' -Quiet)) {
    Write-Host 'Анхааруулга: .env файлд ADMIN_PASSWORD бичээгүй байна (анхдагч admin123 ажиллана).' -ForegroundColor Yellow
  }
} else {
  Write-Host 'Анхааруулга: .env файл алга. "copy .env.example .env" хийгээд нууц үгээ бичнэ үү.' -ForegroundColor Yellow
}

$dataDir = Join-Path $project 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$log = Join-Path $dataDir 'server.log'

# 1. Windows асахад ажиллах даалгавар
$arguments = "/c `"`"$node`" server.js >> `"$log`" 2>&1`""
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $arguments -WorkingDirectory $project
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal `
  -Settings $settings -Description 'Tsahim nomiin san web server' -Force | Out-Null

# 2. Дотоод сүлжээнээс хандах Firewall зөвшөөрөл
Remove-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $FirewallRule -Direction Inbound -Protocol TCP -LocalPort $port `
  -Action Allow -Profile Domain, Private | Out-Null

# 3. Цахилгаанд залгаатай үед унтахгүй
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

# 4. Одоо асааж шалгах
Start-ScheduledTask -TaskName $TaskName
Write-Host 'Сервер асаж байна...'
Start-Sleep -Seconds 4
try {
  Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port/healthz" -TimeoutSec 5 | Out-Null
  Write-Host ''
  Write-Host "Бэлэн! Сервер http://localhost:$port хаягаар ажиллаж байна." -ForegroundColor Green
  Write-Host 'Компьютер дахин асахад автоматаар асна.'
} catch {
  Write-Host ''
  Write-Host "Сервер хариу өгсөнгүй. Алдааг харах: notepad `"$log`"" -ForegroundColor Red
  exit 1
}
