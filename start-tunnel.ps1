# VVM Simulator - Cloudflare Tunnel Başlatıcı
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  VVM SIMULATOR - TUNNEL BAŞLATILIYOR" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Web sunucusu kontrol ediliyor..." -ForegroundColor Yellow

# Port 8000'in açık olup olmadığını kontrol et
$port = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

if (-not $port) {
    Write-Host "Web sunucusu başlatılıyor..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\info\info-systems; python -m http.server 8000"
    Start-Sleep -Seconds 3
}

Write-Host "`nCloudflare Tunnel başlatılıyor..." -ForegroundColor Green
Write-Host "URL aşağıda görünecek:`n" -ForegroundColor White

npx cloudflared tunnel --url http://localhost:8000



