const { body, validationResult } = require('express-validator');
const AppError = require('../utils/appError');

exports.validateProduct = [
    body('price').isFloat({ min: 0 }).withMessage('Price must be a number, Sir.'),
    body('inventory.stock').isInt({ min: 0 }).withMessage('Stock must be a whole number.'),
    body('name').trim().notEmpty().withMessage('Name cannot be empty.'),
    
    // The "Surprise" Middleware
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Send the first error in our Unified Format
            return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_FAILED'));
        }
        next();
    }
];