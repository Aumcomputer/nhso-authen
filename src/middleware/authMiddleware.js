const authService = require('../services/authService');

function authenticate(req, res, next) {
  try {
    const token = req.cookies?.nhso_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน'
      });
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
      error: err.message
    });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการส่วนนี้ได้'
    });
  }
  next();
}

module.exports = {
  authenticate,
  requireAdmin
};
