const nhsoClient = require('../services/nhsoClient');
const authenHistoryService = require('../services/authenHistoryService');
const { isValidPid } = require('../utils/validator');

class AuthenHistoryController {
  async getHistory(req, res) {
    try {
      const pid = (
        req.params.pid ||
        req.query.pid ||
        req.query.cid ||
        (req.body && (req.body.pid || req.body.cid))
      );

      if (!pid) {
        return res.status(400).json({
          success: false,
          message: 'Missing PID/CID. Please provide citizen ID in path, query, or body (e.g. /api/authen-history/3240200361280)'
        });
      }

      const cleanPid = String(pid).trim();
      if (!isValidPid(cleanPid)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid PID format. Citizen ID must be exactly 13 digits.'
        });
      }

      // Date filtering: default to single date (vstdate || today)
      const vstdate = req.query.vstdate || req.query.date || null;
      let claimDateFrom = req.query.claimDateFrom || req.query.from || null;
      let claimDateTo = req.query.claimDateTo || req.query.to || null;

      const today = new Date().toISOString().slice(0, 10);
      const targetDate = vstdate || today;

      if (!claimDateFrom && !claimDateTo) {
        // ช่วงวันที่ค้นหา เอาแค่วันเดียวพอ ก็วันที่ vn ใน hos
        claimDateFrom = targetDate;
        claimDateTo = targetDate;
      } else {
        if (!claimDateTo) claimDateTo = claimDateFrom || targetDate;
        if (!claimDateFrom) claimDateFrom = claimDateTo || targetDate;
      }

      const page = parseInt(req.query.page || '0', 10);
      const size = parseInt(req.query.size || '50', 10);

      let items = [];
      let totalElements = 0;
      let totalPages = 1;
      let fromDatabase = false;

      try {
        // 1. Fetch from NHSO authencode-report API
        const report = await nhsoClient.getAuthenReport({
          pid: cleanPid,
          claimDateFrom,
          claimDateTo,
          page,
          size
        });

        if (report && Array.isArray(report.content)) {
          items = report.content;
          totalElements = report.totalElements || items.length;
          totalPages = report.totalPages || 1;

          // 2. Persist EVERY object (all sourceChannel) to `nhso_authen_history` asynchronously/safely
          authenHistoryService.saveHistoryItems(items, cleanPid).catch(saveErr => {
            console.error('[AuthenHistoryController] Background save error:', saveErr.message);
          });
        }
      } catch (apiErr) {
        console.warn(`[AuthenHistoryController] NHSO authencode-report API failed for PID ${cleanPid}: ${apiErr.message}. Fallback to DB...`);
        // 3. Fallback to reading saved history from DB
        const dbItems = await authenHistoryService.getHistoryByPid(cleanPid);
        if (dbItems && dbItems.length > 0) {
          items = dbItems.map(row => {
            if (row.raw_json) {
              try {
                return JSON.parse(row.raw_json);
              } catch {
                // fall through to formatted row
              }
            }
            return {
              transId: row.trans_id,
              personalId: row.personal_id,
              hmain: row.hmain,
              hname: row.hname,
              patientName: row.patient_name,
              tel: row.tel,
              claimCode: row.claim_code,
              claimType: row.claim_type,
              claimTypeName: row.claim_type_name,
              claimDate: row.claim_date,
              createDate: row.create_date,
              sourceChannel: row.source_channel,
              claimAuthen: row.claim_authen,
              hnCode: row.hn_code,
              mainInsclWithName: row.main_inscl_name
            };
          });
          totalElements = items.length;
          fromDatabase = true;
        } else {
          throw apiErr;
        }
      }

      return res.status(200).json({
        success: true,
        pid: cleanPid,
        data: items,
        totalElements,
        totalPages,
        page,
        size,
        claimDateFrom,
        claimDateTo,
        fromDatabase
      });
    } catch (err) {
      console.error('[AuthenHistoryController] getHistory error:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message,
        details: err.details || null
      });
    }
  }
}

module.exports = new AuthenHistoryController();
