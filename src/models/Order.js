const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // 1. Identification
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber: { type: String, unique: true, default: () => `WTR-${Date.now()}-${Math.floor(Math.random()*1000)}` },

    // 2. The Basket
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        quantity: Number,
        total: Number
    }],

    // 3. Logistics
    shippingInfo: {
        receiverName: String,
        phone: String,
        fullAddress: String,
        coordinates: { lat: Number, lng: Number },
        deliveryNotes: String
    },

    // 4. Status Tracking
    status: {
        current: { 
            type: String, 
            enum: ['PENDING', 'PAID', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED'],
            default: 'PENDING' 
        },
        isQueued: { type: Boolean, default: false }, // For after-hours orders
        timeline: {
            paidAt: Date,
            shippedAt: Date,
            deliveredAt: Date,
            cancelledAt: Date
        }
    },

    // 5. Payment Snapshot
    payment: {
        method: { type: String, enum: ['CASH', 'TRANSFER', 'KASBON'], default: 'CASH' },
        isPaid: { type: Boolean, default: false },
        isDebt: { type: Boolean, default: false },          // Fixed: Moved inside payment
        isLoyaltyOrder: { type: Boolean, default: false },  // Fixed: Moved inside payment
        
        // Manual Verification
        paymentProofUrl: String, 
        verificationStatus: { 
            type: String, 
            enum: ['AWAITING_UPLOAD', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'],
            default: 'AWAITING_UPLOAD'
        },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        rejectionReason: String,
        
        totalAmount: Number,
        deliveryFee: { type: Number, default: 0 },
        depositFee: { type: Number, default: 0 }
    },

    // 6. Metadata
    metadata: {
        source: { type: String, default: 'Web-App' },
        deliveryDurationMinutes: Number,
        distance: Number,
        loyaltyMilestone: { type: Boolean, default: false }, // Alert for Admin
        adminNote: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);