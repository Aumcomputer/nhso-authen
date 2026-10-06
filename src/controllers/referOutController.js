const db = require('../config/database');

class ReferOutController {
  /**
   * Get referout patient records for a specific date
   * GET /api/referout?refer_date=YYYY-MM-DD
   */
  async getReferOutList(req, res) {
    try {
      const referDate = req.query.refer_date || req.query.date || new Date().toISOString().slice(0, 10);

      const sql = `
        SELECT 
            r.vn, 
            r.hn,
            CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS ptname,  
            r.refer_date, 
            r.refer_time,
            d.name AS doctor_name,  
            r.pttype,
            pt.name AS pttype_name, 
            vp.pttypeno, 
            p2.cid,
            vp.hospmain, 
            vp.hospsub, 
            vp.auth_code, 
            vp.begin_date,
            vp.expire_date,
            sp.name AS spclty_name, 
            o2.name AS refer_staff_name,
            mr.moph_refer_id,
            o.vstdate
        FROM referout r 
        LEFT JOIN moph_refer mr ON r.referout_id = mr.referout_id 
        LEFT JOIN doctor d ON d.code = r.doctor 
        LEFT JOIN patient p ON p.hn = r.hn
        LEFT JOIN visit_pttype vp ON vp.vn = r.vn 
        LEFT JOIN ovst o ON o.vn = r.vn
        LEFT JOIN pttype pt ON pt.pttype = vp.pttype
        LEFT JOIN spclty sp ON sp.spclty = o.spclty
        LEFT JOIN patient p2 ON p2.hn = r.hn 
        LEFT JOIN opduser o2 ON o2.loginname = r.refer_write_staff 
        WHERE r.refer_date = ?
        ORDER BY r.refer_time ASC
      `;

      const rows = await db.query(sql, [referDate]);

      // Cross-reference with d-flow.vn_nhso_authen
      if (rows && rows.length > 0) {
        try {
          const vns = rows.map(r => r.vn).filter(Boolean);
          if (vns.length > 0) {
            const placeholders = vns.map(() => '?').join(',');
            const dflowRows = await db.dflowQuery(
              `SELECT vn, pid, title_name, fname, lname, right_check_date, 
                      maininscl_id, maininscl_name, subinscl_id, subinscl_name, 
                      hospmain_code, hospmain_name, claim_code, claim_type_name, 
                      received_datetime, authen_status, created_at, updated_at 
               FROM \`vn_nhso_authen\` WHERE \`vn\` IN (${placeholders})`,
              vns
            );

            const dflowMap = new Map();
            dflowRows.forEach(item => dflowMap.set(item.vn, item));

            rows.forEach(v => {
              const dflowItem = dflowMap.get(v.vn);
              v.dflow_saved = Boolean(dflowItem);
              v.dflow_data = dflowItem || null;
              if (dflowItem?.claim_code) {
                v.auth_code_from_api = dflowItem.claim_code;
              }
            });
          }
        } catch (dflowErr) {
          console.warn('[ReferOutController] Could not check d-flow vn_nhso_authen:', dflowErr.message);
          rows.forEach(v => {
            v.dflow_saved = false;
            v.dflow_data = null;
          });
        }
      }

      return res.status(200).json({
        success: true,
        refer_date: referDate,
        total: rows.length,
        savedInDflowCount: rows.filter(r => r.dflow_saved).length,
        data: rows
      });
    } catch (err) {
      console.error('[ReferOutController] getReferOutList error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch referout records',
        error: err.message
      });
    }
  }
}

module.exports = new ReferOutController();
