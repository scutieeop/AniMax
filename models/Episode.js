const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
    episodeNumber: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        default: ''
    },
    videoUrl: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        default: 0
    },
    thumbnail: {
        type: String,
        default: ''
    },
    season: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Season',
        required: true
    },
    anime: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Anime',
        required: true
    },
    addedDate: {
        type: Date,
        default: Date.now
    },
    viewCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Episode', episodeSchema); 