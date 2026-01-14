const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // FIXED: Was missing

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user', immutable: true },
    
    metadata: {
        phone: { type: String, required: true },
        address: {
            street: String,
            coordinates: { lat: Number, lng: Number }
        }
    },
    
    // Security & Logic
    security: {
        loginAttempts: { type: Number, default: 0 },
        lastAttempt: { type: Date, default: Date.now }
    },
    passwordChangedAt: Date,
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // Business Logic
    bottlesAtHome: { type: Number, default: 0 },
    debtAmount: { type: Number, default: 0 },
    loyaltyStamps: { type: Number, default: 0 },
    totalOrdersCompleted: { type: Number, default: 0 },

    passwordResetToken: String,
    passwordResetExpires: Date
}, { timestamps: true });

// Middleware: Hide deleted users
userSchema.pre(/^find/, function(next) {
    if (this.getFilter().includeDeleted !== true) {
        this.find({ isDeleted: { $ne: true } });
    }
    next();
});

// Middleware: Hash Password & Handle Timestamp
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    // 1. If updating existing password, set timestamp for security
    if (!this.isNew) {
        this.passwordChangedAt = Date.now() - 1000;
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Helper: Compare Password
userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Helper: Generate Reset Token
userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 mins

    return resetToken;
};

module.exports = mongoose.model('User', userSchema);