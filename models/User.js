const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['user', 'admin', 'founder', 'contributor', 'guide', 'premium', 'vip'];
const BADGES = ['admin', 'premium', 'vip', 'founder', 'moderator', 'supporter', 'verified'];

const userSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    email: String,
    avatarUrl: String,
    roles: {
        type: [String],
        default: ['user']
    },
    discordRoles: {
        type: [String],
        default: []
    },
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Anime'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    }
});

// Avatar URL'sini oluşturan virtual alan
userSchema.virtual('avatar').get(function() {
    if (this.avatarUrl) {
        return this.avatarUrl;
    }
    return 'https://cdn.discordapp.com/embed/avatars/0.png'; // Varsayılan avatar
});

// Rol kontrol metodları
userSchema.methods.hasRole = function(role) {
    return this.roles.includes(role);
};

userSchema.methods.isAdmin = function() {
    return this.hasRole('admin') || this.hasRole('founder');
};

userSchema.methods.isFounder = function() {
    const founderIds = process.env.FOUNDER_IDS ? process.env.FOUNDER_IDS.split(',') : [];
    return this.discordId && founderIds.includes(this.discordId);
};

userSchema.methods.isContributor = function() {
    return this.hasRole('contributor');
};

userSchema.methods.isGuide = function() {
    return this.hasRole('guide');
};

// Şifre karşılaştırma metodu
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

// Founder rolünü otomatik atama
userSchema.pre('save', async function(next) {
    const founderIds = process.env.FOUNDER_IDS ? process.env.FOUNDER_IDS.split(',') : [];
    if (this.discordId && founderIds.includes(this.discordId)) {
        if (!this.roles.includes('founder')) {
            this.roles = [...new Set([...this.roles, 'founder'])];
        }
    }
    next();
});

// Şifre hashleme middleware
userSchema.pre('save', async function(next) {
    if (this.isModified('password') && this.password) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User; 