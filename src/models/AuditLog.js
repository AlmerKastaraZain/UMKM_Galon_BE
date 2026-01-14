const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    adminName: String,
    action: { type: String, required: true }, // e.g., 'PRICE_CHANGE'
    resource: String,  // e.g., 'Product'
    resourceId: mongoose.Schema.Types.ObjectId,
    details: Object,   // e.g., { oldPrice: 15000, newPrice: 10000 }
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);