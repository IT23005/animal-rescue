const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Animal = require('../models/Animal');
const { isLoggedIn, isVolunteer } = require('../middleware/auth');

// Multer setup for image upload (Memory storage for serverless environments)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET all animals (with filters)
router.get('/', async (req, res) => {
    try {
        const { species, healthStatus, status, search } = req.query;
        let filter = {};

        if (species) filter.species = species;
        if (healthStatus) filter.healthStatus = healthStatus;

        // If status is 'all', show everything. Otherwise filter by status
        if (status && status !== 'all') {
            filter.status = status;
        } else if (!status) {
            filter.status = 'available'; // default for public browse
        }
        // if status === 'all', no status filter (admin sees everything)

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const animals = await Animal.find(filter).sort({ createdAt: -1 });
        res.json(animals);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET stats for homepage
router.get('/stats', async (req, res) => {
    try {
        const available = await Animal.countDocuments({ status: 'available' });
        const adopted = await Animal.countDocuments({ status: 'adopted' });
        const Report = require('../models/Report');
        const reports = await Report.countDocuments();
        res.json({ available, adopted, reports });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET single animal
router.get('/:id', async (req, res) => {
    try {
        const animal = await Animal.findById(req.params.id);
        if (!animal) return res.status(404).json({ message: 'Animal not found' });
        res.json(animal);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST add animal (volunteer/admin only)
router.post('/', isLoggedIn, isVolunteer, upload.single('image'), async (req, res) => {
    try {
        const { name, species, age, gender, healthStatus, description } = req.body;
        let imageUrl = null;
        if (req.file) {
            imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }
        const animal = new Animal({
            name, species, age, gender, healthStatus, description,
            image: imageUrl,
            addedBy: req.session.userId
        });
        await animal.save();
        res.status(201).json({ message: 'Animal added successfully', animal });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update animal status (volunteer/admin only)
router.put('/:id', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        const animal = await Animal.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({ message: 'Animal updated', animal });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST add medical log (volunteer/admin only)
router.post('/:id/medical', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        const animal = await Animal.findById(req.params.id);
        if (!animal) return res.status(404).json({ message: 'Animal not found' });

        animal.medicalLogs.push({
            note: req.body.note,
            addedBy: req.session.userId
        });
        await animal.save();
        res.json({ message: 'Medical log added', animal });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE animal (admin only)
router.delete('/:id', isLoggedIn, async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        await Animal.findByIdAndDelete(req.params.id);
        res.json({ message: 'Animal deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;