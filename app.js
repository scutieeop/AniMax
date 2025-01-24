require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const path = require('path');
const cron = require('node-cron');
const { exec } = require('child_process');

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
}); 