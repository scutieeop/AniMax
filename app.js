require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const path = require('path');
const cron = require('node-cron');
const { exec } = require('child_process');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

// Environment değişkenlerini kontrol et
if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_CALLBACK_URL) {
    console.error('Discord OAuth2 ayarları eksik!');
    process.exit(1);
}

const app = express();

// Session ayarları
app.use(session({
    secret: process.env.SESSION_SECRET || 'gizli-anahtar',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60 // 14 gün
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 14 * 24 * 60 * 60 * 1000 // 14 gün
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Bağlantısı
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB bağlantısı başarılı'))
    .catch(err => console.error('MongoDB bağlantı hatası:', err));

// Middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Kullanıcı bilgilerini ve path'i tüm şablonlara gönder
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.path = req.path;
    next();
});

// Anime detay sayfası için özel middleware
app.get('/anime/:id', async (req, res) => {
    try {
        const anime = await Anime.findById(req.params.id);

        if (!anime) {
            return res.status(404).render('error', { message: 'Anime bulunamadı' });
        }

        // Görüntülenme sayısını artır
        anime.viewCount = (anime.viewCount || 0) + 1;
        await anime.save();

        // Yorumları getir
        const comments = await Comment.find({ 
            anime: anime._id,
            isDeleted: { $ne: true }
        })
        .populate('user')
        .sort({ createdAt: -1 });

        // Ortalama puanı hesapla
        const ratings = comments.map(comment => comment.rating);
        const averageRating = ratings.length > 0 
            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
            : '0.0';

        // Benzer animeleri getir
        const similarAnimes = await Anime.find({
            _id: { $ne: anime._id },
            genres: { $in: anime.genres }
        })
        .limit(5);

        res.render('anime-detail', {
            anime,
            comments,
            averageRating,
            similarAnimes,
            user: req.user
        });
    } catch (error) {
        console.error('Anime detay sayfası yüklenirken hata:', error);
        res.status(500).render('error', { message: 'Bir hata oluştu' });
    }
});

// Model tanımlamaları
const Anime = require('./models/Anime');
const Comment = require('./models/Comment');
const Episode = require('./models/Episode');

// Rotalar
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/comments', require('./routes/comments'));
app.use('/profile', require('./routes/profile'));
app.use('/video', require('./routes/video'));

// DevTools engelleme sayfası
app.get('/devtools-blocked', (req, res) => {
    res.render('devtools-blocked', {
        message: 'Geliştirici Araçları Kullanımı Yasak',
        path: req.path
    });
});

// 404 sayfası
app.use((req, res) => {
    res.status(404).render('error', { 
        message: 'Sayfa bulunamadı',
        path: req.path 
    });
});

// Hata yakalama
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: 'Bir hata oluştu',
        path: req.path 
    });
});

// Her 10 dakikada bir migrate-seasons.js'i çalıştır
cron.schedule('*/10 * * * *', () => {
    console.log('10 dakikalık migrasyon başlatılıyor...');
    exec('node migrate-seasons.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Migrasyon hatası: ${error}`);
            return;
        }
        console.log(`Migrasyon çıktısı: ${stdout}`);
        if (stderr) {
            console.error(`Migrasyon hata çıktısı: ${stderr}`);
        }
    });
});

// Proje başladığında ilk çalıştırma
console.log('Başlangıç migrasyonu başlatılıyor...');
exec('node migrate-seasons.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`Başlangıç migrasyon hatası: ${error}`);
        return;
    }
    console.log(`Başlangıç migrasyon çıktısı: ${stdout}`);
    if (stderr) {
        console.error(`Başlangıç migrasyon hata çıktısı: ${stderr}`);
    }
});

// Discord Bot ayarları
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Bot hazır olduğunda
client.once('ready', () => {
    console.log(`Discord Bot ${client.user.tag} olarak giriş yaptı!`);
    
    // Bot durumunu ayarla
    client.user.setPresence({
        activities: [{ 
            name: 'AniMax Anime',
            type: ActivityType.Watching
        }],
        status: 'online'
    });
});

// Mesaj komutlarını dinle
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'anime':
            try {
                const searchTerm = args.join(' ');
                if (!searchTerm) {
                    return message.reply('Lütfen bir anime adı belirtin. Örnek: !anime Naruto');
                }

                await message.channel.sendTyping();

                const animes = await Anime.find({
                    name: { 
                        $regex: searchTerm, 
                        $options: 'i'
                    }
                })
                .select('name imageUrl viewCount')
                .limit(5);

                if (animes.length === 0) {
                    return message.reply('Anime bulunamadı.');
                }

                const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
                const animeList = animes.map(anime => {
                    const animeUrl = `${siteUrl}/anime/${anime._id}`;
                    return `**${anime.name}** (${anime.viewCount || 0} görüntülenme)\n🔗 ${animeUrl}\n`;
                }).join('\n');

                message.reply({
                    embeds: [{
                        title: `"${searchTerm}" için bulunan animeler:`,
                        description: animeList,
                        color: 0x3b82f6,
                        footer: {
                            text: `${animes.length} anime bulundu • AniMax`
                        }
                    }]
                });
            } catch (error) {
                console.error('Anime arama hatası:', error);
                message.reply('Bir hata oluştu.');
            }
            break;

        case 'yenibölümler':
        case 'yeni':
            try {
                await message.channel.sendTyping();

                // Son 24 saat içinde eklenen bölümleri getir
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const newEpisodes = await Episode.find({
                    createdAt: { $gte: oneDayAgo }
                })
                .populate('anime', 'name')
                .sort('-createdAt')
                .limit(10);

                if (newEpisodes.length === 0) {
                    return message.reply('Son 24 saat içinde eklenen yeni bölüm bulunmuyor.');
                }

                const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
                const episodeList = newEpisodes.map(episode => {
                    const animeUrl = `${siteUrl}/anime/${episode.anime._id}`;
                    return `**${episode.anime.name}** - Sezon ${episode.season}, Bölüm ${episode.episodeNumber}\n🔗 ${animeUrl}\n`;
                }).join('\n');

                message.reply({
                    embeds: [{
                        title: '🆕 Son Eklenen Bölümler',
                        description: episodeList,
                        color: 0x3b82f6,
                        footer: {
                            text: `Son 24 saat • AniMax`
                        }
                    }]
                });
            } catch (error) {
                console.error('Yeni bölümler hatası:', error);
                message.reply('Bir hata oluştu.');
            }
            break;

        case 'top':
        case 'popüler':
            try {
                await message.channel.sendTyping();

                const topAnimes = await Anime.find()
                    .select('name viewCount')
                    .sort('-viewCount')
                    .limit(10);

                const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
                const topList = topAnimes.map((anime, index) => {
                    const animeUrl = `${siteUrl}/anime/${anime._id}`;
                    return `**${index + 1}.** ${anime.name} (${anime.viewCount || 0} görüntülenme)\n🔗 ${animeUrl}\n`;
                }).join('\n');

                message.reply({
                    embeds: [{
                        title: '🏆 En Çok İzlenen Animeler',
                        description: topList,
                        color: 0x3b82f6,
                        footer: {
                            text: 'Top 10 • AniMax'
                        }
                    }]
                });
            } catch (error) {
                console.error('Top anime hatası:', error);
                message.reply('Bir hata oluştu.');
            }
            break;

        case 'sıfırla':
            try {
                // Kurucu ID'sini kontrol et
                const FOUNDER_ID = process.env.DISCORD_FOUNDER_ID; // .env'den kurucu ID'sini al
                if (message.author.id !== FOUNDER_ID) {
                    return message.reply('Bu komutu sadece kurucu kullanabilir!');
                }

                const animeId = args[0];
                if (!animeId) {
                    return message.reply('Lütfen bir anime ID\'si belirtin. Örnek: !sıfırla <anime_id>');
                }

                const anime = await Anime.findById(animeId);
                if (!anime) {
                    return message.reply('Belirtilen ID\'ye sahip anime bulunamadı.');
                }

                // Görüntülenme sayısını sıfırla
                anime.viewCount = 0;
                await anime.save();

                message.reply({
                    embeds: [{
                        title: '✅ Görüntülenme Sıfırlandı',
                        description: `**${anime.name}** animesinin görüntülenme sayısı başarıyla sıfırlandı.`,
                        color: 0x00ff00,
                        footer: {
                            text: `İşlemi Yapan: ${message.author.tag}`
                        },
                        timestamp: new Date()
                    }]
                });
            } catch (error) {
                console.error('Görüntülenme sıfırlama hatası:', error);
                message.reply('Bir hata oluştu.');
            }
            break;

        case 'yardım':
            message.reply({
                embeds: [{
                    title: 'AniMax Bot Komutları',
                    description: 'Kullanılabilir komutların listesi:',
                    fields: [
                        { name: '!anime <isim>', value: 'Belirtilen anime adına benzer animeleri listeler' },
                        { name: '!yeni', value: 'Son 24 saat içinde eklenen yeni bölümleri listeler' },
                        { name: '!top', value: 'En çok izlenen 10 animeyi listeler' },
                        { name: '!sıfırla <anime_id>', value: 'Belirtilen animenin görüntülenme sayısını sıfırlar (Sadece Kurucu)' },
                        { name: '!yardım', value: 'Bu yardım mesajını gösterir' }
                    ],
                    color: 0x3b82f6,
                    footer: {
                        text: 'AniMax Bot • v1.0'
                    }
                }]
            });
            break;
    }
});

// Hata yakalama
client.on('error', error => {
    console.error('Discord Bot hatası:', error);
});

// Discord Bot'u başlat
client.login(process.env.DISCORD_BOT_TOKEN)
    .then(() => console.log('Discord Bot başlatılıyor...'))
    .catch(error => console.error('Discord Bot başlatma hatası:', error));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
}); 
