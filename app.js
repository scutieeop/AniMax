require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const path = require('path');
const { startMigration } = require('./utils/migration');

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
    .then(() => {
        console.log('MongoDB bağlantısı başarılı');
        // MongoDB bağlantısı başarılı olduktan sonra migrasyonu başlat
        startMigration();
    })
    .catch(err => console.error('MongoDB bağlantı hatası:', err));

// Middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Flash mesajları için middleware
app.use(require('connect-flash')());

// Kullanıcı bilgilerini ve path'i tüm şablonlara gönder
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.path = req.path;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Model tanımlamaları
const Anime = require('./models/Anime');
const Comment = require('./models/Comment');
const Episode = require('./models/Episode');

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/api/comments', require('./routes/comments'));
app.use('/profile', require('./routes/profile'));
app.use('/video', require('./routes/video'));
app.use('/admin', require('./routes/admin'));

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

// Port dinleme
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
}); 