const authService = require('../services/authService');
const config = require('../config/config');

/**
 * Extract token from Authorization header, custom headers, query params, or cookie
 */
function extractToken(req) {
  // 1. Authorization header: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.slice(7).trim();
  }
  // 2. Custom API key / access token headers
  if (req.headers['x-api-key']) {
    return String(req.headers['x-api-key']).trim();
  }
  if (req.headers['x-access-token']) {
    return String(req.headers['x-access-token']).trim();
  }
  // 3. Query parameter: ?token=... or ?api_key=...
  if (req.query && req.query.token) {
    return String(req.query.token).trim();
  }
  if (req.query && req.query.api_key) {
    return String(req.query.api_key).trim();
  }
  // 4. Browser session cookie
  if (req.cookies && req.cookies.nhso_token) {
    return req.cookies.nhso_token;
  }
  return null;
}

function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'กรุณาระบุ Token หรือเข้าสู่ระบบก่อนใช้งาน (Unauthorized)'
      });
    }

    // Direct secret key match (for service-to-service communication)
    if (token === config.jwtSecret) {
      req.user = { id: 0, loginname: 'service', role: 'admin' };
      return next();
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง (Invalid/Expired token)',
      error: err.message
    });
  }
}

/**
 * Middleware specifically for API consumers (returns standard API error JSON)
 */
function requireApiAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized: Missing authentication token. Provide via Authorization header (Bearer <JWT>) or query parameter (?token=<JWT>)'
      });
    }

    // Direct secret key match (for service-to-service communication)
    if (token === config.jwtSecret) {
      req.user = { id: 0, loginname: 'service', role: 'admin' };
      return next();
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      status: 401,
      message: 'Unauthorized: Invalid or expired JWT token',
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
  extractToken,
  authenticate,
  requireApiAuth,
  requireAdmin
};
