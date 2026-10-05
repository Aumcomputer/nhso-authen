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
}

module.exports = new RightSearchController();
