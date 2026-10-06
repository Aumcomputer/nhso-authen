const ucsSubCentersService = require('../services/ucsSubCentersService');

class UcsSubCentersController {
  async list(req, res) {
    try {
      const onlyActive = req.query.active === 'true';
      const rows = await ucsSubCentersService.listAll({ onlyActive });
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error('List UCS sub centers error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async searchHospcodes(req, res) {
    try {
      const q = req.query.q || '';
      const rows = await ucsSubCentersService.searchHospcodes(q);
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Search hospcodes error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async add(req, res) {
    try {
      const { hospcode, name, note } = req.body;
      const created_by = req.user?.loginname || 'admin';
      const item = await ucsSubCentersService.add({ hospcode, name, note, created_by });
      return res.status(201).json({ success: true, data: item, message: 'เพิ่มสถานพยาบาลระดับปฐมภูมิเรียบร้อย' });
    } catch (err) {
      console.error('Add UCS sub center error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async update(req, res) {
    try {
      const id = req.params.id;
      const { is_active, note } = req.body;
      const item = await ucsSubCentersService.update(id, { is_active, note });
      return res.json({ success: true, data: item, message: 'ปรับปรุงข้อมูลเรียบร้อย' });
    } catch (err) {
      console.error('Update UCS sub center error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async delete(req, res) {
    try {
      const id = req.params.id;
      await ucsSubCentersService.delete(id);
      return res.json({ success: true, message: 'ลบข้อมูลเรียบร้อย' });
    } catch (err) {
      console.error('Delete UCS sub center error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new UcsSubCentersController();
