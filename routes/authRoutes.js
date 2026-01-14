const express = require('express');
const router = express.Router();
const authController = require('../src/controllers/authController');
const { protect, restrictTo, requireSudo } = require('../src/middlewares/authMiddleware');

// --- PUBLIC (No Login Required) ---
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// --- PROTECTED (Login Required for all below) ---
router.use(protect);

// User Profile Management
router.get('/logout', authController.logout);
router.patch('/updateMyPassword', authController.updatePassword);
router.patch('/updateMe', authController.updateMe); // Update address, phone, etc.
router.delete('/deleteMe', authController.deleteMe);

// --- ADMIN ONLY (Admin Role Required for all below) ---
router.use(restrictTo('admin'));

// Sudo Verification
router.post('/sudo-verify', authController.sudoVerify);

// User & Staff Lists
router.get('/users', authController.getAllUsers);
router.get('/admins', authController.getAllAdmins);

// Staff Management (Sudo Required)
router.post('/create-staff', requireSudo, authController.createAdminAccount);
router.delete('/admin/:id', requireSudo, authController.deleteAdminAccount);

module.exports = router;