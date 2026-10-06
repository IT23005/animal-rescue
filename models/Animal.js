const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    species: {
        type: String,
        enum: ['dog', 'cat', 'bird', 'other'],
        required: true
    },
    age: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'unknown']
    },
    healthStatus: {
        type: String,
        enum: ['healthy', 'needs treatment', 'critical'],
        default: 'healthy'
    },
    description: {
        type: String
    },
    image: {
        type: String
    },
    status: {
        type: String,
        enum: ['available', 'pending', 'adopted'],
        default: 'available'
    },
    medicalLogs: [{
        note: String,
        date: { type: Date, default: Date.now },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Animal', animalSchema);