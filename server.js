const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const path = require('path');
require('dotenv').config();

const app = express();

// Enable trust proxy for Vercel / reverse proxies
app.set('trust proxy', 1);

// Basic Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Serverless-Optimized MongoDB Connection Handler with Cached Promise
let cachedDbPromise = null;
async function connectDB() {
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection;
    }
    if (!cachedDbPromise) {
        cachedDbPromise = mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10
        }).then(m => {
            console.log('MongoDB Connected Successfully');
            return m;
        }).catch(err => {
            cachedDbPromise = null;
            console.error('MongoDB Connection Error:', err.message);
            throw err;
        });
    }
    return cachedDbPromise;
}

// Initial connect trigger (non-blocking)
connectDB().catch(() => {});

// Ensure DB is connected before handling requests
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        if (req.path.startsWith('/api/')) {
            return res.status(503).json({
                message: 'Database connection currently unavailable. Please try again in a few moments.'
            });
        }
        next();
    }
});

// Core Middlewares with generous payload limits for base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// STATIC FILE SERVING MIDDLEWARES
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'views')));

// Persistent Session Management via MongoDB (Prevents session loss on Vercel Serverless)
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_rescue_session_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60, // 1 day
        autoRemove: 'native'
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 Hours
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production' && !process.env.IS_LOCAL
    }
}));

// Health Check & Monitoring Endpoint
app.get('/api/health', (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    res.status(isDbConnected ? 200 : 503).json({
        status: isDbConnected ? 'healthy' : 'degraded',
        database: isDbConnected ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// EXPRESS HTML ROUTING MATRIX (Handles both /route and /route.html)
const serveHTML = (filename) => (req, res) => {
    res.sendFile(path.join(__dirname, 'views', filename));
};

// Root / Home Route
app.get('/', serveHTML('index.html'));
app.get('/index', serveHTML('index.html'));
app.get('/index.html', serveHTML('index.html'));

// Authentication Views
app.get('/login', serveHTML('login.html'));
app.get('/login.html', serveHTML('login.html'));
app.get('/register', serveHTML('register.html'));
app.get('/register.html', serveHTML('register.html'));

// User Interaction Views
app.get('/animals', serveHTML('animals.html'));
app.get('/animals.html', serveHTML('animals.html'));
app.get('/report', serveHTML('report.html'));
app.get('/report.html', serveHTML('report.html'));
app.get('/apply', serveHTML('apply.html'));
app.get('/apply.html', serveHTML('apply.html'));
app.get('/profile', serveHTML('profile.html'));
app.get('/profile.html', serveHTML('profile.html'));

// Dashboard Panels
app.get('/volunteer-apply', serveHTML('volunteer-apply.html'));
app.get('/volunteer-apply.html', serveHTML('volunteer-apply.html'));
app.get('/volunteer', serveHTML('volunteer-dashboard.html'));
app.get('/volunteer-dashboard', serveHTML('volunteer-dashboard.html'));
app.get('/volunteer-dashboard.html', serveHTML('volunteer-dashboard.html'));
app.get('/admin', serveHTML('admin-dashboard.html'));
app.get('/admin-dashboard', serveHTML('admin-dashboard.html'));
app.get('/admin-dashboard.html', serveHTML('admin-dashboard.html'));

// REST API INTERACTION ROUTES
app.use('/api/auth', require('./routes/auth'));
app.use('/api/animals', require('./routes/animals'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/reports', require('./routes/reports'));

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: `API endpoint '${req.originalUrl}' not found.` });
});

// Global Error Handler (Handles Multer and Unhandled Exceptions cleanly)
app.use((err, req, res, next) => {
    console.error('Unhandled Application Error:', err);
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File is too large. Maximum allowed size is 5MB.' });
        }
        return res.status(400).json({ message: `File upload error: ${err.message}` });
    }
    if (err.message && err.message.includes('Only image files are allowed')) {
        return res.status(400).json({ message: err.message });
    }
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error occurred.'
    });
});

// RUN ENGINE CAPABILITIES (Only listen if run directly, not in Vercel Serverless)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
