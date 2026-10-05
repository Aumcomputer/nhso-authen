const axios = require('axios');
const tokenManager = require('./tokenManager');
const config = require('../config/config');

class NhsoClient {
  /**
   * Execute an HTTP GET request with automatic Bearer token and 401 auto-refresh retry
   * @param {string} url - Target URL
   * @param {Object} [options] - Additional headers or config
   * @returns {Promise<any>}
   */
  async requestWithAuth(url, options = {}) {
    let accessToken = await tokenManager.getValidAccessToken();

    const buildHeaders = (token) => {
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      };

      if (options.cookie) {
        headers['Cookie'] = options.cookie;
      }
      return headers;
    };

    try {
      // First attempt
      const response = await axios.get(url, {
        headers: buildHeaders(accessToken),
        timeout: options.timeout || 15000,
        validateStatus: (status) => status >= 200 && status < 400
      });

      return response.data;
    } catch (err) {
      const status = err.response?.status;

      // Handle 401 Unauthorized -> Refresh token and retry once
      if (status === 401) {
        console.warn(`[NhsoClient] ⚠️ Received 401 Unauthorized from ${url}. Triggering token refresh...`);
        try {
          // Force a fresh token
          const refreshResult = await tokenManager.refreshAccessToken();
          const newAccessToken = refreshResult.accessToken;

          console.log('[NhsoClient] 🔁 Retrying request with freshly refreshed access token...');
          const retryResponse = await axios.get(url, {
            headers: buildHeaders(newAccessToken),
            timeout: options.timeout || 15000,
            validateStatus: (s) => s >= 200 && s < 400
          });

          return retryResponse.data;
        } catch (retryErr) {
          console.error('[NhsoClient] ❌ Retry after token refresh failed:', retryErr.message);
          const error = new Error(`Request failed after token refresh (HTTP ${retryErr.response?.status || 401})`);
          error.status = retryErr.response?.status || 401;
          error.details = retryErr.response?.data || retryErr.message;
          throw error;
        }
      }

      // Propagate other errors
      const error = new Error(err.response?.data?.message || err.message || 'NHSO API request failed');
      error.status = status || 500;
      error.details = err.response?.data || null;
      throw error;
    }
  }

  /**
   * 1. ตรวจสอบสิทธิ์ (Right Search)
   * GET https://srm.nhso.go.th/api/ucws/v1/right-search?pid={pid}
   */
  async searchRights(pid) {
    const url = `${config.rightSearchUrl}?pid=${encodeURIComponent(pid)}`;
    return this.requestWithAuth(url);
  }

  /**
   * 2. ดูประวัติ authen รายงาน (Authencode Report - เส้นใหม่)
   * GET https://authenservice.nhso.go.th/authencode/api/authencode-report
   * @param {Object} options
   * @param {string} options.pid - Citizen ID (13 digits)
   * @param {string} [options.claimDateFrom] - Date from (YYYY-MM-DD)
   * @param {string} [options.claimDateTo] - Date to (YYYY-MM-DD)
   * @param {string} [options.hcode] - Default from config
   * @param {string} [options.provinceCode] - Default from config
   * @param {string} [options.zoneCode] - Default from config
   * @param {number} [options.page=0] - Page number (0-based)
   * @param {number} [options.size=50] - Page size
   * @param {string} [options.sort='claimDate,desc'] - Sort order
   */
  async getAuthenReport({
    pid,
    claimDateFrom = null,
    claimDateTo = null,
    hcode = config.hcode,
    provinceCode = config.provinceCode,
    zoneCode = config.zoneCode,
    page = 0,
    size = 50,
    sort = 'claimDate,desc'
  }) {
    if (!pid) {
      throw new Error('pid is required for getAuthenReport');
    }

    // Default dates: if fromDate not specified, default to single date (toDate)
    const today = new Date().toISOString().slice(0, 10);
    const toDate = claimDateTo || claimDateFrom || today;
    let fromDate = claimDateFrom || toDate;

    // Ensure span does not exceed 14 days
    const dFrom = new Date(fromDate);
    const dTo = new Date(toDate);
    const diffDays = Math.ceil(Math.abs(dTo - dFrom) / (1000 * 60 * 60 * 24));
    if (diffDays > 14) {
      const adjustedFrom = new Date(dTo);
      adjustedFrom.setDate(adjustedFrom.getDate() - 13);
      fromDate = adjustedFrom.toISOString().slice(0, 10);
    }

    const queryParams = new URLSearchParams({
      hcode: String(hcode),
      provinceCode: String(provinceCode),
      zoneCode: String(zoneCode),
      pid: String(pid),
      claimDateFrom: fromDate,
      claimDateTo: toDate,
      page: String(page),
      size: String(size),
      sort: String(sort)
    });

    const url = `${config.authenReportUrl}?${queryParams.toString()}`;
    return this.requestWithAuth(url);
  }

  /**
   * 3. ดูประวัติ authen (เข้ากันได้กับโค้ดเดิม และใช้เส้นใหม่ authencode-report เป็นหลัก)
   * @param {string} pid - Citizen ID (13 digits)
   * @param {string} [customCookie] - Optional cookie for legacy fallback
   * @param {Object} [options] - Additional options (claimDateFrom, claimDateTo, etc.)
   * @returns {Promise<Array<Object>>}
   */
  async getAuthenHistory(pid, customCookie = null, options = {}) {
    try {
      // 1. Try new API endpoint: authencode-report
      const report = await this.getAuthenReport({
        pid,
        claimDateFrom: options.claimDateFrom,
        claimDateTo: options.claimDateTo,
        ...options
      });

      if (report && Array.isArray(report.content)) {
        return report.content;
      }
    } catch (newApiErr) {
      console.warn(`[NhsoClient] getAuthenReport failed for ${pid} (${newApiErr.message}). Trying legacy fallback...`);
    }

    // 2. Fallback to legacy endpoint if available
    try {
      const url = `${config.authenHistoryUrl}?pid=${encodeURIComponent(pid)}`;
      const cookie = customCookie || config.authenCookie;
      const legacyData = await this.requestWithAuth(url, { cookie });
      if (Array.isArray(legacyData)) return legacyData;
      return [];
    } catch (legacyErr) {
      console.error(`[NhsoClient] Legacy authen history also failed for ${pid}:`, legacyErr.message);
      throw legacyErr;
    }
  }
}

module.exports = new NhsoClient();
