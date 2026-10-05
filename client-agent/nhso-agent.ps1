# ==============================================================================
# NHSO SRM Token Sync Agent (PowerShell Edition)
# คอยตรวจสอบไฟล์ token.txt จากโปรแกรม SRM Smart Card Single Sign-On
# และส่งขึ้นระบบ NHSO Authen Server อัตโนมัติทันทีที่เจ้าหน้าที่เสียบบัตร
# ==============================================================================

# ----------------- [ ส่วนตั้งค่าการเชื่อมต่อ SERVER ] -----------------
# 💡 หากนำไปติดตั้งบน Production Server ให้เปลี่ยน SERVER_IP เป็น IP ของ Server
$SERVER_URL   = "http://10.10.90.53:4100/api/token/report"
$AGENT_SECRET = "nhso-agent-secret-10677-rbh"
# --------------------------------------------------------------------

$TOKEN_DIR    = "$env:USERPROFILE\SRM Smart Card Single Sign-On"
$TOKEN_PATH   = "$TOKEN_DIR\token.txt"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🚀 NHSO SRM Token Sync Agent กำลังทำงาน..." -ForegroundColor Green
Write-Host "🖥️  ชื่อเครื่องลูกข่าย: $env:COMPUTERNAME" -ForegroundColor Yellow
Write-Host "📁 เฝ้าติดตามไฟล์: $TOKEN_PATH" -ForegroundColor Yellow
Write-Host "🌐 ปลายทาง Server: $SERVER_URL" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

$lastSentHash = ""

function Send-TokenToServer {
    param([string]$filePath)

    if (-not (Test-Path $filePath)) { return }

    # รอไฟล์ปลดล็อกชั่วครู่
    Start-Sleep -Milliseconds 500

    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8 -ErrorAction Stop
        if (-not $content -or $content.Trim() -eq "") { return }

        # เช็คว่าเนื้อหาเปลี่ยนไปจากครั้งล่าสุดหรือไม่ (ป้องกันการส่งซ้ำ)
        $currentHash = [System.BitConverter]::ToString(([System.Security.Cryptography.MD5]::Create()).ComputeHash([System.Text.Encoding]::UTF8.GetBytes($content)))
        if ($currentHash -eq $script:lastSentHash) {
            return
        }

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 🔄 ตรวจพบ Token ใหม่จากบัตร Smart Card กำลังส่งขึ้น Server..." -ForegroundColor Cyan

        $payload = @{
            client_hostname = $env:COMPUTERNAME
            token_text      = $content
        } | ConvertTo-Json -Compress

        $headers = @{
            "Content-Type"   = "application/json; charset=utf-8"
            "X-Agent-Secret" = $script:AGENT_SECRET
        }

        $response = Invoke-RestMethod -Uri $script:SERVER_URL -Method Post -Body $payload -Headers $headers -TimeoutSec 10

        if ($response.success) {
            $script:lastSentHash = $currentHash
            $officer = $response.data.officerName
            $exp = $response.data.refreshExpiresAt
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ ส่ง Token สำเร็จ! [เจ้าหน้าที่: $officer | หมดอายุ: $exp]" -ForegroundColor Green
        } else {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️ Server แจ้งเตือน: $($response.message)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ ส่ง Token ไม่สำเร็จ: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ส่งครั้งแรกเมื่อ Agent สตาร์ท (กรณีมีไฟล์อยู่แล้ว)
if (Test-Path $TOKEN_PATH) {
    Send-TokenToServer -filePath $TOKEN_PATH
}

# วนลูปเฝ้าตรวจจับไฟล์ (Polling ทุก 5 วินาที กินทรัพยากรต่ำมาก < 10MB)
while ($true) {
    Start-Sleep -Seconds 5
    if (Test-Path $TOKEN_PATH) {
        Send-TokenToServer -filePath $TOKEN_PATH
    }
}
