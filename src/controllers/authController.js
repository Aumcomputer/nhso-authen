const authService = require('../services/authService');

class AuthController {
  async login(req, res) {
    try {
      const { loginname, password } = req.body;
      const result = await authService.login({ loginname, password });

      // Set cookie for browser session (accessible over Intranet HTTP)
      res.cookie('nhso_token', result.token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      return res.json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        token: result.token,
        user: result.user
      });
    } catch (err) {
      console.error('[Auth Error]', err.message);
      return res.status(401).json({
        success: false,
        message: err.message || 'เข้าสู่ระบบไม่สำเร็จ'
      });
    }
  }

  async logout(req, res) {
    res.clearCookie('nhso_token');
    return res.json({
      success: true,
      message: 'ออกจากระบบเรียบร้อยแล้ว'
    });
  }

  async me(req, res) {
    try {
      const token = req.cookies?.nhso_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'ไม่ได้เข้าสู่ระบบ'
        });
      }
      const user = authService.verifyToken(token);
      return res.json({
        success: true,
        user
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'เซสชันหมดอายุ'
      });
    }
  }

  async listUsers(req, res) {
    try {
      const users = await authService.listUsers();
      return res.json({
        success: true,
        data: users
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  async searchOpdUsers(req, res) {
    try {
      const keyword = req.query.q || '';
      const users = await authService.searchOpdUsers(keyword);
      return res.json({
        success: true,
        data: users
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  async addUser(req, res) {
    try {
      const { loginname, name, role } = req.body;
      const created_by = req.user?.loginname || 'admin';
      const user = await authService.addUser({ loginname, name, role, created_by });
      return res.json({
        success: true,
        message: `เพิ่มสิทธิ์ผู้ใช้งาน '${loginname}' สำเร็จ`,
        data: user
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async updateUser(req, res) {
    try {
      const id = req.params.id;
      const { role, is_active } = req.body;
      const user = await authService.updateUser(id, { role, is_active });
      return res.json({
        success: true,
        message: 'อัปเดตสิทธิ์ผู้ใช้งานสำเร็จ',
        data: user
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async deleteUser(req, res) {
    try {
      const id = req.params.id;
      const result = await authService.deleteUser(id);
      return res.json({
        success: true,
        message: 'ลบผู้ใช้งานสำเร็จ',
        data: result
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }
}

module.exports = new AuthController();
