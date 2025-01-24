require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Debug için environment değişkenlerini kontrol et
console.log('Bot Config Yükleniyor:', {
    guildId: process.env.DISCORD_GUILD_ID,
    botToken: process.env.DISCORD_BOT_TOKEN ? 'Mevcut' : 'Eksik'
});

// Bot'u başlat
client.login(process.env.DISCORD_BOT_TOKEN)
    .then(() => console.log(`Bot ${client.user.tag} olarak giriş yaptı`))
    .catch(err => console.error('Bot giriş hatası:', err));

module.exports = client; 