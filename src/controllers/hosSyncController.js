const hosSyncService = require('../services/hosSyncService');

class HosSyncController {
  /**
   * Preview sync data before saving
   */
  async preview(req, res) {
    try {
      const vn = req.params.vn || req.body.vn || req.query.vn;
      if (!vn) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ VN'
        });
      }

      const preview = await hosSyncService.previewSyncData(vn);
      return res.json({
        success: true,
        data: preview
      });
    } catch (err) {
      console.error('Error previewing HOSxP sync:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับบันทึก'
      });
    }
  }

  /**
   * Save / Sync data into HOSxP
   */
  async save(req, res) {
    try {
      const { vn, overrideData, staff } = req.body;
      if (!vn) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ VN'
        });
      }

      const result = await hosSyncService.syncVisitToHos({
        vn,
        overrideData,
        staff
      });

      return res.json(result);
    } catch (err) {
      console.error('Error saving to HOSxP:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลง HOSxP'
      });
    }
  }
}

module.exports = new HosSyncController();
