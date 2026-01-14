const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    // 1. Store Status & Schedule
    isShopOpen: { type: Boolean, default: true },
    schedule: [{
        day: { 
            type: String, 
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
        },
        openTime: { type: String, default: "08:00" },
        closeTime: { type: String, default: "18:00" },
        isClosed: { type: Boolean, default: false }
    }],
    manualOverride: {
        isForcedClosed: { type: Boolean, default: false },
        message: { type: String, default: "Maaf, toko sedang tutup sementara." },
        reopenDate: Date
    },

    // 2. Logistics & Fees
    allowAfterHoursOrdering: { type: Boolean, default: true },
    baseDeliveryFee: { type: Number, default: 5000 },
    pricePerKm: { type: Number, default: 2000 },
    maxDeliveryDistance: { type: Number, default: 10 },
    freeDeliveryThreshold: { type: Number, default: 100000 },
    bottleDepositFee: { type: Number, default: 50000 },

    // 3. Contact & Branding
    whatsappNumber: String,
    instagramUrl: String,
    storeAddress: {
        text: String,
        coordinates: { lat: Number, lng: Number }
    },
    branding: {
        logoUrl: { type: String, default: '/uploads/branding/default-logo.png' },
        bannerUrl: { type: String, default: '/uploads/branding/default-banner.jpg' },
        faviconUrl: { type: String }
    },

    // 4. Feature Toggles
    features: {
        enableLoyaltyAlert: { type: Boolean, default: true },
        enableConsumableTracking: { type: Boolean, default: true },
        enableKasbon: { type: Boolean, default: true },
        enableDistancePricing: { type: Boolean, default: false }
    },

    // 5. Business Rules
    loyaltyThreshold: { type: Number, default: 10 } // "Setiap 10 Galon"

}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);