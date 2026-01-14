const mongoose = require('mongoose');

const storeInventorySchema = new mongoose.Schema({
    fullGallons: { type: Number, default: 0 },    // Ready to sell
    emptyGallons: { type: Number, default: 0 },   // Waiting for factory
    damagedGallons: { type: Number, default: 0 }, // Broken
    
    capsCount: { type: Number, default: 0 },      // Tutup Galon
    tissuesCount: { type: Number, default: 0 },   // Tisu Galon
}, { timestamps: true });

module.exports = mongoose.model('StoreInventory', storeInventorySchema);