const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const Animal = require('../models/Animal');
const { isLoggedIn } = require('../middleware/auth');

// GET all applications (admin only)
router.get('/', isLoggedIn, async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const applications = await Application.find()
            .populate('animal', 'name species image')
            .sort({ createdAt: -1 });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET check pending application for an animal (no login needed)
router.get('/check/:animalId', async (req, res) => {
    try {
        const pending = await Application.findOne({
            animal: req.params.animalId,
            status: 'pending'
        });
        res.json({ hasPending: !!pending });
    } catch (err) {
        res.status(500).json({ hasPending: false });
    }
});

// POST submit application (Open to the public - no login required)
router.post('/', async (req, res) => {
    try {
        const {
            animalId, animalName,
            applicantName, applicantEmail,
            applicantPhone, applicantAddress,
            type, reason, experience,
            homeType, hasOtherPets
        } = req.body;

        if (!applicantName || !applicantPhone || !applicantAddress) {
            return res.status(400).json({ message: 'Your name, phone number, and address are required' });
        }

        const appType = type || 'adoption';
        const appReason = reason || (appType === 'foster'
            ? 'Applied to foster from homepage'
            : 'Applied to adopt from homepage');

        const application = new Application({
            animal: animalId,
            animalName: animalName || 'Rescue Animal',
            applicantName,
            applicantEmail: applicantEmail || '',
            applicantPhone,
            applicantAddress,
            type: appType,
            reason: appReason,
            experience: experience || 'Not specified',
            homeType: homeType || 'house',
            hasOtherPets: hasOtherPets === 'true'
        });

        await application.save();
        res.status(201).json({
            message: 'Application submitted successfully! You will be contacted by our community shortly.'
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT review application (admin only)
router.put('/:id', isLoggedIn, async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }

        const { status, reviewNote } = req.body;

        const application = await Application.findByIdAndUpdate(
            req.params.id,
            {
                status,
                reviewNote,
                reviewedBy: req.session.userId,
                reviewerName: req.session.userName,
                reviewedAt: new Date()
            },
            { new: true }
        ).populate('animal');

        // Update animal status based on decision
        if (status === 'approved') {
            await Animal.findByIdAndUpdate(application.animal._id, { status: 'adopted' });
        } else if (status === 'rejected') {
            await Animal.findByIdAndUpdate(application.animal._id, { status: 'available' });
        }

        res.json({ message: 'Application updated', application });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;