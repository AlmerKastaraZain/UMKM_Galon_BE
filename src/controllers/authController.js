const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');
const { createFingerprint } = require('../utils/security');
const { sendSilentAlarm, verifyTOTP } = require('../utils/securitySystem');
const { logAction } = require('../utils/logger');

// --- HELPER: SEND TOKEN ---
const sendToken = (user, statusCode, res, req) => {
    const fingerprint = createFingerprint(req);
    const token = jwt.sign(
        { id: user._id, role: user.role, fp: fingerprint }, 
        process.env.JWT_SECRET, 
        { expiresIn: '1d' }
    );

    const cookieOptions = {
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict'
    };

    res.cookie('token', token, cookieOptions);

    user.password = undefined; // Hide password in response
    res.status(statusCode).json({ status: 'success', token, user });
};

// ============================================================
// 1. AUTHENTICATION (Register, Login, Logout)
// ============================================================

exports.register = async (req, res, next) => {
    try {
        const { name, email, password, metadata } = req.body;

        // VALIDATION HOLE FIXED: Check required metadata
        if (!metadata || !metadata.phone) {
            return next(new AppError("Phone number is required for delivery, Sir.", 400));
        }

        // 1. Check if email exists (including deleted ones)
        const existingUser = await User.findOne({ email }).setOptions({ includeDeleted: true });

        if (existingUser) {
            if (!existingUser.isDeleted) {
                return next(new AppError("Email already in use, Sir.", 400, 'EMAIL_EXISTS'));
            }

            // PHOENIX FIX: Restore deleted account
            existingUser.name = name;
            existingUser.password = password; // Hashed by pre-save
            existingUser.metadata = metadata; // Updates Address & Coordinates
            existingUser.isDeleted = false;
            existingUser.deletedAt = null;
            await existingUser.save();

            await logAction(req, 'USER_RESTORED_VIA_REG', 'User', existingUser._id);
            return sendToken(existingUser, 201, res, req);
        }

        // 2. Create New User
        // We explicitly map fields to prevent pollution
        const newUser = await User.create({ 
            name, 
            email, 
            password, 
            metadata: {
                phone: metadata.phone,
                address: {
                    street: metadata.address?.street,
                    houseNumber: metadata.address?.houseNumber,
                    rt: metadata.address?.rt,
                    rw: metadata.address?.rw,
                    kelurahan: metadata.address?.kelurahan,
                    kecamatan: metadata.address?.kecamatan,
                    city: metadata.address?.city || 'Jakarta',
                    coordinates: {
                        lat: metadata.address?.coordinates?.lat,
                        lng: metadata.address?.coordinates?.lng
                    }
                }
            }
        });

        await logAction(req, 'USER_REGISTERED', 'User', newUser._id);
        sendToken(newUser, 201, res, req);
    } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password, isAdmin, twoFactorCode } = req.body;
        const Model = isAdmin ? Admin : User;

        if (!email || !password) return next(new AppError("Please provide email and password", 400));

        const user = await Model.findOne({ email }).select('+password');
        
        if (!user || !(await user.comparePassword(password))) {
            return next(new AppError("Invalid credentials", 401));
        }

        // TITAN LAYER: Root Admin Protection
        if (isAdmin && user.email === process.env.ROOT_ADMIN_EMAIL) {
            if (user.is2FAEnabled && !twoFactorCode) {
                return res.status(202).json({
                    status: 'pending',
                    code: '2FA_REQUIRED',
                    message: "Root access requires a 2FA code, Sir."
                });
            }
            if (user.is2FAEnabled && twoFactorCode) {
                const isValid = verifyTOTP(twoFactorCode, user.twoFactorSecret);
                if (!isValid) return next(new AppError("Invalid 2FA Code.", 401));
            }
            sendSilentAlarm(user, req.ip);
        }

        user.lastLoginIP = req.ip;
        await user.save({ validateBeforeSave: false }); // Prevent validation errors on login updates
        
        sendToken(user, 200, res, req);
    } catch (err) { next(err); }
};

exports.logout = (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};

// ============================================================
// 2. PASSWORD MANAGEMENT (Forgot, Reset, Update)
// ============================================================

exports.forgotPassword = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return next(new AppError('No user with that email.', 404));

        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
        const message = `Reset your password here:\n\n${resetURL}\n\nValid for 10 minutes.`;

        try {
            await sendEmail({ email: user.email, subject: 'Password Reset Token', message });
            res.status(200).json({ status: 'success', message: 'Token sent to email!' });
        } catch (err) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });
            return next(new AppError('Email failed to send. Try again later.', 500));
        }
    } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) return next(new AppError('Token is invalid or has expired', 400));

        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.passwordChangedAt = Date.now();
        await user.save();

        sendToken(user, 200, res, req);
    } catch (err) { next(err); }
};

// @desc    Update Password (Logged In User)
exports.updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id).select('+password');

        if (!(await user.comparePassword(currentPassword))) {
            return next(new AppError('Your current password is wrong.', 401));
        }

        user.password = newPassword;
        user.passwordChangedAt = Date.now();
        await user.save();

        sendToken(user, 200, res, req);
    } catch (err) { next(err); }
};

// ============================================================
// 3. PROFILE MANAGEMENT (The Missing Piece!)
// ============================================================

// @desc    Update Current User Data (Address, Phone, Coordinates)
exports.updateMe = async (req, res, next) => {
    try {
        // 1. Create error if user POSTs password data
        if (req.body.password || req.body.passwordConfirm) {
            return next(new AppError('This route is not for password updates. Please use /updateMyPassword.', 400));
        }

        // 2. Filter out unwanted field names that are not allowed to be updated
        // We only allow name and metadata (address/phone)
        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        
        // Handle Metadata updates carefully to not overwrite everything
        if (req.body.metadata) {
            updates.metadata = {
                ...req.user.metadata, // Keep existing data
                ...req.body.metadata  // Overwrite with new data
            };
        }

        // 3. Update user document
        const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ status: 'success', data: { user: updatedUser } });
    } catch (err) { next(err); }
};

exports.deleteMe = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { isDeleted: true, deletedAt: Date.now() });
        res.cookie('token', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true });
        res.status(200).json({ status: 'success', message: 'Account deactivated.' });
    } catch (err) { next(err); }
};

// ============================================================
// 4. ADMIN MANAGEMENT (Staff & Sudo)
// ============================================================

exports.sudoVerify = async (req, res, next) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findById(req.user.id).select('+password');

        if (!admin || !(await admin.comparePassword(password))) {
            return next(new AppError("Sudo verification failed.", 401));
        }

        const sudoToken = jwt.sign({ sudo: true }, process.env.JWT_SECRET, { expiresIn: '10m' });

        res.cookie('sudo_token', sudoToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 10 * 60 * 1000
        }).json({ status: 'success', message: "Sudo mode active." });
    } catch (err) { next(err); }
};

exports.getAllUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password -__v')
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments({ isDeleted: false });

        res.status(200).json({
            status: 'success',
            pagination: { total, pages: Math.ceil(total / limit), currentPage: page },
            data: users
        });
    } catch (err) { next(err); }
};

exports.getAllAdmins = async (req, res, next) => {
    try {
        // Ghost Protection
        const filter = req.user.email === process.env.ROOT_ADMIN_EMAIL ? {} : { isGhost: { $ne: true } };
        const admins = await Admin.find(filter).select('-password');
        res.status(200).json({ status: 'success', data: admins });
    } catch (err) { next(err); }
};

exports.createAdminAccount = async (req, res, next) => {
    try {
        // Now supports Ghost Mode creation
        const { name, email, password, employeeId, isGhost } = req.body;

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) return next(new AppError("Admin email exists.", 400));

        const newAdmin = await Admin.create({ name, email, password, employeeId, isGhost });

        await logAction(req, 'ADMIN_CREATED', 'Admin', newAdmin._id, { newAdminEmail: email });
        res.status(201).json({ status: 'success', message: "Staff account created." });
    } catch (err) { next(err); }
};

exports.deleteAdminAccount = async (req, res, next) => {
    try {
        const targetId = req.params.id;
        const actorId = req.user.id;

        if (targetId === actorId) return next(new AppError("Suicide prohibited.", 400));

        const targetAdmin = await Admin.findById(targetId);
        if (!targetAdmin) return next(new AppError("Admin not found.", 404));

        if (targetAdmin.email === process.env.ROOT_ADMIN_EMAIL) return next(new AppError("Root protected.", 403));

        const count = await Admin.countDocuments();
        if (count <= 1) return next(new AppError("Last admin lock.", 403));

        await Admin.findByIdAndDelete(targetId);
        await logAction(req, 'ADMIN_DELETED', 'Admin', targetId, { deleted: targetAdmin.email });

        res.status(200).json({ status: 'success', message: "Admin removed." });
    } catch (err) { next(err); }
};