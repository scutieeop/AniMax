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
    scope: ['identify', 'email'],
    proxy: true,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        console.log('Discord profil bilgileri:', {
            id: profile.id,
            username: profile.username,
            email: profile.email
        });

        let user = await User.findOne({ discordId: profile.id });
        
        if (!user) {
            console.log('Yeni kullanıcı oluşturuluyor...');
            user = await User.create({
                discordId: profile.id,
                username: profile.username,
                email: profile.email,
                avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
                roles: ['user']
            });
            console.log('Yeni kullanıcı oluşturuldu:', user.username);
        } else {
            console.log('Mevcut kullanıcı güncelleniyor:', user.username);
            user.username = profile.username;
            user.email = profile.email;
            user.avatar = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : user.avatar;
            await user.save();
            console.log('Kullanıcı güncellendi');
        }
        
        return done(null, user);
    } catch (error) {
        console.error('Discord authentication hatası:', error);
        return done(error, null);
    }
}));

module.exports = passport; 