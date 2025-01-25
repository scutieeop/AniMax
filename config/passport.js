require('dotenv').config();
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Discord rol ID'leri
const DISCORD_ROLES = {
    ADMIN: '1330993157361500303',
    GUIDE: '1331976305264300042',
    CONTRIBUTOR: '1331976244069273661',
    PREMIUM: '1332440779309973525',
    SUPPORTER: '1332379048407470180'
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
    scope: ['identify', 'email', 'guilds.members.read'],
    proxy: true,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        // Discord API'den kullanıcı bilgilerini al
        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        
        const userData = await userResponse.json();
        console.log('Discord kullanıcı bilgileri:', userData);

        // Discord API'den sunucu üye bilgilerini al
        const guildMemberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        
        const guildMember = await guildMemberResponse.json();
        console.log('Sunucu üye bilgileri:', guildMember);

        // Kullanıcının rollerini belirle
        let userRoles = ['user'];
        const founderIds = ['1246506868977696811', '1245436966972031069', '1112945015132536943'];
        
        if (founderIds.includes(userData.id)) {
            userRoles.push('founder');
        }

        // Admin rolünü kontrol et
        if (guildMember && guildMember.roles && guildMember.roles.includes(DISCORD_ROLES.ADMIN)) {
            userRoles.push('admin');
        }

        let user = await User.findOne({ discordId: userData.id });
        
        if (!user) {
            console.log('Yeni kullanıcı oluşturuluyor...');
            user = await User.create({
                discordId: userData.id,
                username: userData.username,
                email: userData.email,
                discordAvatar: userData.avatar,
                roles: userRoles,
                discordRoles: guildMember?.roles || []
            });
            console.log('Yeni kullanıcı oluşturuldu:', user.username);
        } else {
            console.log('Mevcut kullanıcı güncelleniyor:', user.username);
            user.username = userData.username;
            user.email = userData.email;
            user.discordAvatar = userData.avatar;
            user.roles = userRoles;
            user.discordRoles = guildMember?.roles || [];
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