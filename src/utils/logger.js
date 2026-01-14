const AuditLog = require('../models/AuditLog');

exports.logAction = async (req, action, resource, resourceId, details) => {
    try {
        // This saves the log directly into your MongoDB!
        await AuditLog.create({
            adminId: req.user.id,
            adminName: req.user.name || 'Unknown Admin',
            action,
            resource,
            resourceId,
            details,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
    } catch (err) {
        // We log to console if the DB log fails, so we don't crash the app
        console.error("CRITICAL: Audit Log failed to save to Database!", err);
    }
};