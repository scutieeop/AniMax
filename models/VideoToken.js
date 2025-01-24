const mongoose = require('mongoose');

const videoTokenSchema = new mongoose.Schema({
    videoUrl: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    animeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Anime',
        required: true
    },
    season: {
        type: Number,
        required: true
    },
    episode: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // 1 saat sonra otomatik silinecek
    }
});

const VideoToken = mongoose.model('VideoToken', videoTokenSchema);

module.exports = VideoToken; 