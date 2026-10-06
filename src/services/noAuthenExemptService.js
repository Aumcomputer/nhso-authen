const { dflowPool, hosPool } = require('../config/database');

class NoAuthenExemptService {
  /**
   * List no-authen exempt pttypes
   * @param {Object} options
   * @param {boolean} options.onlyActive
   */
  async listAll({ onlyActive = false } = {}) {
    let sql = `
      SELECT id, pttype, name, is_active, note, created_at, updated_at, created_by 
      FROM nhso_no_authen_exempt_pttypes
    `;
    if (onlyActive) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY pttype ASC';

    const rows = await dflowPool.query(sql);
    return rows;
  }

  /**
   * Get array of active uppercase pttype codes
   */
  async getActiveCodes() {
    const rows = await dflowPool.query(`
      SELECT UPPER(pttype) as code 
      FROM nhso_no_authen_exempt_pttypes 
      WHERE is_active = 1
    `);
    return rows.map(r => r.code);
  }

  /**
   * Search pttypes from HOSxP table
   * @param {string} keyword
   */
  async searchHosPttypes(keyword = '') {
    const term = `%${String(keyword || '').trim()}%`;
    const rows = await hosPool.query(`
      SELECT pttype, name 
      FROM pttype 
      WHERE pttype LIKE ? OR name LIKE ? 
      ORDER BY pttype ASC 
      LIMIT 25
    `, [term, term]);
    return rows;
  }

  /**
   * Add new no-authen exempt pttype
   * @param {Object} params
   */
  async add({ pttype, name = null, note = null, created_by = null }) {
    const cleanCode = String(pttype || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('กรุณาระบุรหัสสิทธิ (pttype)');

    // Check duplicate
    const existing = await dflowPool.query(
      `SELECT id FROM nhso_no_authen_exempt_pttypes WHERE UPPER(pttype) = ?`,
      [cleanCode]
    );
    if (existing.length > 0) {
      throw new Error(`รหัสสิทธิ '${cleanCode}' ได้ถูกเพิ่มในการยกเว้นแล้ว`);
    }

    // Lookup name from HOSxP if not provided
    let pttypeName = name;
    if (!pttypeName) {
      const hosRows = await hosPool.query(`SELECT name FROM pttype WHERE UPPER(pttype) = ? LIMIT 1`, [cleanCode]);
      if (hosRows.length > 0) pttypeName = hosRows[0].name;
    }

    const result = await dflowPool.query(`
      INSERT INTO nhso_no_authen_exempt_pttypes (pttype, name, is_active, note, created_by)
      VALUES (?, ?, 1, ?, ?)
    `, [cleanCode, pttypeName || cleanCode, note || null, created_by || null]);

    return {
      id: Number(result.insertId),
      pttype: cleanCode,
      name: pttypeName || cleanCode,
      is_active: 1,
      note: note || null
    };
  }

  /**
   * Update (active or note)
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
      values.push(note);
    }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(id);
    await dflowPool.query(`UPDATE nhso_no_authen_exempt_pttypes SET ${fields.join(', ')} WHERE id = ?`, values);

    const rows = await dflowPool.query(`SELECT id, pttype, name, is_active, note FROM nhso_no_authen_exempt_pttypes WHERE id = ?`, [id]);
    return rows[0];
  }

  /**
   * Delete
   */
  async delete(id) {
    if (!id) throw new Error('ID is required');
    await dflowPool.query(`DELETE FROM nhso_no_authen_exempt_pttypes WHERE id = ?`, [id]);
    return { success: true, id };
  }
}

module.exports = new NoAuthenExemptService();
