const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin', immutable: true },
    employeeId: { type: String, required: true },
    
    // Security Fields
    twoFactorSecret: String, 
    is2FAEnabled: { type: Boolean, default: false },
    isGhost: { type: Boolean, default: false }, 
    lastLoginIP: String,
    passwordChangedAt: Date
}, { timestamps: true });

// 1. Hash Password & Set Change Timestamp
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    // If it's not a new user, update the timestamp (for token revocation)
    if (!this.isNew) {
        this.passwordChangedAt = Date.now() - 1000;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// 2. Compare Password
adminSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);