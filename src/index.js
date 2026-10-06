const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/config');
const apiRoutes = require('./routes/apiRoutes');
const tokenManager = require('./services/tokenManager');

// Support BigInt serialization in JSON responses
BigInt.prototype.toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

const app = express();

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount Routes
app.use('/', apiRoutes);

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// Start Server
const server = app.listen(config.port, async () => {
  console.log('====================================================');
  console.log(`🚀 NHSO Token & API Service running on port ${config.port}`);
  console.log(`👉 Health Check: http://localhost:${config.port}/health`);
  console.log(`👉 Token Status: http://localhost:${config.port}/api/token/status`);
  console.log(`👉 1. ตรวจสอบสิทธิ์: http://localhost:${config.port}/api/rights/<PID>`);
  console.log(`👉 2. ดูประวัติ authen: http://localhost:${config.port}/api/authen-history/<PID>`);
  console.log('====================================================');

  // Verify / initialize token on startup in the background
  try {
    await tokenManager.getValidAccessToken();
    console.log('[Startup] ✅ Initial access token is ready and active.');
  } catch (err) {
    console.warn('[Startup] ⚠️ Could not fetch initial access token:', err.message);
  }
});

module.exports = { app, server };
