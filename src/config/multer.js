const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Import File System
const AppError = require('../utils/appError');

// Map frontend field names to backend folders
const FOLDER_MAP = {
    'productImages': 'products',
    'logo': 'branding',
    'banner': 'branding',
    'favicon': 'branding',
    'paymentProof': 'proofs'
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 1. Determine the folder based on field name
        const folder = FOLDER_MAP[file.fieldname] || 'others';
        const uploadPath = `public/uploads/${folder}`;

        // 2. SAFETY CHECK: Create folder if it doesn't exist (The Fix)
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // SECURITY: Randomize name
        const ext = path.extname(file.originalname);
        const uniqueName = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    // SECURITY: Whitelist only images
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new AppError('Security Alert: Only image files are allowed!', 400), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit
});

module.exports = upload;