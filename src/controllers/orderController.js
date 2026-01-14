
const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const StoreInventory = require('../models/StoreInventory');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { logAction } = require('../utils/logger');
const { getShopStatus } = require('../utils/timeHelper');

// @desc    Get All My Orders (User) or All Orders (Admin)
exports.getOrders = async (req, res, next) => {
    try {
        // 1. Get page and limit from the URL (e.g., ?page=1&limit=10)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = req.user.role === 'admin' ? {} : { user: req.user.id };

        // 2. Fetch only what is needed
        const orders = await Order.find(filter)
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

        const total = await Order.countDocuments(filter);

        res.status(200).json({
            status: 'success',
            results: orders.length,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page
            },
            data: orders
        });
    } catch (err) { next(err); }
};

// @desc    Get Single Order (Owner or Admin Only)
exports.getOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) return next(new AppError("Order not found", 404, 'NOT_FOUND'));

        // SECURITY CHECK: Is this your order? OR are you the boss?
        const isOwner = order.user.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return next(new AppError("You do not have permission to view this order, Sir.", 403, 'ACCESS_DENIED'));
        }

        res.status(200).json({ status: 'success', data: order });
    } catch (err) { next(err); }
};

// @desc    Create Order (User)


exports.createOrder = async (req, res, next) => {
    try {
        const { cartItems, shippingInfo, paymentMethod, distance } = req.body;
        
        // 1. LOAD SYSTEM DATA
        const settings = await Settings.findOne();
        const inventory = await StoreInventory.findOne();
        const user = await User.findById(req.user.id);
        
        if (!settings || !inventory) {
            return next(new AppError("System settings not initialized.", 500));
        }

        // 2. CHECK OPERATIONAL SCHEDULE
        const shopStatus = getShopStatus(settings);
        if (shopStatus.status === 'FORCED_CLOSED') {
            return next(new AppError(shopStatus.message, 400));
        }

        // Handle After-Hours Ordering
        let estimatedDelivery = "Today";
        let isQueued = false;
        if (shopStatus.status !== 'OPEN') {
            if (!settings.allowAfterHoursOrdering) {
                return next(new AppError("Shop is currently closed and not accepting orders.", 400));
            }
            estimatedDelivery = "Tomorrow Morning";
            isQueued = true;
        }

        // 3. LOGISTICS (Distance-Based Delivery Fee)
        let deliveryFee = settings.baseDeliveryFee;
        if (settings.features.enableDistancePricing && distance > 2) {
            deliveryFee += (distance - 2) * settings.pricePerKm;
        }
        if (distance > settings.maxDeliveryDistance) {
            return next(new AppError("Address too far for delivery, Sir.", 400));
        }

        // 4. INITIALIZE CALCULATION VARS
        let subtotal = 0;
        let totalDeposit = 0;
        let totalItemsCount = 0;
        const itemsSnapshot = [];

        // 5. PROCESS CART ITEMS (Inventory & Asset Logic)
        for (const item of cartItems) {
            const prod = await Product.findById(item.productId);
            if (!prod || prod.isDeleted) return next(new AppError("One of the products is no longer available.", 404));

            // A. Check Physical Inventory (Full Gallons)
            if (inventory.fullGallons < item.quantity) {
                return next(new AppError(`Stock empty for ${prod.name}`, 400));
            }

            // B. Check Consumables (Tutup & Tisu) - Optional Toggle
            if (settings.features.enableConsumableTracking) {
                if (inventory.capsCount < item.quantity || inventory.tissuesCount < item.quantity) {
                    return next(new AppError("Out of caps or tissues. Cannot fulfill order.", 400));
                }
                inventory.capsCount -= item.quantity;
                inventory.tissuesCount -= item.quantity;
            }

            // C. Asset Logic (Refill vs New Bottle vs Loan)
            inventory.fullGallons -= item.quantity;

            if (prod.productType === 'REFILL') {
                inventory.emptyGallons += item.quantity; // We receive their empty bottle
            } 
            else if (prod.productType === 'NEW_BOTTLE') {
                // They pay for the plastic, we lose it from our pool
                totalDeposit += settings.bottleDepositFee * item.quantity;
            } 
            else if (prod.productType === 'LOAN') {
                // They borrow it, we track the debt
                user.bottlesAtHome += item.quantity;
            }

            // D. Snapshot the Item (Lock the price)
            itemsSnapshot.push({
                product: prod._id,
                name: prod.name,
                price: prod.price,
                quantity: item.quantity,
                total: prod.price * item.quantity
            });
            subtotal += prod.price * item.quantity;
            totalItemsCount += item.quantity;
        }

        // 6. LOYALTY ALERT LOGIC (Indonesian Milestone)
        let milestoneReached = false;
        if (settings.features.enableLoyaltyAlert) {
            if (user.loyaltyStamps + totalItemsCount >= settings.loyaltyThreshold) {
                milestoneReached = true;
                user.loyaltyStamps = (user.loyaltyStamps + totalItemsCount) % settings.loyaltyThreshold;
            } else {
                user.loyaltyStamps += totalItemsCount;
            }
        }

        // 7. FINAL PRICING & DISCOUNTS
        if (subtotal >= settings.freeDeliveryThreshold) {
            deliveryFee = 0;
        }
        const finalTotal = subtotal + totalDeposit + deliveryFee;

        // 8. CREATE THE ORDER DOCUMENT
        const order = await Order.create({
            user: user._id,
            items: itemsSnapshot,
            shippingInfo,
            payment: {
                method: paymentMethod,
                totalAmount: finalTotal,
                deliveryFee: deliveryFee,
                depositFee: totalDeposit,
                isDebt: paymentMethod === 'KASBON' && settings.features.enableKasbon,
                isPaid: false // Defaults to false until Admin verifies
            },
            status: {
                current: 'PENDING',
                isQueued: isQueued
            },
            metadata: {
                estimatedDelivery: estimatedDelivery,
                distance: distance,
                loyaltyMilestone: milestoneReached // THE ALERT FOR ADMIN
            }
        });

        // 9. PERSIST DATA & LOG ACTION
        await inventory.save();
        await user.save();
        await logAction(req, 'ORDER_CREATED', 'Order', order._id, { total: finalTotal });

        // 10. SEND RESPONSE
        res.status(201).json({
            status: 'success',
            message: isQueued 
                ? "Toko sedang tutup. Pesanan Anda kami antri untuk besok pagi!" 
                : "Pesanan berhasil dibuat!",
            data: order
        });

    } catch (err) {
        // If anything fails, Express will catch it here
        next(err);
    }
};

// @desc    User uploads proof of payment
const { deleteFile } = require('../utils/fileSystem');
exports.uploadPaymentProof = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return next(new AppError("Order not found", 404));

        // IF the order already had an old proof, DELETE IT (Garbage Collector)
        if (order.payment.paymentProofUrl) {
            deleteFile(order.payment.paymentProofUrl);
        }

        // Save the new file path in the DB
        // Path will be: /uploads/proofs/filename.jpg
        order.payment.paymentProofUrl = `/uploads/proofs/${req.file.filename}`;
        order.payment.verificationStatus = 'PENDING_VERIFICATION';
        
        await order.save();

        res.status(200).json({ 
            status: 'success', 
            url: order.payment.paymentProofUrl 
        });
    } catch (err) { next(err); }
};

// @desc    Verify Payment (Admin Only)
exports.verifyPayment = async (req, res, next) => {
    try {
        const { status, reason } = req.body; // 'VERIFIED' or 'REJECTED'
        const order = await Order.findById(req.params.id);
        if (!order) return next(new AppError("Order not found", 404, 'NOT_FOUND'));

        if (status === 'VERIFIED') {
            order.payment.isPaid = true;
            order.payment.verificationStatus = 'VERIFIED';
            order.status.current = 'PREPARING';
            order.status.timeline.paidAt = Date.now();
        } else {
            order.payment.verificationStatus = 'REJECTED';
            order.payment.rejectionReason = reason;
        }

        order.payment.verifiedBy = req.user.id;
        await order.save();

        await logAction(req, 'PAYMENT_VERIFICATION_RESULT', 'Order', order._id, { status });

        res.status(200).json({ status: 'success', data: order });
    } catch (err) { next(err); }
};

// @desc    Update Order Status (Admin Only)
exports.updateStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return next(new AppError("Order not found", 404, 'NOT_FOUND'));

        const oldStatus = order.status.current;
        order.status.current = status;

        if (status === 'SHIPPING') order.status.timeline.shippedAt = Date.now();
        if (status === 'DELIVERED') {
            order.status.timeline.deliveredAt = Date.now();
            const duration = Math.floor((Date.now() - order.createdAt) / 60000);
            order.metadata.deliveryDurationMinutes = duration;
        }

        await order.save();

        await logAction(req, 'ORDER_STATUS_CHANGE', 'Order', order._id, { from: oldStatus, to: status });

        res.status(200).json({ status: 'success', data: order });
    } catch (err) { next(err); }
};

// @desc    Get Order (Owner or Admin)
exports.getOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email');
        if (!order) return next(new AppError("Order not found", 404, 'NOT_FOUND'));

        res.status(200).json({ status: 'success', data: order });
    } catch (err) { next(err); }
};

exports.cancelOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return next(new AppError("Order not found", 404));

        // Security: Only owner or admin can cancel
        if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return next(new AppError("Not authorized", 403));
        }

        // Only allow cancel if it's still PENDING
        if (order.status.current !== 'PENDING') {
            return next(new AppError("Cannot cancel an order already in progress.", 400));
        }

        // Return the stock!
        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { "inventory.stock": item.quantity }
            });
        }

        order.status.current = 'CANCELLED';
        await order.save();

        await logAction(req, 'ORDER_CANCELLED', 'Order', order._id);
        res.status(200).json({ status: 'success', message: "Order cancelled and stock returned." });

    } catch (err) { next(err); }
};

// @desc    Admin manually creates an order (For WA/Phone/Walk-in customers)
exports.createManualOrder = async (req, res, next) => {
    try {
        // Admin picks a user or enters 'Guest' info
        const { customerId, cartItems, paymentMethod, notes } = req.body;
        
        const inventory = await StoreInventory.findOne();
        let subtotal = 0;
        const itemsSnapshot = [];

        for (const item of cartItems) {
            const prod = await Product.findById(item.productId);
            
            // Deduct from shop inventory immediately
            inventory.fullGallons -= item.quantity;
            inventory.capsCount -= item.quantity;
            inventory.tissuesCount -= item.quantity;

            // Asset Logic
            if (prod.productType === 'REFILL') inventory.emptyGallons += item.quantity;
            
            itemsSnapshot.push({
                product: prod._id,
                name: prod.name,
                price: prod.price,
                quantity: item.quantity,
                total: prod.price * item.quantity
            });
            subtotal += prod.price * item.quantity;
        }

        const order = await Order.create({
            user: customerId || null, // Can be a guest
            items: itemsSnapshot,
            status: { current: 'DELIVERED' }, // Usually already delivered or otw
            payment: {
                totalAmount: subtotal, // Admin usually waives delivery fee for WA
                method: paymentMethod,
                isPaid: paymentMethod !== 'KASBON'
            },
            metadata: { 
                source: 'WHATSAPP_MANUAL',
                adminNote: notes 
            }
        });

        await inventory.save();
        await logAction(req, 'MANUAL_ORDER_CREATED', 'Order', order._id);

        res.status(201).json({ status: 'success', data: order });
    } catch (err) { next(err); }
};

// @desc    User submits rating & review
exports.submitFeedback = async (req, res, next) => {
    try {
        const { rating, comment } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) return next(new AppError("Order not found", 404));

        // 1. Security Check
        if (order.user.toString() !== req.user.id) {
            return next(new AppError("Not your order.", 403));
        }

        // 2. Logical Check: Can only review DELIVERED orders
        if (order.status.current !== 'DELIVERED') {
            return next(new AppError("You can only review delivered orders.", 400));
        }

        // 3. Prevent Spam: Check if already reviewed
        if (order.feedback && order.feedback.rating) {
            return next(new AppError("You already reviewed this order.", 400));
        }

        // 4. Update
        order.feedback = {
            rating,
            comment,
            photoReview: req.file ? `/uploads/proofs/${req.file.filename}` : undefined // If they upload a photo
        };
        await order.save();

        res.status(200).json({ status: 'success', message: "Thank you for the review!" });
    } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return next(new AppError("Order not found", 404));

        const oldStatus = order.status.current;
        order.status.current = status;

        // TIMELINE UPDATES
        if (status === 'SHIPPING') order.status.timeline.shippedAt = Date.now();
        
        // --- GAP FIX START ---
        if (status === 'DELIVERED') {
            order.status.timeline.deliveredAt = Date.now();
            
            // 1. Calculate Duration
            const duration = Math.floor((Date.now() - order.createdAt) / 60000);
            order.metadata.deliveryDurationMinutes = duration;

            // 2. Increment User Stats (The Missing Piece!)
            if (oldStatus !== 'DELIVERED') { // Prevent double counting
                await User.findByIdAndUpdate(order.user, { 
                    $inc: { totalOrdersCompleted: 1 } 
                });
            }
        }
        // --- GAP FIX END ---

        await order.save();
        await logAction(req, 'ORDER_STATUS_CHANGE', 'Order', order._id, { from: oldStatus, to: status });

        res.status(200).json({ status: 'success', data: order });
    } catch (err) { next(err); }
};