const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    // Applicant info (no login needed)
    applicantName: {
        type: String,
        required: true
    },
    applicantEmail: {
        type: String
    },
    applicantPhone: {
        type: String,
        required: true
    },
    applicantAddress: {
        type: String,
        required: true
    },
    // Animal info
    animal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Animal',
        required: true
    },
    animalName: {
        type: String
    },
    // Application details
    type: {
        type: String,
        enum: ['adoption', 'foster'],
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    experience: {
        type: String
    },
    homeType: {
        type: String,
        enum: ['house', 'apartment', 'other']
    },
    hasOtherPets: {
        type: Boolean,
        default: false
    },
    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    // Review history
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewerName: {
        type: String
    },
    reviewedAt: {
        type: Date
    },
    reviewNote: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Application', applicationSchema);