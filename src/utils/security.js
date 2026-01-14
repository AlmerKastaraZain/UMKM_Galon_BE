const crypto = require('crypto');

exports.createFingerprint = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLang = req.headers['accept-language'] || '';
    
    // Combine headers and create a SHA256 hash
    return crypto
        .createHash('sha256')
        .update(userAgent + acceptLang)
        .digest('hex');
};