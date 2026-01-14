const multer = require('multer');
const path = require('path');
const AppError = require('./appError');

const createUploader = (subfolder) => {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, `public/uploads/${subfolder}`);
        },
        filename: (req, file, cb) => {
            // Secure Name: product-123456789.jpg (No spaces, no weird chars)
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `${subfolder}-${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    });

    const fileFilter = (req, file, cb) => {
        // SECURITY: Only allow images
        if (file.mimetype.startsWith('image')) {
            cb(null, true);
        } else {
            cb(new AppError('Not an image! Please upload only images.', 400), false);
        }
    };

    return multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit (High enough for HD banners)
    });
};

// Export pre-configured uploaders
exports.uploadProduct = createUploader('products');
exports.uploadProof = createUploader('proofs');
exports.uploadSite = createUploader('site');