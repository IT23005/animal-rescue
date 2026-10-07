const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Report = require('../models/Report');
const { isLoggedIn, isVolunteer } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET all reports (volunteer + admin)
router.get('/', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        const reports = await Report.find().sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST submit report (no login needed)
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const {
            reporterName, reporterPhone, reporterAddress,
            species, location, description
        } = req.body;

        if (!reporterName || !reporterPhone || !reporterAddress) {
            return res.status(400).json({ message: 'Reporter info is required' });
        }
        if (!location || !description) {
            return res.status(400).json({ message: 'Location and description are required' });
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const report = new Report({
            reporterName,
            reporterPhone,
            reporterAddress,
            species,
            location,
            description,
            image: imageUrl
        });

        await report.save();
        res.status(201).json({ message: 'Report submitted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update report status (volunteer + admin)
router.put('/:id', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        const { status, moderatorNote } = req.body;

        const report = await Report.findByIdAndUpdate(
            req.params.id,
            {
                status,
                moderatorNote,
                reviewedBy: req.session.userId,
                reviewerName: req.session.userName,
                reviewedAt: new Date()
            },
            { new: true }
        );

        res.json({ message: 'Report updated', report });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;