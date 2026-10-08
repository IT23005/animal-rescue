const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Report = require('../models/Report');
const { isLoggedIn, isVolunteer } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (JPEG, PNG, WEBP, etc.)'), false);
        }
    }
});

// GET all reports (volunteer + admin)
router.get('/', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        const reports = await Report.find().sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST submit report (public)
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const {
            reporterName, reporterPhone, reporterAddress,
            species, location, description
        } = req.body;

        if (!reporterName || !reporterName.trim() ||
            !reporterPhone || !reporterPhone.trim() ||
            !reporterAddress || !reporterAddress.trim()) {
            return res.status(400).json({ message: 'Reporter name, phone number, and address are required.' });
        }
        if (!location || !location.trim() || !description || !description.trim()) {
            return res.status(400).json({ message: 'Incident location and description are required.' });
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const report = new Report({
            reporterName: reporterName.trim(),
            reporterPhone: reporterPhone.trim(),
            reporterAddress: reporterAddress.trim(),
            species: species || 'other',
            location: location.trim(),
            description: description.trim(),
            image: imageUrl
        });

        await report.save();
        res.status(201).json({
            message: 'Stray report submitted successfully! Our rescue team has been notified.',
            reportId: report._id
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update report status (volunteer + admin)
router.put('/:id', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid report ID format' });
        }

        const { status, moderatorNote } = req.body;
        if (status && !['pending', 'reviewed', 'resolved'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value. Must be pending, reviewed, or resolved.' });
        }

        const report = await Report.findByIdAndUpdate(
            req.params.id,
            {
                ...(status && { status }),
                moderatorNote: (moderatorNote || '').trim(),
                reviewedBy: req.session.userId,
                reviewerName: req.session.userName || 'Volunteer',
                reviewedAt: new Date()
            },
            { new: true }
        );

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        res.json({ message: 'Report updated successfully', report });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;