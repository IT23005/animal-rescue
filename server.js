const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const path = require('path');
require('dotenv').config();

const app = express();

// Enable trust proxy for Vercel / reverse proxies
app.set('trust proxy', 1);

// Serverless MongoDB Connection Handler
let isConnected = false;
async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        console.log('✅ MongoDB Connected Successfully');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
    }
}
// Initial connect trigger
connectDB();

// Ensure DB is connected before handling requests
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// Core Middlewares with generous payload limits for base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🌐 STATIC FILE SERVING MIDDLEWARES (Fixes Localhost & Vercel Asset Loading)
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
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 Hours
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    }
}));

// 📑 EXPRESS HTML ROUTING MATRIX (Handles both /route and /route.html)
const serveHTML = (filename) => (req, res) => {
    res.sendFile(path.join(__dirname, 'views', filename));
};

// Root / Home Route
app.get('/', serveHTML('index.html'));
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

// ⚡ REST API INTERACTION ROUTES
app.use('/api/auth', require('./routes/auth'));
app.use('/api/animals', require('./routes/animals'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/reports', require('./routes/reports'));

// 🚀 RUN ENGINE CAPABILITIES (Only listen if run directly, not in Vercel Serverless)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Local Server running smoothly on http://localhost:${PORT}`);
    });
}

module.exports = app;
