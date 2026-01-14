const express = require('express');
const router = express.Router();
const adminController = require('../src/controllers/adminController');
const dashboardController = require('../src/controllers/dashboardController');
const auditLogController = require('../src/controllers/auditLogController'); // <-- IMPORT THE NEW CONTROLLER
const { protect, restrictTo, requireSudo } = require('../src/middlewares/authMiddleware');
const upload = require('../src/config/multer');

// All routes here are for ADMIN only
router.use(protect, restrictTo('admin'));

// Analytics & Logs
router.get('/analytics', dashboardController.getAnalytics);
router.get('/logs', auditLogController.getAuditLogs); // <-- ADD THIS NEW ROUTE

// Debt (Kasbon)
router.get('/debt', adminController.getDebtList);
router.post('/debt/settle', adminController.settleDebt);

// Branding
router.put('/branding', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]), adminController.updateBranding);

// --- SUDO REQUIRED ---
// Global Settings
router.put('/settings', requireSudo, adminController.updateSettings);

// Emergency "Panic Button"
router.post('/emergency-toggle', requireSudo, adminController.toggleEmergency);

module.exports = router;