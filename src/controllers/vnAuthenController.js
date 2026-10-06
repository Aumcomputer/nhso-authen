const nhsoClient = require('../services/nhsoClient');
const vnAuthenService = require('../services/vnAuthenService');
const authenHistoryService = require('../services/authenHistoryService');
const { dflowQuery } = require('../config/database');

class VnAuthenController {
  /**
   * Check Right & Authen for a single VN and save into vn_nhso_authen
   * POST /api/vn-authen/check-and-save
   * Body: { vn, cid, vstdate, force }
   */
  async checkAndSave(req, res) {
    try {
      const { vn, cid, vstdate, force = false } = req.body;

      if (!vn || !cid) {
        return res.status(400).json({
          success: false,
          message: 'Both vn and cid are required'
        });
      }

      // Normalize vstdate into YYYY-MM-DD
      let targetDate = new Date().toISOString().slice(0, 10);
      if (vstdate) {
        const str = String(vstdate).trim();
        const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) {
          targetDate = match[1];
        } else {
          const d = new Date(str);
          if (!isNaN(d.getTime())) {
            targetDate = d.toISOString().slice(0, 10);
          }
        }
      }

      // Check if already exists in vn_nhso_authen
      if (!force) {
        const existing = await vnAuthenService.getByVn(vn);
        if (existing) {
          return res.status(200).json({
            success: true,
            alreadySaved: true,
            message: 'Visit already saved in vn_nhso_authen',
            data: existing
          });
        }
      }

      // Query both NHSO APIs concurrently
      let rightData = null;
      let authenList = [];
      let todayAuth = null;
      let rightError = null;
      let authenError = null;

      try {
        rightData = await nhsoClient.searchRights(cid);
      } catch (err) {
        console.warn(`[VnAuthenController] Right search failed for CID ${cid}:`, err.message);
        rightError = err.message;
      }

      try {
        // Query authencode-report API for the visit date
        const report = await nhsoClient.getAuthenReport({
          pid: cid,
          claimDateFrom: targetDate,
          claimDateTo: targetDate,
          size: 50
        });

        if (report && Array.isArray(report.content)) {
          authenList = report.content;
        } else {
          authenList = await nhsoClient.getAuthenHistory(cid, null, {
            claimDateFrom: targetDate,
            claimDateTo: targetDate
          });
        }

        if (Array.isArray(authenList) && authenList.length > 0) {
          // 1. Save ALL objects (every sourceChannel) and raw responses into `nhso_authen_history`
          authenHistoryService.saveHistoryItems(authenList, cid).catch(saveErr => {
            console.error('[VnAuthenController] Background save to nhso_authen_history error:', saveErr.message);
          });

          // 2. Filter for records matching targetDate
          const matchingAuths = authenList.filter(item => {
            const rawDate = item.claimDate || item.receivedDateTime || item.createDate || '';
            const dateStr = String(rawDate).slice(0, 10);
            return dateStr === targetDate;
          });

          if (matchingAuths.length > 0) {
            // Find records where sourceChannel is "AUTHENCODE"
            const authenCodeChannelAuths = matchingAuths.filter(item => {
              const ch = String(item.sourceChannel || item.source_channel || '').trim().toUpperCase();
              return ch === 'AUTHENCODE';
            });

            if (authenCodeChannelAuths.length > 0) {
              // Sort by date descending to pick the latest
              authenCodeChannelAuths.sort((a, b) => {
                const da = new Date(a.claimDate || a.receivedDateTime || a.createDate || 0);
                const db = new Date(b.claimDate || b.receivedDateTime || b.createDate || 0);
                return db - da;
              });
              todayAuth = authenCodeChannelAuths[0];
            } else {
              // Fallback to non-ENDPOINT if available
              const nonEndpointAuths = matchingAuths.filter(item => {
                const ch = String(item.sourceChannel || item.source_channel || '').trim().toUpperCase();
                return ch !== 'ENDPOINT';
              });

              if (nonEndpointAuths.length > 0) {
                todayAuth = nonEndpointAuths[0];
              } else {
                // Otherwise use the first matching record
                todayAuth = matchingAuths[0];
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[VnAuthenController] Authen query failed for CID ${cid}:`, err.message);
        authenError = err.message;
      }

      // If both APIs failed
      if (!rightData && !todayAuth && (rightError && authenError)) {
        return res.status(502).json({
          success: false,
          message: `NHSO API error: Rights (${rightError}), Authen (${authenError})`
        });
      }

      // Save into vn_nhso_authen
      await vnAuthenService.upsertVnData({
        vn,
        rightData,
        authenData: todayAuth
      });

      const savedRecord = await vnAuthenService.getByVn(vn);

      return res.status(200).json({
        success: true,
        alreadySaved: false,
        message: 'Successfully checked and saved into vn_nhso_authen',
        hasTodayAuthen: Boolean(todayAuth),
        data: savedRecord
      });
    } catch (err) {
      console.error('[VnAuthenController] checkAndSave error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to check and save visit data',
        error: err.message
      });
    }
  }

  /**
   * Get record by VN
   * GET /api/vn-authen/:vn
   */
  async getByVn(req, res) {
    try {
      const vn = req.params.vn;
      const record = await vnAuthenService.getByVn(vn);
      if (!record) {
        return res.status(404).json({
          success: false,
          message: `Record with VN ${vn} not found in vn_nhso_authen`
        });
      }

      return res.status(200).json({
        success: true,
        data: record
      });
    } catch (err) {
      console.error('[VnAuthenController] getByVn error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve VN record',
        error: err.message
      });
    }
  }
}

module.exports = new VnAuthenController();
