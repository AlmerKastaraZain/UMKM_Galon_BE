const Product = require('../models/Product');
const AppError = require('../utils/appError');
const { logAction } = require('../utils/logger');

// @desc    Get all products (Public)
exports.getProducts = async (req, res, next) => {
    try {
        // 1. Pagination Logic
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12; // 12 is a good number for 3 or 4 columns
        const skip = (page - 1) * limit;

        // 2. Fetch data (hiding internal fields)
        const products = await Product.find()
            .select('-metadata -isDeleted -deletedAt -__v')
            .sort('-createdAt') // Newest first
            .skip(skip)
            .limit(limit);

        // 3. Get total for the frontend to calculate "Next/Prev" buttons
        const total = await Product.countDocuments({ isDeleted: false });

        res.status(200).json({
            status: 'success',
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page
            },
            data: products
        });
    } catch (err) { next(err); }
};

// @desc    Get single product (Public)
exports.getProduct = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return next(new AppError("Product not found", 404, 'NOT_FOUND'));

        product.metadata.viewCount += 1;
        await product.save();

        res.status(200).json({ status: 'success', data: product });
    } catch (err) { next(err); }
};

// @desc    Create Product (Admin Only)
exports.createProduct = async (req, res, next) => {
    try {
        let imageList = [];
        
        // Process Multer Files
        if (req.files) {
            imageList = req.files.map(file => ({
                url: `/uploads/products/${file.filename}`,
                public_id: file.filename // We use filename as ID for local storage
            }));
        }

        const product = await Product.create({
            ...req.body,
            images: imageList,
            metadata: { createdBy: req.user.id }
        });

        res.status(201).json({ status: 'success', data: product });
    } catch (err) { next(err); }
};

// @desc    Update Price (Admin Only + Sudo)
exports.updatePrice = async (req, res, next) => {
    try {
        const { price } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return next(new AppError("Product not found", 404, 'NOT_FOUND'));

        const oldPrice = product.price;
        product.price = price;
        product.metadata.updatedBy = req.user.id;
        await product.save();

        await logAction(req, 'PRICE_CHANGE', 'Product', product._id, { oldPrice, newPrice: price });

        res.status(200).json({ status: 'success', message: "Price updated, Sir." });
    } catch (err) { next(err); }
};

// @desc    General Update (Admin Only)
exports.updateProduct = async (req, res, next) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!product) return next(new AppError("Product not found", 404, 'NOT_FOUND'));

        await logAction(req, 'PRODUCT_UPDATED', 'Product', product._id, { updatedFields: Object.keys(req.body) });

        res.status(200).json({ status: 'success', data: product });
    } catch (err) { next(err); }
};

// @desc    Soft Delete (Admin Only)
exports.softDelete = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return next(new AppError("Product not found", 404, 'NOT_FOUND'));

        product.isDeleted = true;
        product.deletedAt = Date.now();
        await product.save();

        await logAction(req, 'PRODUCT_SOFT_DELETE', 'Product', product._id, { name: product.name });

        res.status(200).json({ status: 'success', message: "Moved to Trash." });
    } catch (err) { next(err); }
};

// @desc    View Trash (Admin Only)
exports.getTrash = async (req, res, next) => {
    try {
        const trash = await Product.find({ isDeleted: true }).setOptions({ includeDeleted: true });
        res.status(200).json({ status: 'success', data: trash });
    } catch (err) { next(err); }
};

// @desc    Restore Product (Admin Only)
exports.restoreProduct = async (req, res, next) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id, 
            { isDeleted: false, deletedAt: null },
            { new: true }
        ).setOptions({ includeDeleted: true });

        if (!product) return next(new AppError("Product not found in trash", 404, 'NOT_FOUND'));

        await logAction(req, 'PRODUCT_RESTORED', 'Product', product._id, { name: product.name });

        res.status(200).json({ status: 'success', message: "Product restored, Sir." });
    } catch (err) { next(err); }
};