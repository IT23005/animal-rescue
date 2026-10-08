const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const VolunteerApplication = require('../models/VolunteerApplication');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Helper to normalize email
function cleanEmail(email) {
    return (email || '').trim().toLowerCase();
}

// REGISTER
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;
        const normalizedEmail = cleanEmail(email);

        if (!name || !name.trim() || !normalizedEmail || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phone: (phone || '').trim(),
            address: (address || '').trim()
        });

        await user.save();

        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.userName = user.name;

        req.session.save((err) => {
            if (err) console.error('Session save error:', err);
            res.status(201).json({
                message: 'Registration successful! Welcome to Animal Rescue.',
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
        const normalizedEmail = cleanEmail(email);

        if (!normalizedEmail || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        // If trying to login as admin, check secret code
        if (user.role === 'admin') {
            const expectedCode = (process.env.ADMIN_SECRET_CODE || '').trim();
            const providedCode = (adminCode || '').trim();
            if (expectedCode && providedCode !== expectedCode) {
                return res.status(403).json({ message: 'Invalid admin secret code.' });
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
        console.error('Login error:', err);
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
    if (req.session && req.session.userId) {
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
router.get('/users', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update user role (admin only)
router.put('/users/:id/role', isLoggedIn, isAdmin, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        const { role } = req.body;
        if (!['public', 'volunteer', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be public, volunteer, or admin.' });
        }

        // Prevent admin from demoting themselves if desired
        if (req.session.userId.toString() === req.params.id && role !== 'admin') {
            return res.status(400).json({ message: 'You cannot change your own admin role.' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');

        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User role updated successfully', user });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST volunteer application (public)
router.post('/volunteer-apply', async (req, res) => {
    try {
        const { name, email, phone, address, reason, experience } = req.body;
        const normalizedEmail = cleanEmail(email);

        if (!name || !name.trim() || !normalizedEmail ||
            !phone || !phone.trim() ||
            !address || !address.trim() ||
            !reason || !reason.trim()) {
            return res.status(400).json({ message: 'All required fields must be filled.' });
        }

        // Check if user already has a pending application
        const existing = await VolunteerApplication.findOne({
            email: normalizedEmail,
            status: 'pending'
        });
        if (existing) {
            return res.status(400).json({ message: 'You already have an active pending volunteer application.' });
        }

        const application = new VolunteerApplication({
            name: name.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            address: address.trim(),
            reason: reason.trim(),
            experience: (experience || '').trim()
        });

        await application.save();
        res.status(201).json({
            message: 'Volunteer application submitted successfully! Our admin team will review it soon.'
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET all volunteer applications (admin only)
router.get('/volunteer-applications', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const applications = await VolunteerApplication.find().sort({ createdAt: -1 });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT review volunteer application (admin only)
router.put('/volunteer-applications/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid volunteer application ID format' });
        }

        const { status } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const volApp = await VolunteerApplication.findByIdAndUpdate(
            req.params.id,
            {
                status,
                reviewedBy: req.session.userId,
                reviewerName: req.session.userName || 'Admin',
                reviewedAt: new Date()
            },
            { new: true }
        );

        if (!volApp) {
            return res.status(404).json({ message: 'Volunteer application not found' });
        }

        let accountCreated = false;
        // If approved, create volunteer account automatically or upgrade existing account
        if (status === 'approved') {
            const tempPassword = volApp.phone || 'rescue123';
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

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
                volApp.userId = newVolunteer._id;
                await volApp.save();
                accountCreated = true;
            } else {
                await User.findByIdAndUpdate(existingUser._id, { role: 'volunteer' });
                volApp.userId = existingUser._id;
                await volApp.save();
            }
        }

        res.json({
            message: status === 'approved'
                ? `Application approved! ${accountCreated ? 'New volunteer account created (default password is applicant phone number).' : 'Existing user upgraded to volunteer.'}`
                : 'Application rejected.',
            volApp
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET my profile
router.get('/profile', isLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update profile
router.put('/profile', isLoggedIn, async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Name cannot be empty.' });
        }

        const user = await User.findByIdAndUpdate(
            req.session.userId,
            {
                name: name.trim(),
                phone: (phone || '').trim(),
                address: (address || '').trim()
            },
            { new: true }
        ).select('-password');

        if (!user) return res.status(404).json({ message: 'User not found' });

        req.session.userName = user.name;
        req.session.save(() => {
            res.json({ message: 'Profile updated successfully', user });
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT change password
router.put('/profile/password', isLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Both current password and new password are required.' });
        }

        const user = await User.findById(req.session.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE user (admin only)
router.delete('/users/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        if (req.session.userId.toString() === req.params.id) {
            return res.status(400).json({ message: 'You cannot delete your own admin account.' });
        }

        const deleted = await User.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'User not found' });

        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;