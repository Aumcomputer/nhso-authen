# ==============================================================================
# NHSO SRM Token Sync Agent (PowerShell Edition)
# Monitors token.txt from SRM Smart Card Single Sign-On and sends to Server
# ==============================================================================

# ----------------- [ SERVER CONNECTION SETTINGS ] -----------------
# Set to your server URL (e.g. http://10.10.10.50:4100/api/token/report or http://localhost:4100/api/token/report)
$SERVER_URL   = "http://nhso-authen.local/api/token/report"
$AGENT_SECRET = "nhso-agent-secret-10677-rbh"
# ------------------------------------------------------------------

$TOKEN_DIR    = "$env:USERPROFILE\SRM Smart Card Single Sign-On"
$TOKEN_PATH   = "$TOKEN_DIR\token.txt"
$LOG_FILE     = "C:\NHSO-Agent\agent.log"

function Write-AgentLog {
    param([string]$message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $message"
    try {
        if (-not (Test-Path "C:\NHSO-Agent")) {
            New-Item -ItemType Directory -Path "C:\NHSO-Agent" -Force | Out-Null
        }
        Add-Content -Path $script:LOG_FILE -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    } catch {}
}

Write-AgentLog "Agent started. Monitoring '$TOKEN_PATH' -> '$SERVER_URL'"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "NHSO SRM Token Sync Agent is running..." -ForegroundColor Green
Write-Host "Hostname:    $env:COMPUTERNAME" -ForegroundColor Yellow
Write-Host "Watch file:  $TOKEN_PATH" -ForegroundColor Yellow
Write-Host "Server URL:  $SERVER_URL" -ForegroundColor Yellow
Write-Host "Log file:    $LOG_FILE" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

$lastSentHash = ""

function Send-TokenToServer {
    param([string]$filePath)

    if (-not (Test-Path $filePath)) { return }

    # Wait briefly for file write completion
    Start-Sleep -Milliseconds 500

    try {
        $rawLines = Get-Content -Path $filePath -ErrorAction Stop
        if (-not $rawLines) { return }

        $content = $rawLines -join "`n"
        if (-not $content -or $content.Trim() -eq "") { return }

        # Check MD5 hash to prevent duplicate requests
        $md5 = [System.Security.Cryptography.MD5]::Create()
        $currentHash = [System.BitConverter]::ToString($md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($content)))
        if ($currentHash -eq $script:lastSentHash) {
            return
        }

        # Extract tokens directly
        $accessToken = ""
        $refreshToken = ""
        foreach ($line in $rawLines) {
            $trimmed = $line.Trim()
            if ($trimmed.StartsWith("access-token=")) {
                $accessToken = $trimmed.Substring("access-token=".Length).Trim()
            } elseif ($trimmed.StartsWith("refresh-token=")) {
                $refreshToken = $trimmed.Substring("refresh-token=".Length).Trim()
            }
        }

        if (-not $refreshToken) {
            Write-AgentLog "Skipped: token.txt does not contain refresh-token yet."
            return
        }

        $nowStr = Get-Date -Format 'HH:mm:ss'
        Write-Host "[$nowStr] New token detected. Sending to server..." -ForegroundColor Cyan

        $payload = @{
            client_hostname = $env:COMPUTERNAME
            agent_secret    = $script:AGENT_SECRET
            access_token    = $accessToken
            refresh_token   = $refreshToken
        } | ConvertTo-Json -Compress

        $headers = @{
            "X-Agent-Secret" = $script:AGENT_SECRET
        }

        $response = Invoke-RestMethod -Uri $script:SERVER_URL -Method Post -Body $payload -ContentType "application/json; charset=utf-8" -Headers $headers -TimeoutSec 10

        if ($response.success) {
            $script:lastSentHash = $currentHash
            $officer = $response.data.officerName
            $exp = $response.data.refreshExpiresAt
            Write-Host "[$nowStr] Token sync SUCCESS. Officer: $officer (Expires: $exp)" -ForegroundColor Green
            Write-AgentLog "Token sync SUCCESS. Officer: $officer (Expires: $exp)"
        } else {
            Write-Host "[$nowStr] Server rejected: $($response.message)" -ForegroundColor Yellow
            Write-AgentLog "Server rejected: $($response.message)"
        }
    } catch {
        $err = $_.Exception.Message
        $detail = ""
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $errBody = $reader.ReadToEnd()
                if ($errBody) {
                    $json = $errBody | ConvertFrom-Json -ErrorAction SilentlyContinue
                    if ($json.message) { $detail = " - $($json.message)" }
                    else { $detail = " - $errBody" }
                }
            }
        } catch {}
        $nowStr = Get-Date -Format 'HH:mm:ss'
        Write-Host "[$nowStr] Failed to send token: $err$detail" -ForegroundColor Red
        Write-AgentLog "Failed to send token: $err$detail"
    }
}

# Run first check immediately on start if token file exists
if (Test-Path $TOKEN_PATH) {
    Send-TokenToServer -filePath $TOKEN_PATH
}

# Polling loop (checks every 5 seconds)
while ($true) {
    Start-Sleep -Seconds 5
    if (Test-Path $TOKEN_PATH) {
        Send-TokenToServer -filePath $TOKEN_PATH
    }
}
