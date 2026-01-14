const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// Import Utils
const AppError = require('./utils/appError');
const globalErrorHandler = require('./middlewares/errorMiddleware');

// Import Routes
const authRoutes = require('../routes/authRoutes');
const productRoutes = require('../routes/productRoutes');
const orderRoutes = require('../routes/orderRoutes');
const adminRoutes = require('../routes/adminRoutes');
const inventoryRoutes = require('../routes/inventoryRoutes');

const app = express();

// ============================================================
// 1. SWAGGER DOCS (Must be BEFORE security middleware)
// ============================================================
const swaggerPath = path.join(__dirname, '../docs/swagger.yaml');
if (fs.existsSync(swaggerPath)) {
    const swaggerDocument = YAML.load(swaggerPath);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log("📄 Documentation available at http://localhost:5000/api-docs");
}

// ============================================================
// 2. GLOBAL SECURITY & MIDDLEWARES
// ============================================================

// Serve static files (Images)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Security Headers
app.use(helmet());

// CORS
app.use(cors({ origin: true, credentials: true }));

// Body Parser
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// --- SECURITY MIDDLEWARES THAT CAUSED THE CRASH ---
// We enable them only for /api routes, not global
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(hpp()); // Prevent Parameter Pollution

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api', limiter);


// ============================================================
// 3. MOUNT API ROUTES
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inventory', inventoryRoutes);


// ============================================================
// 4. ERROR HANDLING
// ============================================================

// 404 Handler (Regex Fix)
app.all(/(.*)/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404, 'ROUTE_NOT_FOUND'));
});

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;