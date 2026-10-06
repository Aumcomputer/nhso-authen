const { dflowPool, hosPool } = require('../config/database');

class UcsSubCentersService {
  /**
   * List all UCS sub centers
   * @param {Object} options
   * @param {boolean} options.onlyActive
   */
  async listAll({ onlyActive = false } = {}) {
    let sql = `
      SELECT id, hospcode, name, is_active, note, created_at, updated_at, created_by 
      FROM nhso_ucs_sub_centers
    `;
    if (onlyActive) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY hospcode ASC';

    const rows = await dflowPool.query(sql);
    return rows;
  }

  /**
   * Get array of active hospcodes
   */
  async getActiveCodes() {
    const rows = await dflowPool.query(`
      SELECT UPPER(hospcode) as code 
      FROM nhso_ucs_sub_centers 
      WHERE is_active = 1
    `);
    return rows.map(r => r.code);
  }

  /**
   * Search hospcodes from HOSxP hospcode table or dflow vn_nhso_authen
   * @param {string} keyword
   */
  async searchHospcodes(keyword = '') {
    const term = `%${String(keyword || '').trim()}%`;
    const rows = await hosPool.query(`
      SELECT hospcode, name 
      FROM hospcode 
      WHERE hospcode LIKE ? OR name LIKE ? 
      ORDER BY hospcode ASC 
      LIMIT 25
    `, [term, term]);
    return rows;
  }

  /**
   * Add new UCS sub center
   * @param {Object} params
   */
  async add({ hospcode, name = null, note = null, created_by = null }) {
    const cleanCode = String(hospcode || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('กรุณาระบุรหัสสถานพยาบาล (hospcode)');

    // Check duplicate
    const existing = await dflowPool.query(
      `SELECT id FROM nhso_ucs_sub_centers WHERE UPPER(hospcode) = ?`,
      [cleanCode]
    );
    if (existing.length > 0) {
      throw new Error(`รหัสสถานพยาบาล '${cleanCode}' มีอยู่ในระบบแล้ว`);
    }

    // Lookup name if not provided
    let hospName = name;
    if (!hospName) {
      const hosRows = await hosPool.query(`SELECT name FROM hospcode WHERE hospcode = ? LIMIT 1`, [cleanCode]);
      if (hosRows.length > 0) hospName = hosRows[0].name;
    }

    const result = await dflowPool.query(`
      INSERT INTO nhso_ucs_sub_centers (hospcode, name, is_active, note, created_by)
      VALUES (?, ?, 1, ?, ?)
    `, [cleanCode, hospName || cleanCode, note || null, created_by || null]);

    return {
      id: Number(result.insertId),
      hospcode: cleanCode,
      name: hospName || cleanCode,
      is_active: 1,
      note: note || null
    };
  }

  /**
   * Update status or note
   */
  async update(id, { is_active, note }) {
    if (!id) throw new Error('ID is required');

    const fields = [];
    const values = [];

    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    if (note !== undefined) {
      fields.push('note = ?');
      values.push(note || null);
    }

    if (fields.length === 0) {
      throw new Error('ไม่มีข้อมูลที่ต้องการอัปเดต');
    }

    values.push(id);
    await dflowPool.query(
      `UPDATE nhso_ucs_sub_centers SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const rows = await dflowPool.query(
      `SELECT id, hospcode, name, is_active, note FROM nhso_ucs_sub_centers WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Delete
   */
  async delete(id) {
    if (!id) throw new Error('ID is required');
    await dflowPool.query(`DELETE FROM nhso_ucs_sub_centers WHERE id = ?`, [id]);
    return true;
  }
}

module.exports = new UcsSubCentersService();
