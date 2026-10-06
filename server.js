const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Cloud MongoDB Connection Pool
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.log('❌ MongoDB Connection Error:', err));

// Core Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🌐 STATIC FILE SERVING MIDDLEWARES (Fixes Localhost & Vercel Asset Loading)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'views'))); // views ফোল্ডারকে স্ট্যাটিক ডিরেক্টরি করা হলো

// Session Management Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_rescue_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 Hours
}));

// 📑 EXPRESS HTML ROUTING MATRIX (Handles both /route and /route.html)
const serveHTML = (filename) => (req, res) => {
    res.sendFile(path.join(__dirname, 'views', filename));
};

// Root / Home Route
app.get('/', serveHTML('index.html'));
app.get('/index.html', serveHTML('index.html'));

// Authentic Verification Components
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

// Dashboard Panels & Verification
app.get('/volunteer-apply', serveHTML('volunteer-apply.html'));
app.get('/volunteer-apply.html', serveHTML('volunteer-apply.html'));
app.get('/volunteer', serveHTML('volunteer-dashboard.html'));
app.get('/volunteer-dashboard.html', serveHTML('volunteer-dashboard.html'));
app.get('/admin', serveHTML('admin-dashboard.html'));
app.get('/admin-dashboard.html', serveHTML('admin-dashboard.html'));

// ⚡ REST API INTERACTION ROUTES
app.use('/api/auth', require('./routes/auth'));
app.use('/api/animals', require('./routes/animals'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/reports', require('./routes/reports'));

// 🚀 RUN ENGINE CAPABILITIES (Prevents Crash on Vercel Serverless Functions)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Local Server running smoothly on http://localhost:${PORT}`);
    });
}

module.exports = app;
