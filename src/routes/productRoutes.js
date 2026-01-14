const express = require('express');
const router = express.Router();
const productController = require('../src/controllers/productController');
const { protect, restrictTo, requireSudo } = require('../src/middlewares/authMiddleware');
const upload = require('../src/config/multer');

// Public
router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);

// Admin Only
router.use(protect, restrictTo('admin'));
router.post('/', upload.array('productImages', 5), productController.createProduct);
router.put('/:id', productController.updateProduct);
router.get('/trash/all', productController.getTrash);
router.put('/restore/:id', productController.restoreProduct);

// Sudo Required
router.put('/:id/price', requireSudo, productController.updatePrice);
router.delete('/:id', requireSudo, productController.softDelete);

module.exports = router;