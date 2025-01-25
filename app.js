require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const path = require('path');
const cron = require('node-cron');
const { exec } = require('child_process');
const redis = require('redis');

// Redis istemcisi oluştur
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Redis bağlantısı başarılı'));

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

// Sezon migrasyonu için yardımcı fonksiyon
async function migrateSeasons() {
    try {
        console.log('Sezon migrasyonu başlatılıyor...');
        const animes = await Anime.find({}).lean();
        let updatedCount = 0;
        let processedCount = 0;
        const batchSize = 10; // Her seferde işlenecek anime sayısı
        
        // Animeyi gruplar halinde işle
        for (let i = 0; i < animes.length; i += batchSize) {
            const batch = animes.slice(i, i + batchSize);
            const promises = batch.map(async (anime) => {
                if (!anime.episodes) return;

                // Sezonları grupla
                const seasonMap = new Map();
                
                anime.episodes.forEach(episode => {
                    if (!seasonMap.has(episode.season)) {
                        seasonMap.set(episode.season, []);
                    }
                    seasonMap.get(episode.season).push({
                        name: `Bölüm ${episode.episodeNumber}`,
                        episodeNumber: episode.episodeNumber,
                        videoUrl: episode.videoUrl,
                        duration: '24:00',
                        _id: episode._id
                    });
                });

                // Yeni sezon yapısını oluştur
                const seasons = Array.from(seasonMap.entries()).map(([seasonNumber, episodes]) => ({
                    seasonNumber,
                    episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber)
                }));

                // Sıralı sezonları kaydet
                await Anime.findByIdAndUpdate(anime._id, {
                    $set: {
                        seasons: seasons.sort((a, b) => a.seasonNumber - b.seasonNumber)
                    }
                }, { new: true });

                updatedCount++;
                processedCount++;
                
                if (processedCount % 5 === 0) {
                    console.log(`İşlenen anime: ${processedCount}/${animes.length}`);
                }
            });

            // Her grubu paralel olarak işle
            await Promise.all(promises);
            
            // Her grup arasında kısa bir bekleme süresi
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`Migrasyon tamamlandı! ${updatedCount} anime güncellendi.`);
        console.log('Bir sonraki migrasyon için bekleniyor...');
    } catch (error) {
        console.error('Migrasyon hatası:', error);
    }
}

// Her 10 dakikada bir çalışacak cron job
cron.schedule('*/10 * * * *', async () => {
    const key = 'migration_running';
    const isRunning = await redisClient.get(key);
    
    if (isRunning) {
        console.log('Başka bir migrasyon zaten çalışıyor, atlanıyor...');
        return;
    }

    try {
        // Migrasyon başladığını işaretle
        await redisClient.set(key, '1', 'EX', 600); // 10 dakika süreyle kilitle
        
        console.log('Zamanlanmış migrasyon başlatılıyor...');
        await migrateSeasons();
    } catch (error) {
        console.error('Migrasyon hatası:', error);
    } finally {
        // Migrasyon kilidini kaldır
        await redisClient.del(key);
    }
});

// Proje başladığında ilk çalıştırma
console.log('Başlangıç migrasyonu başlatılıyor...');
migrateSeasons();

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
}); 