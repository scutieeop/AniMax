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
    scope: ['identify', 'email', 'guilds.members.read']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ discordId: profile.id });
        
        // Varsayılan roller
        const userRoles = ['user'];
        
        // Kurucu kontrolü
        const founderIds = process.env.FOUNDER_IDS ? process.env.FOUNDER_IDS.split(',') : [];
        if (founderIds.includes(profile.id)) {
            userRoles.push('founder');
        }

        // Discord sunucusundaki rolleri kontrol et
        if (profile.guilds) {
            const guild = profile.guilds.find(g => g.id === process.env.DISCORD_GUILD_ID);
            if (guild && guild.member) {
                const memberRoles = guild.member.roles || [];
                
                if (memberRoles.includes(DISCORD_ROLES.ADMIN)) userRoles.push('admin');
                if (memberRoles.includes(DISCORD_ROLES.GUIDE)) userRoles.push('guide');
                if (memberRoles.includes(DISCORD_ROLES.CONTRIBUTOR)) userRoles.push('contributor');
            }
        }

        if (user) {
            // Kullanıcı varsa bilgilerini güncelle
            user.username = profile.username;
            user.email = profile.email;
            user.avatarHash = profile.avatar;
            user.roles = [...new Set(userRoles)]; // Tekrarlanan rolleri kaldır
            await user.save();
            return done(null, user);
        }

        // Yeni kullanıcı oluştur
        const newUser = new User({
            username: profile.username,
            email: profile.email,
            discordId: profile.id,
            avatarHash: profile.avatar,
            roles: [...new Set(userRoles)] // Tekrarlanan rolleri kaldır
        });

        await newUser.save();
        done(null, newUser);
    } catch (err) {
        console.error('Passport hatası:', err);
        done(err, null);
    }
}));

module.exports = passport; 