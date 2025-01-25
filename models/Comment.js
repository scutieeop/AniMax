const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    anime: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Anime',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    isSpoiler: {
        type: Boolean,
        default: false
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Yorum güncellendiğinde updatedAt alanını güncelle
commentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Yorumu silen kullanıcının yetkisi var mı kontrol et
commentSchema.methods.canDelete = function(user) {
    return user && (
        user._id.equals(this.user) || // Yorumun sahibi
        user.roles.includes('admin') || // Admin
        user.roles.includes('founder') // Kurucu
    );
};

module.exports = mongoose.model('Comment', commentSchema); 