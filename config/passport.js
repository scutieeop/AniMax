require('dotenv').config();
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');

// Discord rol ID'leri
const DISCORD_ROLES = {
    ADMIN: '1330993157361500303',
    GUIDE: '1331976305264300042',
    CONTRIBUTOR: '1331976244069273661'
};

// Environment değişkenlerini kontrol et
if (!process.env.DISCORD_CLIENT_ID) {
    console.error('DISCORD_CLIENT_ID bulunamadı!');
    process.exit(1);
}

if (!process.env.DISCORD_CLIENT_SECRET) {
    console.error('DISCORD_CLIENT_SECRET bulunamadı!');
    process.exit(1);
}

if (!process.env.DISCORD_CALLBACK_URL) {
    console.error('DISCORD_CALLBACK_URL bulunamadı!');
    process.exit(1);
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Kullanıcıyı veritabanında ara veya oluştur
        let user = await User.findOne({ discordId: profile.id });
        
        if (!user) {
            user = await User.create({
                discordId: profile.id,
                username: profile.username,
                email: profile.email,
                avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null
            });
        } else {
            // Mevcut kullanıcının bilgilerini güncelle
            user.username = profile.username;
            user.email = profile.email;
            user.avatar = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : user.avatar;
            await user.save();
        }
        
        return done(null, user);
    } catch (error) {
        console.error('Passport Discord Strategy Hatası:', error);
        return done(error, null);
    }
}));

module.exports = passport; 
