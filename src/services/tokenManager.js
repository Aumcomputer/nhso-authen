const axios = require('axios');
const fs = require('fs');
const config = require('../config/config');

class TokenManager {
  constructor() {
    this.accessToken = config.accessToken || '';
    this.refreshToken = config.refreshToken || '';
    this.lastRefreshedAt = null;
    this.refreshPromise = null; // Mutex for concurrent refresh requests
  }

  /**
   * Helper to decode JWT payload safely
   */
  decodeJwt(token) {
    if (!token || typeof token !== 'string') return null;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(payloadBase64, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * Helper to write updated tokens back into .env file
   */
  persistTokensToEnv(accessToken, refreshToken) {
    try {
      if (!fs.existsSync(config.envPath)) return;
      let content = fs.readFileSync(config.envPath, 'utf8');

      if (refreshToken) {
        if (content.includes('NHSO_REFRESH_TOKEN=')) {
          content = content.replace(/NHSO_REFRESH_TOKEN=.*(\r?\n|$)/, `NHSO_REFRESH_TOKEN=${refreshToken}$1`);
        } else {
          content += `\nNHSO_REFRESH_TOKEN=${refreshToken}\n`;
        }
      }

      if (accessToken) {
        if (content.includes('NHSO_ACCESS_TOKEN=')) {
          content = content.replace(/NHSO_ACCESS_TOKEN=.*(\r?\n|$)/, `NHSO_ACCESS_TOKEN=${accessToken}$1`);
        } else {
          content += `\nNHSO_ACCESS_TOKEN=${accessToken}\n`;
        }
      }

      fs.writeFileSync(config.envPath, content, 'utf8');
      console.log('[TokenManager] ✅ Successfully persisted updated tokens to .env');
    } catch (err) {
      console.warn('[TokenManager] ⚠️ Failed to persist tokens to .env:', err.message);
    }
  }

  /**
   * Set a new refresh token manually
   */
  setRefreshToken(newToken) {
    if (!newToken || typeof newToken !== 'string') {
      throw new Error('Invalid refresh token provided');
    }
    this.refreshToken = newToken.trim();
    this.accessToken = ''; // Invalidate old access token
    this.persistTokensToEnv('', this.refreshToken);
    console.log('[TokenManager] Updated refresh token in memory and .env');
  }

  /**
   * Helper to parse token endpoint response
   */
  parseTokenResponse(data) {
    if (typeof data === 'object' && data !== null) {
      if (data.error || data.error_description) {
        const desc = data.error_description || data.error;
        throw new Error(`สปสช. แจ้งเตือน: ${desc} (กรุณาให้เจ้าหน้าที่เสียบบัตร Smart Card และล็อกอินเข้า SRM Portal ใหม่)`);
      }
      throw new Error(`Unexpected JSON response from token endpoint: ${JSON.stringify(data)}`);
    }

    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.error || parsed.error_description) {
            const desc = parsed.error_description || parsed.error;
            throw new Error(`สปสช. แจ้งเตือน: ${desc} (กรุณาให้เจ้าหน้าที่เสียบบัตร Smart Card และล็อกอินเข้า SRM Portal ใหม่)`);
          }
        } catch (e) {
          if (e.message.startsWith('สปสช.')) throw e;
        }
      }

      const lines = trimmed.split(/\r?\n/);
      let accessToken = '';
      let refreshToken = '';
      for (const line of lines) {
        const tr = line.trim();
        if (tr.startsWith('access-token=')) {
          accessToken = tr.substring('access-token='.length).trim();
        } else if (tr.startsWith('refresh-token=')) {
          refreshToken = tr.substring('refresh-token='.length).trim();
        }
      }

      if (!accessToken) {
        throw new Error(`Failed to extract access-token from response: ${trimmed.slice(0, 100)}`);
      }

      return { accessToken, refreshToken };
    }

    throw new Error('Unexpected response format from token endpoint');
  }

  /**
   * Refresh Access Token using current Refresh Token
   * Mutex protected: only one HTTP call is performed for concurrent callers
   */
  async refreshAccessToken() {
    if (this.refreshPromise) {
      console.log('[TokenManager] ⏳ Waiting for existing token refresh in progress...');
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please provide a refresh token in .env or via /api/token/update');
    }

    this.refreshPromise = (async () => {
      console.log('[TokenManager] 🔄 Requesting new access token from SRM Portal...');
      try {
        const params = new URLSearchParams();
        params.append('refresh_token', this.refreshToken.trim());

        const response = await axios.post(config.tokenUrl, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000
        });

        const parsed = this.parseTokenResponse(response.data);
        this.accessToken = parsed.accessToken;
        if (parsed.refreshToken) {
          this.refreshToken = parsed.refreshToken; // Token rotation
        }
        this.lastRefreshedAt = new Date();

        console.log('[TokenManager] 🎉 Token refreshed successfully!');
        this.persistTokensToEnv(this.accessToken, this.refreshToken);

        return {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          refreshedAt: this.lastRefreshedAt
        };
      } catch (err) {
        console.warn('[TokenManager] ⚠️ Failed to refresh token with primary refresh_token:', err.response?.data || err.message);

        // Fallback: Check active tokens reported by client agents in database
        try {
          const clientTokenService = require('./clientTokenService');
          const activeTokens = await clientTokenService.getActiveTokens();
          for (const candidate of activeTokens) {
            if (!candidate.refresh_token || candidate.refresh_token.trim() === this.refreshToken.trim()) {
              continue;
            }
            console.log(`[TokenManager] 🔄 Attempting fallback using client token from ${candidate.officer_name || candidate.username || candidate.client_ip} (ID: ${candidate.id})...`);
            try {
              const fallbackParams = new URLSearchParams();
              fallbackParams.append('refresh_token', candidate.refresh_token.trim());

              const fallbackRes = await axios.post(config.tokenUrl, fallbackParams.toString(), {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
              });

              const fbParsed = this.parseTokenResponse(fallbackRes.data);
              this.accessToken = fbParsed.accessToken;
              this.refreshToken = fbParsed.refreshToken || candidate.refresh_token.trim();
              this.lastRefreshedAt = new Date();
              console.log(`[TokenManager] 🎉 Fallback token refresh succeeded with token ID ${candidate.id}!`);
              this.persistTokensToEnv(this.accessToken, this.refreshToken);
              return {
                accessToken: this.accessToken,
                refreshToken: this.refreshToken,
                refreshedAt: this.lastRefreshedAt
              };
            } catch (fbErr) {
              console.warn(`[TokenManager] ⚠️ Candidate token ID ${candidate.id} failed:`, fbErr.message);
              await clientTokenService.markTokenError(candidate.id, fbErr.message);
            }
          }
        } catch (fallbackErr) {
          console.error('[TokenManager] ❌ Fallback search error:', fallbackErr.message);
        }

        const errorMsg = typeof err.response?.data === 'object' 
          ? (err.response?.data?.error_description || JSON.stringify(err.response?.data))
          : (err.message || 'Token refresh failed');
        console.error('[TokenManager] ❌ Failed to refresh token:', errorMsg);
        const error = new Error(`Token refresh failed: ${errorMsg}`);
        error.status = err.response?.status || 500;
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Get valid access token, refreshing if not available or expired
   */
  async getValidAccessToken() {
    const payload = this.decodeJwt(this.accessToken);
    const now = Math.floor(Date.now() / 1000);
    if (!this.accessToken || !payload?.exp || payload.exp <= now + 60) {
      console.log('[TokenManager] Access token is missing or expired, initiating refresh...');
      await this.refreshAccessToken();
    }
    return this.accessToken;
  }

  /**
   * Get status and decoded payload of current tokens
   */
  getStatus() {
    const accessPayload = this.decodeJwt(this.accessToken);
    const refreshPayload = this.decodeJwt(this.refreshToken);

    const now = Math.floor(Date.now() / 1000);

    return {
      hasAccessToken: Boolean(this.accessToken),
      hasRefreshToken: Boolean(this.refreshToken),
      lastRefreshedAt: this.lastRefreshedAt,
      accessToken: {
        present: Boolean(this.accessToken),
        expiresAt: accessPayload?.exp ? new Date(accessPayload.exp * 1000).toISOString() : null,
        isExpired: accessPayload?.exp ? accessPayload.exp < now : null,
        username: accessPayload?.preferred_username || null,
        name: accessPayload?.nameTh || accessPayload?.name || null,
        organization: accessPayload?.organization?.name || null
      },
      refreshToken: {
        present: Boolean(this.refreshToken),
        expiresAt: refreshPayload?.exp ? new Date(refreshPayload.exp * 1000).toISOString() : null,
        isExpired: refreshPayload?.exp ? refreshPayload.exp < now : null
      }
    };
  }
}

module.exports = new TokenManager();
