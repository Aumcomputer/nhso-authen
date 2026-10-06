const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { hosPool, dflowPool } = require('../config/database');

class AuthService {
  /**
   * Login using HOSxP opduser credentials and verify permission in nhso_auth_users
   * @param {Object} params
   * @param {string} params.loginname
   * @param {string} params.password
   */
  async login({ loginname, password }) {
    const cleanUser = String(loginname || '').trim();
    const cleanPass = String(password || '').trim();

    if (!cleanUser || !cleanPass) {
      throw new Error('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน');
    }

    // 1. Verify credentials from HOSxP (hos.opduser)
    // passweb in HOSxP is stored as MD5 hash
    const hosSql = `
      SELECT loginname, name, account_disable 
      FROM opduser 
      WHERE loginname = ? AND (passweb = MD5(?) OR passweb = UPPER(MD5(?)) OR passweb = ?)
      LIMIT 1
    `;
    const hosRows = await hosPool.query(hosSql, [cleanUser, cleanPass, cleanPass, cleanPass]);

    if (!hosRows || hosRows.length === 0) {
      throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่าน HOSxP ไม่ถูกต้อง');
    }

    const hosUser = hosRows[0];

    // Check if account is disabled in HOSxP
    if (hosUser.account_disable && String(hosUser.account_disable).toUpperCase() === 'Y') {
      throw new Error('บัญชีผู้ใช้งานนี้ถูกระงับการใช้งานในระบบ HOSxP');
    }

    // 2. Check permission in nhso_auth_users (d-flow database)
    const authSql = `
      SELECT id, loginname, name, role, is_active 
      FROM nhso_auth_users 
      WHERE loginname = ?
      LIMIT 1
    `;
    let authRows = await dflowPool.query(authSql, [cleanUser]);

    // Bootstrap: if nhso_auth_users is completely empty, make the first logging-in user an admin!
    if (!authRows || authRows.length === 0) {
      const countRes = await dflowPool.query('SELECT COUNT(*) as cnt FROM nhso_auth_users');
      if (Number(countRes[0].cnt) === 0) {
        console.log(`[Auth] nhso_auth_users is empty. Auto-bootstrapping first user '${cleanUser}' as admin.`);
        await dflowPool.query(
          `INSERT INTO nhso_auth_users (loginname, name, role, is_active, created_by) VALUES (?, ?, 'admin', 1, 'system_bootstrap')`,
          [cleanUser, hosUser.name || cleanUser]
        );
        authRows = await dflowPool.query(authSql, [cleanUser]);
      }
    }

    if (!authRows || authRows.length === 0) {
      throw new Error('ผู้ใช้งานนี้ยังไม่ได้รับสิทธิ์เข้าใช้งานระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์');
    }

    const authUser = authRows[0];

    if (authUser.is_active !== 1 && authUser.is_active !== '1' && authUser.is_active !== true) {
      throw new Error('สิทธิ์การเข้าใช้งานระบบของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
    }

    // 3. Generate JWT Token
    const payload = {
      id: authUser.id,
      loginname: authUser.loginname,
      name: authUser.name || hosUser.name || authUser.loginname,
      role: authUser.role || 'user'
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: '24h'
    });

    return {
      token,
      user: payload
    };
  }

  /**
   * Verify and decode JWT token
   * @param {string} token
   */
  verifyToken(token) {
    if (!token) throw new Error('Token is required');
    return jwt.verify(token, config.jwtSecret);
  }

  /**
   * List all authorized users in nhso_auth_users
   */
  async listUsers() {
    const rows = await dflowPool.query(`
      SELECT id, loginname, name, role, is_active, created_at, updated_at, created_by 
      FROM nhso_auth_users 
      ORDER BY id ASC
    `);
    return rows;
  }

  /**
   * Search users from HOSxP opduser to add to authorized list
   * @param {string} keyword
   */
  async searchOpdUsers(keyword = '') {
    const term = `%${String(keyword || '').trim()}%`;
    const rows = await hosPool.query(`
      SELECT loginname, name, account_disable 
      FROM opduser 
      WHERE (account_disable IS NULL OR account_disable != 'Y')
        AND (loginname LIKE ? OR name LIKE ?)
      ORDER BY loginname ASC 
      LIMIT 25
    `, [term, term]);
    return rows;
  }

  /**
   * Add a new authorized user
   * @param {Object} params
   */
  async addUser({ loginname, name = null, role = 'user', created_by = null }) {
    const cleanUser = String(loginname || '').trim();
    if (!cleanUser) throw new Error('กรุณาระบุชื่อผู้ใช้งาน (loginname)');

    // Check duplicate
    const existing = await dflowPool.query(`SELECT id FROM nhso_auth_users WHERE loginname = ?`, [cleanUser]);
    if (existing.length > 0) {
      throw new Error(`ผู้ใช้งาน '${cleanUser}' มีสิทธิ์ในระบบอยู่แล้ว`);
    }

    // If name not provided, get from opduser
    let userName = name;
    if (!userName) {
      const opd = await hosPool.query(`SELECT name FROM opduser WHERE loginname = ?`, [cleanUser]);
      if (opd.length > 0) userName = opd[0].name;
    }

    const cleanRole = role === 'admin' ? 'admin' : 'user';

    const result = await dflowPool.query(`
      INSERT INTO nhso_auth_users (loginname, name, role, is_active, created_by) 
      VALUES (?, ?, ?, 1, ?)
    `, [cleanUser, userName || cleanUser, cleanRole, created_by || null]);

    return {
      id: Number(result.insertId),
      loginname: cleanUser,
      name: userName || cleanUser,
      role: cleanRole,
      is_active: 1
    };
  }

  /**
   * Update authorized user (role or is_active)
   */
  async updateUser(id, { role, is_active }) {
    if (!id) throw new Error('User ID is required');

    const fields = [];
    const values = [];

    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role === 'admin' ? 'admin' : 'user');
    }

    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(id);
    await dflowPool.query(`UPDATE nhso_auth_users SET ${fields.join(', ')} WHERE id = ?`, values);

    const rows = await dflowPool.query(`SELECT id, loginname, name, role, is_active FROM nhso_auth_users WHERE id = ?`, [id]);
    return rows[0];
  }

  /**
   * Delete authorized user
   */
  async deleteUser(id) {
    if (!id) throw new Error('User ID is required');

    // Prevent deleting the last admin
    const adminCount = await dflowPool.query(`SELECT COUNT(*) as cnt FROM nhso_auth_users WHERE role = 'admin' AND is_active = 1`);
    const targetUser = await dflowPool.query(`SELECT id, role, loginname FROM nhso_auth_users WHERE id = ?`, [id]);

    if (targetUser.length > 0 && targetUser[0].role === 'admin' && Number(adminCount[0].cnt) <= 1) {
      throw new Error('ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้');
    }

    await dflowPool.query(`DELETE FROM nhso_auth_users WHERE id = ?`, [id]);
    return { success: true, id };
  }
}

module.exports = new AuthService();
