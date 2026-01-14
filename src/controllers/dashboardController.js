const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const StoreInventory = require('../models/StoreInventory');
const AppError = require('../utils/appError');

// Helper: Get Start Date based on query
const getStartDate = (period) => {
    const now = new Date();
    if (period === '7d') return new Date(now.setDate(now.getDate() - 7));
    if (period === '30d') return new Date(now.setDate(now.getDate() - 30));
    if (period === '1y') return new Date(now.setFullYear(now.getFullYear() - 1));
    return new Date(0); // 'all' (Beginning of time)
};

exports.getAnalytics = async (req, res, next) => {
    try {
        const { period } = req.query; // ?period=7d, 30d, 1y, or all
        const startDate = getStartDate(period || '30d');
        
        // GLOBAL FILTER: Applied to all order calculations
        const dateFilter = { 
            createdAt: { $gte: startDate }, 
            "status.current": { $ne: 'CANCELLED' } 
        };

        // ===============================================
        // 1. FINANCIAL HEALTH ( The "Arus Kas" )
        // ===============================================
        
        const financialStats = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$payment.totalAmount" },
                    totalDeliveryFees: { $sum: "$payment.deliveryFee" },
                    totalBottleDeposits: { $sum: "$payment.depositFee" },
                    avgOrderValue: { $avg: "$payment.totalAmount" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);

        const financials = financialStats[0] || { 
            totalRevenue: 0, totalDeliveryFees: 0, totalBottleDeposits: 0, avgOrderValue: 0, totalOrders: 0 
        };

        // 2. PAYMENT METHODS (Cash vs Transfer vs Kasbon)
        const paymentMethods = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$payment.method",
                    count: { $sum: 1 },
                    volume: { $sum: "$payment.totalAmount" }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // 3. DEBT ANALYSIS (The "Kasbon" Reality)
        // Note: Debt is user-based, so we look at the User model for current total debt
        const debtStats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalOutstandingDebt: { $sum: "$debtAmount" },
                    totalDebtors: { 
                        $sum: { $cond: [ { $gt: ["$debtAmount", 0] }, 1, 0 ] } 
                    }
                }
            }
        ]);
        
        // 4. INCOME VS DEBT (Risk Ratio)
        // How much of our revenue is actually just "notes on paper" (Kasbon)?
        const kasbonOrders = paymentMethods.find(p => p._id === 'KASBON');
        const riskyRevenue = kasbonOrders ? kasbonOrders.volume : 0;
        const realCashRevenue = financials.totalRevenue - riskyRevenue;

        // ===============================================
        // 5. PRODUCT PERFORMANCE (The "Best Sellers")
        // ===============================================
        
        const productPerformance = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: "$items" }, // Deconstruct items array
            {
                $group: {
                    _id: "$items.name",
                    unitsSold: { $sum: "$items.quantity" },
                    revenueGenerated: { $sum: "$items.total" },
                    productId: { $first: "$items.product" }
                }
            },
            { $sort: { unitsSold: -1 } } // Highest sold first
        ]);

        // 6. ASSET ANALYSIS (Refill vs New Bottle)
        // This tells us if we are gaining customers (New Bottle) or retaining (Refill)
        const assetAnalysis = await Product.populate(productPerformance, { path: 'productId', select: 'productType' });
        
        let refillCount = 0;
        let newBottleCount = 0;
        
        assetAnalysis.forEach(p => {
            if (p.productId?.productType === 'REFILL') refillCount += p.unitsSold;
            if (p.productId?.productType === 'NEW_BOTTLE') newBottleCount += p.unitsSold;
        });

        // 7. INVENTORY SNAPSHOT (Real-time)
        const inventory = await StoreInventory.findOne();
        
        // Calculated Health: Do we have enough caps for our full gallons?
        const suppliesRatio = inventory.capsCount / (inventory.fullGallons || 1);
        let supplyHealth = "GOOD";
        if (suppliesRatio < 1) supplyHealth = "CRITICAL: Not enough caps for gallons!";
        else if (suppliesRatio < 1.5) supplyHealth = "WARNING: Buy caps soon.";

        // 8. DELIVERY EFFICIENCY (Big Data Time)
        // Calculating average delivery time based on metadata
        const deliveryStats = await Order.aggregate([
            { 
                $match: { 
                    ...dateFilter, 
                    "status.current": 'DELIVERED',
                    "metadata.deliveryDurationMinutes": { $exists: true } 
                } 
            },
            {
                $group: {
                    _id: null,
                    avgDeliveryTime: { $avg: "$metadata.deliveryDurationMinutes" },
                    fastestDelivery: { $min: "$metadata.deliveryDurationMinutes" },
                    slowestDelivery: { $max: "$metadata.deliveryDurationMinutes" }
                }
            }
        ]);

        // 9. BUSIEST HOURS (Heatmap Data)
        // Which hour of the day gets the most orders? (0-23)
        const hourlyHeatmap = await Order.aggregate([
            { $match: dateFilter },
            { 
                $project: { 
                    hour: { $hour: { date: "$createdAt", timezone: "Asia/Jakarta" } } 
                } 
            },
            {
                $group: {
                    _id: "$hour",
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { orderCount: -1 } },
            { $limit: 5 } // Top 5 busiest hours
        ]);


        // ===============================================
        // 10. USER INTELLIGENCE (Know Your Customer)
        // ===============================================

        // A. The "Sultans" (Top Spenders)
        const topSpenders = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$user",
                    totalSpent: { $sum: "$payment.totalAmount" },
                    ordersCount: { $sum: 1 },
                    lastOrderDate: { $max: "$createdAt" }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: "$userInfo" },
            {
                $project: {
                    name: "$userInfo.name",
                    phone: "$userInfo.metadata.phone",
                    totalSpent: 1,
                    ordersCount: 1,
                    loyaltyStamps: "$userInfo.loyaltyStamps"
                }
            }
        ]);

        // B. Geography (Average Distance)
        // Helps decide if you should increase pricePerKm
        const geoStats = await Order.aggregate([
            { $match: { ...dateFilter, "metadata.distance": { $gt: 0 } } },
            {
                $group: {
                    _id: null,
                    avgDistance: { $avg: "$metadata.distance" },
                    maxDistance: { $max: "$metadata.distance" }
                }
            }
        ]);

        // ===============================================
        // 11. FINAL RESPONSE CONSTRUCTION
        // ===============================================

        res.status(200).json({
            status: 'success',
            meta: {
                period: period || '30d',
                generatedAt: new Date()
            },
            financials: {
                grossRevenue: financials.totalRevenue,
                realCashRevenue: realCashRevenue, // Actual money in hand
                debtVolume: riskyRevenue, // Money in "Kasbon" notes
                outstandingTotalDebt: debtStats[0]?.totalOutstandingDebt || 0,
                deliveryFeeRevenue: financials.totalDeliveryFees,
                depositRevenue: financials.totalBottleDeposits
            },
            operations: {
                totalOrders: financials.totalOrders,
                avgOrderValue: Math.round(financials.avgOrderValue),
                avgDeliveryMinutes: Math.round(deliveryStats[0]?.avgDeliveryTime || 0),
                busiestHours: hourlyHeatmap.map(h => `${h._id}:00`), // e.g., ["14:00", "09:00"]
                avgDeliveryDistanceKm: Math.round((geoStats[0]?.avgDistance || 0) * 10) / 10
            },
            inventory: {
                healthStatus: supplyHealth,
                fullGallons: inventory.fullGallons,
                emptyGallons: inventory.emptyGallons,
                supplies: {
                    caps: inventory.capsCount,
                    tissues: inventory.tissuesCount
                },
                salesMix: {
                    refill: refillCount,
                    newBottle: newBottleCount
                }
            },
            paymentAnalysis: paymentMethods, // List of method + count
            topProducts: productPerformance.map(p => ({
                name: p._id,
                sold: p.unitsSold,
                revenue: p.revenueGenerated
            })),
            topCustomers: topSpenders
        });

    } catch (err) {
        next(err);
    }
};