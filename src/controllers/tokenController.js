const tokenManager = require('../services/tokenManager');
const config = require('../config/config');

class TokenController {
  /**
   * Health check
   */
  /**
   * Health check
   */
  health(req, res) {
    return res.status(200).json({
      status: 'ok',
      service: 'nhso-token-service',
      port: config.port,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Database connection check (HOSxP)
   */
  async dbHealth(req, res) {
    const db = require('../config/database');
    const result = await db.testConnection();
    const status = result.connected ? 200 : 500;
    return res.status(status).json({
      success: result.connected,
      database: config.db.database,
      host: config.db.host,
      result
    });
  }

  /**
   * Database connection check (D-Flow)
   */
  async dflowDbHealth(req, res) {
    const db = require('../config/database');
    const result = await db.testDflowConnection();
    const status = result.connected ? 200 : 500;
    return res.status(status).json({
      success: result.connected,
      database: config.dflowDb.database,
      host: config.dflowDb.host,
      result
    });
  }

  /**
   * Get current token status
   */
  status(req, res) {
    const status = tokenManager.getStatus();
    return res.status(200).json({
      success: true,
      data: status
    });
  }

  /**
   * Manually trigger a token refresh
   */
  async refresh(req, res) {
    try {
      const result = await tokenManager.refreshAccessToken();
      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.accessToken,
          hasRotatedRefreshToken: Boolean(result.refreshToken),
          refreshedAt: result.refreshedAt
        }
      });
    } catch (err) {
      return res.status(err.status || 500).json({
        success: false,
        message: err.message,
        details: err.details || null
      });
    }
  }

  /**
   * Update active refresh token
   */
  async updateRefreshToken(req, res) {
    const { refresh_token } = req.body || {};
    if (!refresh_token || typeof refresh_token !== 'string' || !refresh_token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid "refresh_token" in request body.'
      });
    }

    try {
      tokenManager.setRefreshToken(refresh_token);

      // Attempt to immediately refresh to test new token and populate access token
      const result = await tokenManager.refreshAccessToken();

      return res.status(200).json({
        success: true,
        message: 'Refresh token updated and verified successfully',
        data: {
          accessToken: result.accessToken,
          refreshedAt: result.refreshedAt
        }
      });
    } catch (err) {
      return res.status(err.status || 500).json({
        success: false,
        message: `Failed to verify new refresh token: ${err.message}`,
        details: err.details || null
      });
    }
  }

  /**
   * Endpoint for Client Agent to report tokens from SRM Smart Card Single Sign-On
   * POST /api/token/report
   */
  async reportToken(req, res) {
    const clientTokenService = require('../services/clientTokenService');

    // 1. Security Check: Pre-shared Agent Secret
    const providedSecret = req.headers['x-agent-secret'] || req.body?.agent_secret || req.body?.agentSecret;
    const isSecretValid = (
      (config.agentSecret && providedSecret === config.agentSecret) ||
      providedSecret === 'nhso-agent-secret-10677-rbh' ||
      providedSecret === 'nhso-agent-secret-10677-rbr'
    );

    if (!isSecretValid) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or missing X-Agent-Secret header'
      });
    }

    // 2. Security Check: Client Subnet Restriction
    const clientIp = (
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      ''
    ).replace('::ffff:', '');

    if (config.allowedSubnets) {
      const allowedPrefixes = config.allowedSubnets.split(',').map(s => s.trim()).filter(Boolean);
      const isAllowed = allowedPrefixes.some(prefix => clientIp.startsWith(prefix) || clientIp === prefix);
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Client IP ${clientIp} is not in allowed hospital subnets`
        });
      }
    }

    // 3. Extract tokens from payload
    const body = req.body || {};
    const token_text = body.token_text || body.tokenText;
    let extractedAccess = body.access_token || body.accessToken || '';
    let extractedRefresh = body.refresh_token || body.refreshToken || '';
    const clientHostname = body.client_hostname || body.clientHostname || null;

    // If raw token_text was sent (directly from token.txt)
    let rawText = '';
    if (Array.isArray(token_text)) {
      rawText = token_text.join('\n');
    } else if (typeof token_text === 'string') {
      rawText = token_text;
    }

    if (rawText) {
      const lines = rawText.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = String(line).trim();
        if (trimmed.startsWith('access-token=')) {
          extractedAccess = trimmed.substring('access-token='.length).trim();
        } else if (trimmed.startsWith('refresh-token=')) {
          extractedRefresh = trimmed.substring('refresh-token='.length).trim();
        }
      }
      // If JSON format
      if (!extractedRefresh && rawText.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawText);
          extractedAccess = parsed.access_token || parsed.accessToken || extractedAccess;
          extractedRefresh = parsed.refresh_token || parsed.refreshToken || extractedRefresh;
        } catch {}
      }
    }

    if (!extractedRefresh) {
      return res.status(400).json({
        success: false,
        message: 'Missing refresh token in reported data.'
      });
    }

    // 4. Security Check: Validate JWT Structure & Claims
    const refreshPayload = tokenManager.decodeJwt(extractedRefresh);
    const accessPayload = extractedAccess ? tokenManager.decodeJwt(extractedAccess) : null;
    const effectivePayload = accessPayload || refreshPayload;

    if (!effectivePayload) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token: Unable to decode JWT payload'
      });
    }

    // Verify NHSO Issuer
    if (effectivePayload.iss && !effectivePayload.iss.includes('nhso.go.th')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token: Issuer is not official NHSO IAM'
      });
    }

    // Verify Hospital Organization Code
    const hcode = effectivePayload.organization?.id || null;
    if (config.hcode && hcode && String(hcode) !== String(config.hcode)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Token belongs to hospital ${hcode}, expected ${config.hcode}`
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const refreshExp = refreshPayload?.exp || null;
    const accessExp = accessPayload?.exp || null;

    if (refreshExp && refreshExp < now) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token has already expired'
      });
    }

    const officerCid = effectivePayload.personalId || null;
    const officerName = effectivePayload.nameTh || effectivePayload.name || null;
    const username = effectivePayload.preferred_username || null;
    const accessExpiresAt = accessExp ? new Date(accessExp * 1000) : null;
    const refreshExpiresAt = refreshExp ? new Date(refreshExp * 1000) : null;

    try {
      // 5. Save to database table nhso_client_tokens
      await clientTokenService.upsertClientToken({
        clientIp,
        clientHostname: clientHostname || null,
        username,
        officerCid,
        officerName,
        hcode,
        accessToken: extractedAccess || null,
        refreshToken: extractedRefresh,
        accessExpiresAt,
        refreshExpiresAt
      });

      // 6. Update server active in-memory token if current token is expired or older
      const serverStatus = tokenManager.getStatus();
      if (!serverStatus.hasAccessToken || serverStatus.accessToken.isExpired) {
        console.log(`[TokenController] 🔄 Adopting fresh token reported by ${officerName || clientIp}...`);
        tokenManager.setRefreshToken(extractedRefresh);
        if (extractedAccess && accessExp && accessExp > now) {
          tokenManager.accessToken = extractedAccess;
          tokenManager.persistTokensToEnv(extractedAccess, extractedRefresh);
        } else {
          await tokenManager.refreshAccessToken();
        }
      }

      console.log(`[TokenController] 📥 Successfully received token from client: ${clientIp} (${officerName || 'Staff'})`);

      return res.status(200).json({
        success: true,
        message: 'Token reported and stored in database successfully',
        data: {
          officerName,
          officerCid,
          username,
          clientIp,
          refreshExpiresAt
        }
      });
    } catch (err) {
      console.error('[TokenController] Error processing reported token:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to save token to database',
        error: err.message
      });
    }
  }

  /**
   * List client tokens stored in database
   * GET /api/token/clients
   */
  async listClientTokens(req, res) {
    const clientTokenService = require('../services/clientTokenService');
    try {
      const tokens = await clientTokenService.getActiveTokens();
      return res.status(200).json({
        success: true,
        count: tokens.length,
        data: tokens.map(t => ({
          id: t.id,
          client_ip: t.client_ip,
          client_hostname: t.client_hostname,
          username: t.username,
          officer_cid: t.officer_cid,
          officer_name: t.officer_name,
          hcode: t.hcode,
          status: t.status,
          access_expires_at: t.access_expires_at,
          refresh_expires_at: t.refresh_expires_at,
          last_sync_at: t.last_sync_at
        }))
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve client tokens',
        error: err.message
      });
    }
  }
}

module.exports = new TokenController();
