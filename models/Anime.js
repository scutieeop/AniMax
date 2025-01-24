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
        type: String,
        default: "00:00"
    },
    thumbnail: {
        type: String,
        default: ''
    }
});

const seasonSchema = new mongoose.Schema({
    seasonNumber: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        default: ''
    },
    episodes: [episodeSchema]
});

const animeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    imageUrl: {
        type: String,
        required: true
    },
    genres: [{
        type: String
    }],
    seasons: [seasonSchema],
    status: {
        type: String,
        enum: ['ongoing', 'completed', 'upcoming'],
        default: 'ongoing'
    },
    releaseDate: {
        type: Date,
        default: Date.now
    },
    viewCount: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 0
    },
    totalEpisodes: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Anime', animeSchema); 