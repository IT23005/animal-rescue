const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Animal = require('../models/Animal');
const Report = require('../models/Report');
const { isLoggedIn, isVolunteer } = require('../middleware/auth');

// Multer setup for image upload (Memory storage with image-only filter)
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

// Helper to escape regex special characters
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

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

        if (search && search.trim()) {
            filter.name = { $regex: escapeRegex(search.trim()), $options: 'i' };
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
        const reports = await Report.countDocuments();
        res.json({ available, adopted, reports });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET single animal
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid animal ID format' });
        }
        const animal = await Animal.findById(req.params.id);
        if (!animal) return res.status(404).json({ message: 'Animal not found' });
        res.json(animal);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST add animal (volunteer/admin only)
router.post('/', isLoggedIn, isVolunteer, upload.single('image'), async (req, res) => {
    try {
        const { name, species, age, gender, healthStatus, description } = req.body;

        if (!name || !name.trim() || !species) {
            return res.status(400).json({ message: 'Animal name and species are required.' });
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const animal = new Animal({
            name: name.trim(),
            species,
            age: (age || 'Unknown').trim(),
            gender: gender || 'unknown',
            healthStatus: healthStatus || 'healthy',
            description: (description || '').trim(),
            image: imageUrl,
            addedBy: req.session.userId
        });

        await animal.save();
        res.status(201).json({ message: 'Animal added successfully', animal });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update animal status/details (volunteer/admin only)
router.put('/:id', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid animal ID format' });
        }

        const animal = await Animal.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!animal) return res.status(404).json({ message: 'Animal not found' });
        res.json({ message: 'Animal updated successfully', animal });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST add medical log (volunteer/admin only)
router.post('/:id/medical', isLoggedIn, isVolunteer, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid animal ID format' });
        }

        const { note } = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({ message: 'Medical note content is required.' });
        }

        const animal = await Animal.findById(req.params.id);
        if (!animal) return res.status(404).json({ message: 'Animal not found' });

        animal.medicalLogs.push({
            note: note.trim(),
            date: new Date(),
            addedBy: req.session.userId
        });
        await animal.save();

        res.json({ message: 'Medical log recorded successfully', animal });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE animal (admin only)
router.delete('/:id', isLoggedIn, async (req, res) => {
    try {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin access required to delete animal records' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid animal ID format' });
        }

        const deleted = await Animal.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Animal not found' });

        res.json({ message: 'Animal deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;