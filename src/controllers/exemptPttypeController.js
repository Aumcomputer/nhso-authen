const exemptPttypeService = require('../services/exemptPttypeService');

class ExemptPttypeController {
  async list(req, res) {
    try {
      const onlyActive = req.query.active === 'true';
      const rows = await exemptPttypeService.listAll({ onlyActive });
      return res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      console.error('[ExemptPttype] List error:', err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  async searchHosPttypes(req, res) {
    try {
      const q = req.query.q || '';
      const rows = await exemptPttypeService.searchHosPttypes(q);
      return res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      console.error('[ExemptPttype] Search error:', err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  async add(req, res) {
    try {
      const { pttype, name, note } = req.body;
      const created_by = req.user?.loginname || 'admin';
      const result = await exemptPttypeService.add({ pttype, name, note, created_by });
      return res.json({
        success: true,
        message: `เพิ่มสิทธิยกเว้น '${result.pttype}' เรียบร้อยแล้ว`,
        data: result
      });
    } catch (err) {
      console.error('[ExemptPttype] Add error:', err);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { is_active, note } = req.body;
      const result = await exemptPttypeService.update(id, { is_active, note });
      return res.json({
        success: true,
        message: 'ปรับปรุงสิทธิยกเว้นเรียบร้อยแล้ว',
        data: result
      });
    } catch (err) {
      console.error('[ExemptPttype] Update error:', err);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await exemptPttypeService.delete(id);
      return res.json({
        success: true,
        message: 'ลบสิทธิยกเว้นเรียบร้อยแล้ว',
        data: result
      });
    } catch (err) {
      console.error('[ExemptPttype] Delete error:', err);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }
}

module.exports = new ExemptPttypeController();
