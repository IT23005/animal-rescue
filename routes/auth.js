const express = require('express');
const router = express.Router();
const User = require('../models/User');
const VolunteerApplication = require('../models/VolunteerApplication');
const { isLoggedIn } = require('../middleware/auth');

// REGISTER
router.post('/register', async (req, res) => {
    try {
        console.log('Register attempt:', req.body);

        const { name, email, password, phone, address } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password manually here instead of in the model
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            address
        });

        await user.save();
        console.log('User created:', user._id);

        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.userName = user.name;

        req.session.save((err) => {
            if (err) console.error('Session save error:', err);
            res.status(201).json({
                message: 'Registration successful',
                user: { id: user._id, name: user.name, role: user.role }
            });
        });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password, adminCode } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // If trying to login as admin, check secret code
        if (user.role === 'admin') {
            const expectedCode = (process.env.ADMIN_SECRET_CODE || '').trim();
            const providedCode = (adminCode || '').trim();
            if (providedCode !== expectedCode) {
                return res.status(403).json({ message: 'Invalid admin code' });
            }
        }

        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.userName = user.name;

        req.session.save((err) => {
            if (err) console.error('Session save error:', err);
            res.json({
                message: 'Login successful',
                user: { id: user._id, name: user.name, role: user.role }
            });
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// LOGOUT
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
    });
});

// GET current user (check if logged in)
router.get('/me', (req, res) => {
    if (req.session.userId) {
        res.json({
            loggedIn: true,
            user: {
                id: req.session.userId,
                name: req.session.userName,
                role: req.session.userRole
            }
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// GET all users (admin only)
router.get('/users', async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT update user role (admin only)
router.put('/users/:id/role', async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
        res.json({ message: 'Role updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST volunteer application (no login needed)
router.post('/volunteer-apply', async (req, res) => {
    try {
        const { name, email, phone, address, reason, experience } = req.body;

        if (!name || !email || !phone || !address || !reason) {
            return res.status(400).json({ message: 'All required fields must be filled' });
        }

        // Check if already applied
        const existing = await VolunteerApplication.findOne({
            email,
            status: 'pending'
        });
        if (existing) {
            return res.status(400).json({ message: 'You already have a pending application' });
        }

        const application = new VolunteerApplication({
            name, email, phone, address, reason, experience
        });

        await application.save();
        res.status(201).json({ message: 'Volunteer application submitted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET all volunteer applications (admin only)
router.get('/volunteer-applications', async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const applications = await VolunteerApplication.find().sort({ createdAt: -1 });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT review volunteer application (admin only)
router.put('/volunteer-applications/:id', async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }

        const { status } = req.body;
        const volApp = await VolunteerApplication.findByIdAndUpdate(
            req.params.id,
            {
                status,
                reviewedBy: req.session.userId,
                reviewerName: req.session.userName,
                reviewedAt: new Date()
            },
            { new: true }
        );

        // If approved, create volunteer account automatically
        if (status === 'approved') {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(volApp.phone, 10);

            const existingUser = await User.findOne({ email: volApp.email });
            if (!existingUser) {
                const newVolunteer = new User({
                    name: volApp.name,
                    email: volApp.email,
                    password: hashedPassword,
                    phone: volApp.phone,
                    address: volApp.address,
                    role: 'volunteer'
                });
                await newVolunteer.save();
            } else {
                await User.findByIdAndUpdate(existingUser._id, { role: 'volunteer' });
            }
        }

        res.json({ message: 'Application reviewed', volApp });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET my profile
router.get('/profile', isLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT update profile
router.put('/profile', isLoggedIn, async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        const user = await User.findByIdAndUpdate(
            req.session.userId,
            { name, phone, address },
            { new: true }
        ).select('-password');

        // Update session name
        req.session.userName = user.name;

        req.session.save(() => {
            res.json({ message: 'Profile updated', user });
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT change password
router.put('/profile/password', isLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.session.userId);
        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const bcrypt = require('bcryptjs');
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE user (admin only)
router.delete('/users/:id', async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;