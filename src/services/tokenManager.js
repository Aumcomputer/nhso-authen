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

        const text = response.data;
        if (typeof text !== 'string') {
          throw new Error('Unexpected response format from token endpoint');
        }

        // Parse key-value lines: access-token=... and refresh-token=...
        const lines = text.split(/\r?\n/);
        let newAccessToken = '';
        let newRefreshToken = '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('access-token=')) {
            newAccessToken = trimmed.substring('access-token='.length).trim();
          } else if (trimmed.startsWith('refresh-token=')) {
            newRefreshToken = trimmed.substring('refresh-token='.length).trim();
          }
        }

        if (!newAccessToken) {
          throw new Error(`Failed to extract access-token from response: ${text.slice(0, 100)}`);
        }

        this.accessToken = newAccessToken;
        if (newRefreshToken) {
          this.refreshToken = newRefreshToken; // Token rotation
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

        // Fallback: Check if there's an active token reported by client agents in the database
        try {
          const clientTokenService = require('./clientTokenService');
          const best = await clientTokenService.getBestActiveToken();
          if (best && best.refresh_token && best.refresh_token.trim() !== this.refreshToken.trim()) {
            console.log(`[TokenManager] 🔄 Attempting fallback using client token from ${best.officer_name || best.username || best.client_ip}...`);
            this.refreshToken = best.refresh_token.trim();
            this.persistTokensToEnv('', this.refreshToken);

            // Retry refresh with best token
            const fallbackParams = new URLSearchParams();
            fallbackParams.append('refresh_token', this.refreshToken);

            const fallbackRes = await axios.post(config.tokenUrl, fallbackParams.toString(), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 15000
            });

            const fbText = fallbackRes.data;
            if (typeof fbText === 'string') {
              const fbLines = fbText.split(/\r?\n/);
              let fbAccess = '';
              let fbRefresh = '';
              for (const line of fbLines) {
                const tr = line.trim();
                if (tr.startsWith('access-token=')) {
                  fbAccess = tr.substring('access-token='.length).trim();
                } else if (tr.startsWith('refresh-token=')) {
                  fbRefresh = tr.substring('refresh-token='.length).trim();
                }
              }

              if (fbAccess) {
                this.accessToken = fbAccess;
                if (fbRefresh) this.refreshToken = fbRefresh;
                this.lastRefreshedAt = new Date();
                console.log('[TokenManager] 🎉 Fallback token refresh succeeded!');
                this.persistTokensToEnv(this.accessToken, this.refreshToken);
                return {
                  accessToken: this.accessToken,
                  refreshToken: this.refreshToken,
                  refreshedAt: this.lastRefreshedAt
                };
              }
            }
          }
        } catch (fallbackErr) {
          console.error('[TokenManager] ❌ Fallback token refresh also failed:', fallbackErr.message);
        }

        const errorMsg = typeof err.response?.data === 'object' 
          ? JSON.stringify(err.response?.data) 
          : (err.response?.data || err.message);
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
   * Get valid access token, refreshing if not available
   */
  async getValidAccessToken() {
    if (!this.accessToken) {
      console.log('[TokenManager] Access token is missing, initiating refresh...');
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
