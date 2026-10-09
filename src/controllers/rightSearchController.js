const nhsoClient = require('../services/nhsoClient');
const { isValidPid } = require('../utils/validator');

class RightSearchController {
  async getRights(req, res) {
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
          message: 'Missing PID/CID. Please provide citizen ID in path, query, or body (e.g. /api/rights/3240200361280)'
        });
      }

      const cleanPid = String(pid).trim();
      if (!isValidPid(cleanPid)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid PID format. Citizen ID must be exactly 13 digits.'
        });
      }

      const data = await nhsoClient.searchRights(cleanPid);

      return res.status(200).json({
        success: true,
        pid: cleanPid,
        data
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
   * GET /api/check-pttype/:cid?
   * Return pure raw JSON right search response directly from NHSO API
   */
  async checkPttypeRaw(req, res) {
    try {
      const pid = (
        req.params.cid ||
        req.params.pid ||
        req.query.cid ||
        req.query.pid ||
        (req.body && (req.body.cid || req.body.pid))
      );

      if (!pid) {
        return res.status(400).json({
          status: 400,
          message: 'Missing CID/PID. Please provide citizen ID in URL path or query parameter (e.g. /api/check-pttype/1234567890123 or ?cid=1234567890123)'
        });
      }

      const cleanPid = String(pid).trim().replace(/[-\s]/g, '');
      if (!isValidPid(cleanPid)) {
        return res.status(400).json({
          status: 400,
          message: 'Invalid CID format. Citizen ID must be exactly 13 numeric digits.'
        });
      }

      // nhsoClient.searchRights fetches directly from NHSO Right Search API
      const rawData = await nhsoClient.searchRights(cleanPid);

      // Return pure raw JSON from NHSO
      return res.status(200).json(rawData);
    } catch (err) {
      return res.status(err.status || 500).json({
        status: err.status || 500,
        message: err.message,
        details: err.details || null
      });
    }
  }
}

module.exports = new RightSearchController();
