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

// Kurucu ID'leri
const FOUNDER_IDS = ['1246506868977696811', '1245436966972031069', '1112945015132536943'];

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
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Discord API'den sunucu üye bilgilerini al
        const guildMemberResponse = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${profile.id}`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
            }
        });
        
        const guildMember = await guildMemberResponse.json();
        console.log('Sunucu üye bilgileri:', guildMember);

        // Rolleri belirle
        let userRoles = ['user'];
        
        // Kurucu kontrolü
        if (FOUNDER_IDS.includes(profile.id)) {
            userRoles.push('founder');
        }

        // Admin rolü kontrolü
        if (guildMember.roles && guildMember.roles.includes(DISCORD_ROLES.ADMIN)) {
            userRoles.push('admin');
        }

        // Discord avatar URL'ini oluştur
        let avatarUrl;
        if (profile.avatar) {
            const format = profile.avatar.startsWith('a_') ? 'gif' : 'png';
            avatarUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
        } else {
            avatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(profile.discriminator) % 5}.png`;
        }

        let user = await User.findOne({ discordId: profile.id });
        
        if (!user) {
            console.log('Yeni kullanıcı oluşturuluyor...');
            user = await User.create({
                discordId: profile.id,
                username: profile.username,
                email: profile.email,
                avatarUrl: avatarUrl,
                roles: userRoles,
                discordRoles: guildMember.roles || []
            });
            console.log('Yeni kullanıcı oluşturuldu:', user.username);
        } else {
            console.log('Mevcut kullanıcı güncelleniyor:', user.username);
            user.username = profile.username;
            user.email = profile.email;
            user.avatarUrl = avatarUrl;
            user.roles = userRoles;
            user.discordRoles = guildMember.roles || [];
            await user.save();
            console.log('Kullanıcı güncellendi:', user.username);
            console.log('Discord rolleri:', user.discordRoles);
        }
        
        return done(null, user);
    } catch (error) {
        console.error('Discord authentication hatası:', error);
        return done(error, null);
    }
}));

module.exports = passport; 