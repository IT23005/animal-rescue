const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Application = require('../models/Application');
const Animal = require('../models/Animal');
const { isLoggedIn, isVolunteer } = require('../middleware/auth');

// GET all applications (volunteer + admin access)
router.get('/', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        const applications = await Application.find()
            .populate('animal', 'name species image status')
            .sort({ createdAt: -1 });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET check pending application for an animal (public)
router.get('/check/:animalId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.animalId)) {
            return res.json({ hasPending: false });
        }
        const pending = await Application.findOne({
            animal: req.params.animalId,
            status: 'pending'
        });
        res.json({ hasPending: !!pending });
    } catch (err) {
        res.status(500).json({ hasPending: false });
    }
});

// POST submit application (public)
router.post('/', async (req, res) => {
    try {
        const {
            animalId, animalName,
            applicantName, applicantEmail,
            applicantPhone, applicantAddress,
            type, reason, experience,
            homeType, hasOtherPets
        } = req.body;

        if (!applicantName || !applicantName.trim() ||
            !applicantPhone || !applicantPhone.trim() ||
            !applicantAddress || !applicantAddress.trim()) {
            return res.status(400).json({ message: 'Full name, phone number, and address are required.' });
        }

        if (!animalId || !mongoose.Types.ObjectId.isValid(animalId)) {
            return res.status(400).json({ message: 'A valid animal must be selected for the application.' });
        }

        const targetAnimal = await Animal.findById(animalId);
        if (!targetAnimal) {
            return res.status(404).json({ message: 'The selected animal was not found or has been removed.' });
        }

        const appType = type || 'adoption';
        const appReason = (reason && reason.trim()) || (appType === 'foster'
            ? 'Application submitted for fostering'
            : 'Application submitted for adoption');

        const application = new Application({
            animal: targetAnimal._id,
            animalName: (animalName || targetAnimal.name || 'Rescue Animal').trim(),
            applicantName: applicantName.trim(),
            applicantEmail: (applicantEmail || '').trim().toLowerCase(),
            applicantPhone: applicantPhone.trim(),
            applicantAddress: applicantAddress.trim(),
            type: appType,
            reason: appReason,
            experience: (experience || 'Not specified').trim(),
            homeType: homeType || 'house',
            hasOtherPets: hasOtherPets === true || hasOtherPets === 'true'
        });

        await application.save();

        res.status(201).json({
            message: 'Application submitted successfully! Our rescue team will contact you shortly.',
            applicationId: application._id
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT review application (volunteer + admin access)
router.put('/:id', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid application ID format' });
        }

        const { status, reviewNote } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value. Must be pending, approved, or rejected.' });
        }

        const application = await Application.findByIdAndUpdate(
            req.params.id,
            {
                status,
                reviewNote: (reviewNote || '').trim(),
                reviewedBy: req.session.userId,
                reviewerName: req.session.userName || 'Staff',
                reviewedAt: new Date()
            },
            { new: true }
        ).populate('animal');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Synchronize animal status
        const animalId = application.animal?._id || application.animal;
        if (animalId) {
            if (status === 'approved') {
                await Animal.findByIdAndUpdate(animalId, { status: 'adopted' });
            } else if (status === 'rejected') {
                // If rejected, check if another application is already approved for this animal
                const otherApproved = await Application.findOne({
                    animal: animalId,
                    status: 'approved',
                    _id: { $ne: application._id }
                });
                if (!otherApproved) {
                    await Animal.findByIdAndUpdate(animalId, { status: 'available' });
                }
            }
        }

        res.json({
            message: `Application ${status} successfully.`,
            application
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;