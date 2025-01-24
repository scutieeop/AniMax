const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');
const config = require('./discord-config');

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
    clientID: config.clientId,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: config.callbackUrl,
    scope: ['identify', 'email', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Discord Profile:', profile); // Debug için profil bilgilerini logla
        
        let user = await User.findOne({ discordId: profile.id });
        
        // Varsayılan roller ve rozetler
        const defaultRoles = ['user'];
        const defaultBadges = [];
        
        // Founder kontrolü
        if (config.founderIds.includes(profile.id)) {
            defaultRoles.push('founder');
            defaultBadges.push('founder');
        }
        
        // Admin rolü kontrolü
        if (config.adminRoles.some(roleId => 
            profile.guilds?.some(g => 
                g.id === config.guildId && 
                (g.permissions & 0x8) // ADMINISTRATOR permission
            )
        )) {
            defaultRoles.push('admin');
            defaultBadges.push('admin');
        }
        
        if (user) {
            // Mevcut kullanıcıyı güncelle
            user.username = profile.username;
            user.email = profile.email;
            user.avatarHash = profile.avatar;
            
            // Rolleri güncelle ama founder rolünü koru
            if (user.roles.includes('founder')) {
                user.roles = Array.from(new Set([...defaultRoles, 'founder']));
            } else {
                user.roles = defaultRoles;
            }
            
            // Rozetleri güncelle
            user.badges = defaultBadges;
            
            await user.save();
        } else {
            // Yeni kullanıcı oluştur
            user = await User.create({
                discordId: profile.id,
                username: profile.username,
                email: profile.email,
                avatarHash: profile.avatar,
                roles: defaultRoles,
                badges: defaultBadges
            });
        }
        
        return done(null, user);
    } catch (err) {
        console.error('Discord authentication error:', err);
        return done(err, null);
    }
}));

module.exports = passport; 