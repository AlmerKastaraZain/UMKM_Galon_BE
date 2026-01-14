const StoreInventory = require('../models/StoreInventory');
const User = require('../models/User');
const { logAction } = require('../utils/logger');

// @desc    Customer returns empty bottles (Loaned bottles)
exports.returnBottles = async (req, res, next) => {
    try {
        const { userId, quantity } = req.body;
        const user = await User.findById(userId);
        const inventory = await StoreInventory.findOne();

        if (user.bottlesAtHome < quantity) {
            return next(new AppError("User doesn't even have that many bottles, Sir.", 400));
        }

        // 1. Update User Debt
        user.bottlesAtHome -= quantity;
        
        // 2. Update Shop Inventory
        inventory.emptyGallons += quantity;

        await user.save();
        await inventory.save();

        await logAction(req, 'BOTTLE_RETURN', 'User', userId, { quantity });

        res.status(200).json({ status: 'success', message: `${quantity} bottles returned to inventory.` });
    } catch (err) { next(err); }
};

// @desc    Factory Refill (Sending Empties to get Fulls)
// This is a "Nuclear" action - Requires SUDO
exports.factoryRefill = async (req, res, next) => {
    try {
        const { quantity } = req.body;
        const inventory = await StoreInventory.findOne();

        if (inventory.emptyGallons < quantity) {
            return next(new AppError("Not enough empty bottles to refill that many!", 400));
        }

        // The Swap
        inventory.emptyGallons -= quantity;
        inventory.fullGallons += quantity;

        await inventory.save();
        await logAction(req, 'FACTORY_REFILL', 'Inventory', inventory._id, { quantity });

        res.status(200).json({ status: 'success', message: `Refilled ${quantity} bottles from factory, Sir.` });
    } catch (err) { next(err); }
};

exports.restockSupplies = async (req, res, next) => {
    try {
        const { caps, tissues } = req.body;
        const inventory = await StoreInventory.findOne();

        if (caps) inventory.capsCount += caps;
        if (tissues) inventory.tissuesCount += tissues;

        await inventory.save();
        
        await logAction(req, 'SUPPLIES_RESTOCKED', 'Inventory', inventory._id, { caps, tissues });

        res.status(200).json({ status: 'success', message: "Supplies updated." });
    } catch (err) { next(err); }
};

// @desc    Adjust inventory for damaged or lost stock (The "Shrinkage" Fix)
exports.adjustInventory = async (req, res, next) => {
    try {
        const { type, quantity, reason } = req.body; 
        // type: 'fullGallons', 'emptyGallons', 'capsCount', 'tissuesCount'
        
        const inventory = await StoreInventory.findOne();
        
        if (inventory[type] < quantity) {
            return next(new AppError("Cannot remove more than you have, Sir.", 400));
        }

        const oldValue = inventory[type];
        inventory[type] -= quantity;
        
        // If it's a gallon, we might move it to a 'damagedGallons' pool instead of just deleting
        if (type === 'fullGallons' || type === 'emptyGallons') {
            inventory.damagedGallons += quantity;
        }

        await inventory.save();

        await logAction(req, 'INVENTORY_ADJUSTMENT', 'Inventory', inventory._id, {
            item: type,
            removed: quantity,
            oldValue,
            newValue: inventory[type],
            reason: reason || "Damaged/Lost"
        });

        res.status(200).json({ status: 'success', message: "Inventory adjusted for loss." });
    } catch (err) { next(err); }
};

