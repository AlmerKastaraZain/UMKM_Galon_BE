const express = require('express');
const router = express.Router();
const orderController = require('../src/controllers/orderController');
const { protect, restrictTo } = require('../src/middlewares/authMiddleware');
const upload = require('../src/config/multer');

router.use(protect);

// --- CUSTOMER & ADMIN ROUTES ---
router.get('/', orderController.getOrders); // Users see own, Admins see all
router.get('/:id', orderController.getOrder); // Secure: checks owner
router.post('/', orderController.createOrder);
router.put('/:id/cancel', orderController.cancelOrder);

// Upload Payment Proof
router.put('/:id/upload-proof', upload.single('paymentProof'), orderController.uploadPaymentProof);

// Submit Feedback (New)
router.post('/:id/feedback', upload.single('reviewPhoto'), orderController.submitFeedback);

// --- ADMIN ONLY ROUTES ---
router.use(restrictTo('admin'));

router.post('/manual', orderController.createManualOrder);
router.put('/:id/status', orderController.updateStatus);
router.put('/:id/verify', orderController.verifyPayment);

module.exports = router;