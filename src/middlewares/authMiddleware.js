const jwt = require('jsonwebtoken');
const User = require('../models/User');
    
const { createFingerprint } = require('../utils/security');

// Middleware to check if user is logged in
exports.protect = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return next(new AppError("Please login, Sir.", 401, 'AUTH_REQUIRED'));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 1. Find user (even if soft-deleted, we check them)
        const currentUser = await User.findById(decoded.id).setOptions({ includeDeleted: true });
        
        if (!currentUser || currentUser.isDeleted) {
            return next(new AppError("User no longer exists, Sir.", 401, 'USER_GONE'));
        }

        // 2. TOKEN REVOCATION CHECK (Hole 4 Fix)
        if (currentUser.passwordChangedAt) {
            const changedTimestamp = parseInt(currentUser.passwordChangedAt.getTime() / 1000, 10);
            if (decoded.iat < changedTimestamp) {
                return next(new AppError("Password recently changed. Please login again.", 401, 'TOKEN_EXPIRED'));
            }
        }

        req.user = currentUser; 
        next();
    } catch (err) {
        return next(new AppError("Invalid session.", 401, 'AUTH_INVALID'));
    }
};


// Middleware to check if user is an ADMIN
exports.admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Admins only!" });
    }
};

    
// Only the owner of the order OR an admin can access this specific data
exports.isOrderOwnerOrAdmin = async (req, res, next) => {
    try {
        const order = await mongoose.model('Order').findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const isOwner = order.user.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (isOwner || isAdmin) {
            next();
        } else {
            res.status(403).json({ message: "You do not have permission to view this order, sir." });
        }
    } catch (err) {
        res.status(500).json({ message: "Security Check Failed" });
    }
};


exports.requireSudo = (req, res, next) => {
    const sudoToken = req.cookies.sudo_token;

    if (!sudoToken) {
        return next(new AppError("This action requires Sudo Mode. Please verify password.", 403, 'SUDO_REQUIRED'));
    }

    try {
        jwt.verify(sudoToken, process.env.JWT_SECRET);
        next(); // The ticket is valid, proceed to the Nuclear action!
    } catch (err) {
        return next(new AppError("Sudo session expired. Re-verify password.", 403));
    }
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new AppError("You do not have permission, Sir.", 403, 'FORBIDDEN'));
        }
        next();
    };
};


