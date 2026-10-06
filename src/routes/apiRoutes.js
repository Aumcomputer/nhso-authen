const express = require('express');
const router = express.Router();

const tokenController = require('../controllers/tokenController');
const rightSearchController = require('../controllers/rightSearchController');
const authenHistoryController = require('../controllers/authenHistoryController');
const visitController = require('../controllers/visitController');
const vnAuthenController = require('../controllers/vnAuthenController');
const hosSyncController = require('../controllers/hosSyncController');
const authController = require('../controllers/authController');
const exemptPttypeController = require('../controllers/exemptPttypeController');
const noAuthenExemptController = require('../controllers/noAuthenExemptController');
const ucsSubCentersController = require('../controllers/ucsSubCentersController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// 0. Authentication & User Management
router.post('/api/auth/login', (req, res) => authController.login(req, res));
router.post('/api/auth/logout', (req, res) => authController.logout(req, res));
router.get('/api/auth/me', (req, res) => authController.me(req, res));

// User Management (Admin only)
router.get('/api/auth/users', authenticate, (req, res) => authController.listUsers(req, res));
router.get('/api/auth/search-opdusers', authenticate, requireAdmin, (req, res) => authController.searchOpdUsers(req, res));
router.post('/api/auth/users', authenticate, requireAdmin, (req, res) => authController.addUser(req, res));
router.put('/api/auth/users/:id', authenticate, requireAdmin, (req, res) => authController.updateUser(req, res));
router.delete('/api/auth/users/:id', authenticate, requireAdmin, (req, res) => authController.deleteUser(req, res));

// 1. Exempt Pttypes (สิทธิ์ที่ไม่ต้องบอกว่าตรงกันหรือไม่ตรงกัน)
router.get('/api/exempt-pttypes', (req, res) => exemptPttypeController.list(req, res));
router.get('/api/exempt-pttypes/search', authenticate, requireAdmin, (req, res) => exemptPttypeController.searchHosPttypes(req, res));
router.post('/api/exempt-pttypes', authenticate, requireAdmin, (req, res) => exemptPttypeController.add(req, res));
router.put('/api/exempt-pttypes/:id', authenticate, requireAdmin, (req, res) => exemptPttypeController.update(req, res));
router.delete('/api/exempt-pttypes/:id', authenticate, requireAdmin, (req, res) => exemptPttypeController.delete(req, res));

// 2. No-Authen Exempt Pttypes (สิทธิ์ที่ไม่ต้องบอกว่ายังไม่มี authen)
router.get('/api/no-authen-exempt-pttypes', (req, res) => noAuthenExemptController.list(req, res));
router.get('/api/no-authen-exempt-pttypes/search', authenticate, requireAdmin, (req, res) => noAuthenExemptController.searchHosPttypes(req, res));
router.post('/api/no-authen-exempt-pttypes', authenticate, requireAdmin, (req, res) => noAuthenExemptController.add(req, res));
router.put('/api/no-authen-exempt-pttypes/:id', authenticate, requireAdmin, (req, res) => noAuthenExemptController.update(req, res));
router.delete('/api/no-authen-exempt-pttypes/:id', authenticate, requireAdmin, (req, res) => noAuthenExemptController.delete(req, res));

// 3. UCS Sub Centers (รพ.สต. ที่หาก hospmain 10677 ให้กำหนดสิทธิเป็น 92)
router.get('/api/ucs-sub-centers', (req, res) => ucsSubCentersController.list(req, res));
router.get('/api/ucs-sub-centers/search', authenticate, requireAdmin, (req, res) => ucsSubCentersController.searchHospcodes(req, res));
router.post('/api/ucs-sub-centers', authenticate, requireAdmin, (req, res) => ucsSubCentersController.add(req, res));
router.put('/api/ucs-sub-centers/:id', authenticate, requireAdmin, (req, res) => ucsSubCentersController.update(req, res));
router.delete('/api/ucs-sub-centers/:id', authenticate, requireAdmin, (req, res) => ucsSubCentersController.delete(req, res));

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

// 7. HOSxP Sync (บันทึกข้อมูลสิทธิและ Authen Code กลับลง HOSxP)
router.get('/api/hos-sync/preview/:vn', (req, res) => hosSyncController.preview(req, res));
router.post('/api/hos-sync/preview', (req, res) => hosSyncController.preview(req, res));
router.post('/api/hos-sync/save', (req, res) => hosSyncController.save(req, res));

module.exports = router;
