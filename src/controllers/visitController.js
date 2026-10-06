const db = require('../config/database');

class VisitController {
  /**
   * Get all medical specialties (แผนก)
   */
  async getSpecialties(req, res) {
    try {
      const sql = 'SELECT spclty, name FROM spclty WHERE name IS NOT NULL AND name != "" ORDER BY spclty';
      const rows = await db.query(sql);
      return res.status(200).json({
        success: true,
        data: rows
      });
    } catch (err) {
      console.error('[VisitController] getSpecialties error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch specialties',
        error: err.message
      });
    }
  }

  /**
   * Get patient visits for a specific date and specialty
   * Matching user SQL query:
   * SELECT o.vn, o.hn, p.cid, o.hospmain , o.hospsub , o.pttype , p2.name , o.pttypeno  , vp.auth_code , vp.begin_date , vp.expire_date , o.staff 
   * from hos.ovst o 
   * left join hos.patient p on p.hn = o.hn
   * left join hos.visit_pttype vp on vp.vn = o.vn
   * left join hos.pttype p2 on p2.pttype = o.pttype 
   * where o.vstdate = "2026-09-28" and o.spclty = 02
   */
  async getVisits(req, res) {
    try {
      const vstdate = req.query.vstdate || new Date().toISOString().slice(0, 10);
      const spclty = req.query.spclty || '';

      let sql = `
        SELECT o.vn, o.hn, p.cid, 
               p.pname, p.fname, p.lname,
               CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS ptname,
               o.hospmain, o.hospsub, o.pttype, p2.name AS pttypename, o.pttypeno,
               vp.pttype AS vp_pttype, p3.name AS vp_pttypename, vp.pttypeno AS vp_pttypeno,
               vp.hospmain AS vp_hospmain, vp.hospsub AS vp_hospsub,
               vp.auth_code, vp.begin_date, vp.expire_date, o.staff,
               s.name AS spclty_name
        FROM ovst o 
        LEFT JOIN patient p ON p.hn = o.hn
        LEFT JOIN visit_pttype vp ON vp.vn = o.vn
        LEFT JOIN pttype p2 ON p2.pttype = o.pttype 
        LEFT JOIN pttype p3 ON p3.pttype = vp.pttype
        LEFT JOIN spclty s ON s.spclty = o.spclty
        WHERE o.vstdate = ?
      `;

      const params = [vstdate];

      if (spclty && spclty !== 'all') {
        sql += ' AND o.spclty = ?';
        params.push(spclty);
      }

      sql += ' ORDER BY o.vn DESC';

      const rows = await db.query(sql, params);

      // Cross-reference with d-flow.vn_nhso_authen to identify already saved visits
      if (rows && rows.length > 0) {
        try {
          const vns = rows.map(r => r.vn);
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
        } catch (dflowErr) {
          console.warn('[VisitController] Could not check d-flow vn_nhso_authen:', dflowErr.message);
          rows.forEach(v => {
            v.dflow_saved = false;
            v.dflow_data = null;
          });
        }
      }

      return res.status(200).json({
        success: true,
        vstdate,
        spclty: spclty || 'all',
        total: rows.length,
        savedInDflowCount: rows.filter(r => r.dflow_saved).length,
        data: rows
      });
    } catch (err) {
      console.error('[VisitController] getVisits error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch patient visits',
        error: err.message
      });
    }
  }
}

module.exports = new VisitController();
