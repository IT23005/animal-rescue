const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // Reporter info (no login needed)
    reporterName: {
        type: String,
        required: true
    },
    reporterPhone: {
        type: String,
        required: true
    },
    reporterAddress: {
        type: String,
        required: true
    },
    // Animal info
    species: {
        type: String,
        enum: ['dog', 'cat', 'bird', 'other']
    },
    location: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved'],
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
    moderatorNote: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Report', reportSchema);