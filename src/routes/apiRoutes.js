const express = require('express');
const router = express.Router();

const tokenController = require('../controllers/tokenController');
const rightSearchController = require('../controllers/rightSearchController');
const authenHistoryController = require('../controllers/authenHistoryController');
const visitController = require('../controllers/visitController');
const vnAuthenController = require('../controllers/vnAuthenController');

// 1. Health check
router.get('/health', (req, res) => tokenController.health(req, res));
router.get('/api/db/health', (req, res) => tokenController.dbHealth(req, res));
router.get('/api/db/dflow-health', (req, res) => tokenController.dflowDbHealth(req, res));

// 2. Token Management
router.get('/api/token/status', (req, res) => tokenController.status(req, res));
router.post('/api/token/refresh', (req, res) => tokenController.refresh(req, res));
router.post('/api/token/update', (req, res) => tokenController.updateRefreshToken(req, res));
router.post('/api/token/report', (req, res) => tokenController.reportToken(req, res));
router.get('/api/token/clients', (req, res) => tokenController.listClientTokens(req, res));

// 3. API 1: Right Search (ตรวจสอบสิทธิ์)
router.get('/api/rights/:pid', (req, res) => rightSearchController.getRights(req, res));
router.get('/api/rights', (req, res) => rightSearchController.getRights(req, res));
router.post('/api/rights', (req, res) => rightSearchController.getRights(req, res));

router.get('/api/right-search/:pid', (req, res) => rightSearchController.getRights(req, res));
router.get('/api/right-search', (req, res) => rightSearchController.getRights(req, res));
router.post('/api/right-search', (req, res) => rightSearchController.getRights(req, res));

// 4. API 2: Authencode History (ดูประวัติ authen)
router.get('/api/authen-history/:pid', (req, res) => authenHistoryController.getHistory(req, res));
router.get('/api/authen-history', (req, res) => authenHistoryController.getHistory(req, res));
router.post('/api/authen-history', (req, res) => authenHistoryController.getHistory(req, res));

router.get('/api/authencode-history/:pid', (req, res) => authenHistoryController.getHistory(req, res));
router.get('/api/authencode-history', (req, res) => authenHistoryController.getHistory(req, res));
router.post('/api/authencode-history', (req, res) => authenHistoryController.getHistory(req, res));

// 5. HOSxP Visits & Specialties
router.get('/api/specialties', (req, res) => visitController.getSpecialties(req, res));
router.get('/api/visits', (req, res) => visitController.getVisits(req, res));

// 6. D-Flow vn_nhso_authen (บันทึกและตรวจสอบเฉพาะรายที่ยังไม่มี)
router.post('/api/vn-authen/check-and-save', (req, res) => vnAuthenController.checkAndSave(req, res));
router.get('/api/vn-authen/:vn', (req, res) => vnAuthenController.getByVn(req, res));

module.exports = router;
