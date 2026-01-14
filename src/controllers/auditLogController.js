const AuditLog = require('../models/AuditLog');
const AppError = require('../utils/appError');

// @desc    Get all Audit Logs (Admin Only, with Filtering)
exports.getAuditLogs = async (req, res, next) => {
    try {
        // 1. Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25; // Logs can be numerous, 25 is a good default
        const skip = (page - 1) * limit;

        // 2. Advanced Filtering
        const filter = {};
        if (req.query.adminId) filter.adminId = req.query.adminId;
        if (req.query.action) filter.action = req.query.action;
        if (req.query.resource) filter.resource = req.query.resource;
        
        // Date Range Filtering
        if (req.query.startDate || req.query.endDate) {
            filter.timestamp = {};
            if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate);
            if (req.query.endDate) filter.timestamp.$lte = new Date(req.query.endDate);
        }

        // 3. Database Query
        const logs = await AuditLog.find(filter)
            .sort({ timestamp: -1 }) // Newest logs first
            .skip(skip)
            .limit(limit)
            .populate('adminId', 'name email'); // Replaces adminId with actual admin info

        const total = await AuditLog.countDocuments(filter);

        // 4. Send Response
        res.status(200).json({
            status: 'success',
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page
            },
            data: logs
        });

    } catch (err) {
        next(err);
    }
};