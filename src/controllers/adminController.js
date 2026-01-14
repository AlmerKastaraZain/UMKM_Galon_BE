// @desc    Get all users who have unpaid debt (Kasbon)
exports.getDebtList = async (req, res, next) => {
    try {
        const debtors = await User.find({ debtAmount: { $gt: 0 } })
            .select('name metadata.phone debtAmount')
            .sort('-debtAmount');

        res.status(200).json({ status: 'success', data: debtors });
    } catch (err) { next(err); }
};

// @desc    Clear or Pay off Debt (Manual Admin Action)
exports.settleDebt = async (req, res, next) => {
    try {
        const { userId, amountPaid } = req.body;
        const user = await User.findById(userId);

        if (!user) return next(new AppError("User not found", 404));

        const oldDebt = user.debtAmount;
        user.debtAmount -= amountPaid;
        await user.save();

        await logAction(req, 'DEBT_SETTLED', 'User', user._id, { 
            oldDebt, 
            amountPaid, 
            remainingDebt: user.debtAmount 
        });

        res.status(200).json({ status: 'success', message: "Debt updated, Sir." });
    } catch (err) { next(err); }
};

// @desc    Update Business Settings (Admin Only + SUDO)
exports.updateSettings = async (req, res, next) => {
    try {
        // This route should be protected by requireSudo in the routes file
        const settings = await Settings.findOneAndUpdate({}, req.body, {
            new: true,
            upsert: true, // Create it if it doesn't exist
            runValidators: true
        });

        await logAction(req, 'SETTINGS_UPDATED', 'Settings', settings._id, req.body);

        res.status(200).json({
            status: 'success',
            message: "Settings updated, Sir. The shop rules have changed.",
            data: settings
        });
    } catch (err) { next(err); }
};


exports.updateBranding = async (req, res, next) => {
    try {
        const settings = await Settings.findOne();
        
        // Handle Logo Upload
        if (req.files.logo) {
            if (settings.branding.logoUrl) deleteFile(settings.branding.logoUrl); // Delete old
            settings.branding.logoUrl = `/uploads/site/${req.files.logo[0].filename}`;
        }

        // Handle Banner Upload
        if (req.files.banner) {
            if (settings.branding.bannerUrl) deleteFile(settings.branding.bannerUrl); // Delete old
            settings.branding.bannerUrl = `/uploads/site/${req.files.banner[0].filename}`;
        }

        await settings.save();
        res.status(200).json({ status: 'success', data: settings });
    } catch (err) { next(err); }
};

// @desc    Emergency Open/Close Switch
exports.toggleEmergency = async (req, res, next) => {
    try {
        const { isOpen, message, reopenDate } = req.body; // isOpen = false means EMERGENCY CLOSE
        
        const settings = await Settings.findOne();
        
        settings.manualOverride = {
            isForcedClosed: !isOpen, // If isOpen is false, ForceClose is true
            message: message || "Toko tutup sementara karena keadaan darurat.",
            reopenDate: reopenDate || null
        };

        await settings.save();
        await logAction(req, 'EMERGENCY_TOGGLE', 'Settings', settings._id, { isForcedClosed: !isOpen });

        res.status(200).json({ 
            status: 'success', 
            message: isOpen ? "Emergency mode OFF. Shop is normal." : "Emergency mode ACTIVATED. Shop is closed." 
        });
    } catch (err) { next(err); }
};