const express = require('express');
const router = express.Router();
const inventoryController = require('../src/controllers/inventoryController');
const { protect, restrictTo, requireSudo } = require('../src/middlewares/authMiddleware');

router.use(protect);

// 1. Bottle Return (Staff can do this)
// When a customer hands back a bottle
router.post('/return-bottles', restrictTo('admin'), inventoryController.returnBottles);

// 2. Restock Supplies (Staff can do this)
// Buying new caps/tissues
router.post('/restock-supplies', restrictTo('admin'), inventoryController.restockSupplies);

// --- NUCLEAR INVENTORY ACTIONS (Sudo Required) ---
// These actions involve moving large assets or writing off losses

// 3. Factory Refill (Swapping empty assets for full ones)
router.post('/factory-refill', restrictTo('admin'), requireSudo, inventoryController.factoryRefill);

// 4. Shrinkage Adjustment (Reporting lost/broken bottles)
router.post('/adjust', restrictTo('admin'), requireSudo, inventoryController.adjustInventory);

module.exports = router;