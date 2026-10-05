const { dflowQuery } = require('../config/database');
const tokenManager = require('./tokenManager');
const config = require('../config/config');

class ClientTokenService {
  /**
   * Save or update token reported by client
   * @param {Object} data
   */
  async upsertClientToken({
    clientIp,
    clientHostname = null,
    accessToken = null,
    refreshToken,
    accessExpiresAt = null,
    refreshExpiresAt = null,
    username = null,
    officerCid = null,
    officerName = null,
    hcode = null
  }) {
    if (!refreshToken) {
      throw new Error('refreshToken is required');
    }

    const sql = `
      INSERT INTO \`nhso_client_tokens\` (
        \`client_ip\`, \`client_hostname\`, \`username\`, \`officer_cid\`, \`officer_name\`, \`hcode\`,
        \`access_token\`, \`refresh_token\`, \`access_expires_at\`, \`refresh_expires_at\`, \`status\`, \`error_message\`
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 'ACTIVE', NULL
      )
      ON DUPLICATE KEY UPDATE
        \`client_hostname\` = COALESCE(VALUES(\`client_hostname\`), \`client_hostname\`),
        \`username\` = COALESCE(VALUES(\`username\`), \`username\`),
        \`officer_name\` = COALESCE(VALUES(\`officer_name\`), \`officer_name\`),
        \`hcode\` = COALESCE(VALUES(\`hcode\`), \`hcode\`),
        \`access_token\` = COALESCE(VALUES(\`access_token\`), \`access_token\`),
        \`refresh_token\` = VALUES(\`refresh_token\`),
        \`access_expires_at\` = COALESCE(VALUES(\`access_expires_at\`), \`access_expires_at\`),
        \`refresh_expires_at\` = COALESCE(VALUES(\`refresh_expires_at\`), \`refresh_expires_at\`),
        \`status\` = 'ACTIVE',
        \`error_message\` = NULL,
        \`last_sync_at\` = NOW();
    `;

    const params = [
      clientIp,
      clientHostname,
      username,
      officerCid,
      officerName,
      hcode,
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt
    ];

    await dflowQuery(sql, params);
  }

  /**
   * Get all active tokens from pool
   */
  async getActiveTokens() {
    const sql = `
      SELECT * FROM \`nhso_client_tokens\`
      WHERE \`status\` = 'ACTIVE' 
        AND (\`refresh_expires_at\` IS NULL OR \`refresh_expires_at\` > NOW())
      ORDER BY \`last_sync_at\` DESC
    `;
    return dflowQuery(sql);
  }

  /**
   * Get latest active token from pool to use as server primary
   */
  async getBestActiveToken() {
    const sql = `
      SELECT * FROM \`nhso_client_tokens\`
      WHERE \`status\` = 'ACTIVE' 
        AND (\`refresh_expires_at\` IS NULL OR \`refresh_expires_at\` > NOW())
      ORDER BY \`last_sync_at\` DESC
      LIMIT 1
    `;
    const rows = await dflowQuery(sql);
    return rows[0] || null;
  }

  /**
   * Mark token as error / expired in DB
   */
  async markTokenError(id, errorMessage) {
    const sql = `
      UPDATE \`nhso_client_tokens\`
      SET \`status\` = 'ERROR', \`error_message\` = ?
      WHERE \`id\` = ?
    `;
    await dflowQuery(sql, [errorMessage, id]);
  }
}

module.exports = new ClientTokenService();
