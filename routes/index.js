const express = require('express');
const router = express.Router();
const Anime = require('../models/Anime');
const Comment = require('../models/Comment');
const { isAuthenticated } = require('../middleware/auth');
const User = require('../models/User');

// Ana sayfa
router.get('/', async (req, res) => {
    try {
        // Popüler animeleri getir
        const popularAnimes = await Anime.find()
            .sort({ viewCount: -1 })
            .limit(10);

        // Son eklenen animeleri getir
        const recentAnimes = await Anime.find()
            .sort({ createdAt: -1 })
            .limit(10);

        res.render('index', {
            popularAnimes,
            recentAnimes,
            user: req.user
        });
    } catch (error) {
        console.error('Ana sayfa yüklenirken hata:', error);
        res.status(500).render('error', { message: 'Bir hata oluştu' });
    }
});

// Anime detay sayfası
router.get('/anime/:id', async (req, res) => {
    try {
        const anime = await Anime.findById(req.params.id);
        if (!anime) {
            return res.status(404).render('error', { message: 'Anime bulunamadı' });
        }

        // Görüntülenme sayısını artır
        anime.viewCount = (anime.viewCount || 0) + 1;
        await anime.save();

        // Yorumları getir ve kullanıcı bilgilerini populate et
        const comments = await Comment.find({ 
            anime: anime._id,
            isDeleted: false 
        }).populate({
            path: 'user',
            select: 'username avatar discordAvatar discordId roles'
        }).sort('-createdAt');

        // Kullanıcının favorilerini kontrol et
        let isFavorite = false;
        if (req.user) {
            const userWithFavorites = await User.findById(req.user._id).select('favorites');
            isFavorite = userWithFavorites.favorites.includes(anime._id);
        }

        // Ortalama puanı hesapla
        const ratings = comments.map(comment => comment.rating);
        const averageRating = ratings.length > 0 
            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
            : '0.0';

        // Benzer animeleri getir (aynı türden, kendisi hariç)
        const similarAnimes = await Anime.find({
            _id: { $ne: anime._id },
            genres: { $in: anime.genres }
        })
        .limit(5);

        // Seçili bölümü bul
        let selectedEpisode = null;
        let selectedSeason = null;

        // URL'den sezon ve bölüm numaralarını al
        const seasonNumber = parseInt(req.query.season) || 1;
        const episodeNumber = parseInt(req.query.episode) || 1;

        // Seçili sezonu bul
        if (anime.seasons && anime.seasons.length > 0) {
            selectedSeason = anime.seasons.find(s => s.seasonNumber === seasonNumber) || anime.seasons[0];
            
            // Seçili bölümü bul
            if (selectedSeason.episodes && selectedSeason.episodes.length > 0) {
                selectedEpisode = selectedSeason.episodes.find(e => e.episodeNumber === episodeNumber) || selectedSeason.episodes[0];
            }
        }

        res.render('anime-detail', { 
            anime,
            comments,
            averageRating,
            similarAnimes,
            isFavorite,
            episode: selectedEpisode,
            season: selectedSeason,
            currentSeason: seasonNumber,
            currentEpisode: episodeNumber
        });
    } catch (error) {
        console.error('Anime detay sayfası hatası:', error);
        res.status(500).render('error', { message: 'Bir hata oluştu' });
    }
});

// Yorum ekle
router.post('/anime/:id/comment', isAuthenticated, async (req, res) => {
    try {
        const { content, rating, isSpoiler } = req.body;
        const animeId = req.params.id;

        const comment = new Comment({
            user: req.user._id,
            anime: animeId,
            content,
            rating: parseInt(rating),
            isSpoiler: isSpoiler === 'true'
        });

        await comment.save();
        res.redirect(`/anime/${animeId}#comments`);
    } catch (error) {
        console.error('Yorum eklenirken hata:', error);
        res.status(500).render('error', { message: 'Yorum eklenirken bir hata oluştu' });
    }
});

// Yorum sil
router.post('/api/comments/delete/:id', isAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            req.flash('error', 'Yorum bulunamadı');
            return res.redirect('back');
        }

        // Sadece admin, founder veya yorumun sahibi silebilir
        if (!(req.user.roles.includes('admin') || 
            req.user.roles.includes('founder') || 
            comment.user.equals(req.user._id))) {
            req.flash('error', 'Bu işlem için yetkiniz yok');
            return res.redirect('back');
        }

        comment.isDeleted = true;
        comment.deletedBy = req.user._id;
        comment.deletedAt = new Date();
        await comment.save();

        req.flash('success', 'Yorum başarıyla silindi');
        res.redirect('back');
    } catch (error) {
        console.error('Yorum silme hatası:', error);
        req.flash('error', 'Yorum silinirken bir hata oluştu');
        res.redirect('back');
    }
});

// Popüler animeler sayfası
router.get('/populer', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const animes = await Anime.find()
            .sort({ viewCount: -1 })
            .skip(skip)
            .limit(limit);

        const totalAnimes = await Anime.countDocuments();
        const totalPages = Math.ceil(totalAnimes / limit);

        res.render('populer', {
            animes,
            currentPage: page,
            totalPages,
            user: req.user
        });
    } catch (error) {
        console.error('Popüler animeler sayfası yüklenirken hata:', error);
        res.status(500).render('error', { message: 'Bir hata oluştu' });
    }
});

// Animeler sayfası
router.get('/animeler', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const animes = await Anime.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalAnimes = await Anime.countDocuments();
        const totalPages = Math.ceil(totalAnimes / limit);

        res.render('animeler', { 
            user: req.user,
            animes: animes,
            currentPage: page,
            totalPages,
            title: 'Tüm Animeler'
        });
    } catch (error) {
        console.error('Anime listesi getirme hatası:', error);
        res.status(500).render('error', { 
            message: 'Animeler yüklenirken bir hata oluştu' 
        });
    }
});

// Anime arama API'si
router.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        const animes = await Anime.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } },
                { genres: { $regex: query, $options: 'i' } }
            ]
        })
        .select('name imageUrl')
        .limit(5);

        const results = animes.map(anime => ({
            id: anime._id,
            name: anime.name,
            imageUrl: anime.imageUrl
        }));

        res.json(results);
    } catch (error) {
        console.error('Arama hatası:', error);
        res.status(500).json({ error: 'Arama sırasında bir hata oluştu' });
    }
});

// Keşfet sayfası
router.get('/kesfet', async (req, res) => {
    try {
        const animes = await Anime.find().sort({ createdAt: -1 });
        res.render('animeler', { 
            user: req.user,
            animes: animes,
            title: 'Keşfet'
        });
    } catch (error) {
        console.error('Anime listesi getirme hatası:', error);
        res.status(500).render('error', { 
            message: 'Animeler yüklenirken bir hata oluştu' 
        });
    }
});

// Yeni eklenen animeler sayfası
router.get('/yeni', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const animes = await Anime.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalAnimes = await Anime.countDocuments();
        const totalPages = Math.ceil(totalAnimes / limit);

        res.render('yeni', { 
            user: req.user,
            animes: animes,
            currentPage: page,
            totalPages,
            title: 'Yeni Eklenen Animeler'
        });
    } catch (error) {
        console.error('Yeni animeler sayfası yüklenirken hata:', error);
        res.status(500).render('error', { 
            message: 'Animeler yüklenirken bir hata oluştu' 
        });
    }
});

// Yeni eklenen bölümler sayfası
router.get('/yenibolumler', async (req, res) => {
    try {
        // Son 24 saat içinde eklenen bölümleri bul
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const animes = await Anime.aggregate([
            // Her animenin episodes dizisini aç
            { $unwind: '$episodes' },
            
            // Son 24 saat içinde eklenen bölümleri filtrele
            {
                $match: {
                    'episodes.addedDate': { $gte: oneDayAgo }
                }
            },
            
            // Bölüm bilgilerini grupla
            {
                $group: {
                    _id: {
                        animeId: '$_id',
                        animeName: '$name',
                        imageUrl: '$imageUrl'
                    },
                    episodes: {
                        $push: {
                            season: '$episodes.season',
                            episodeNumber: '$episodes.episodeNumber',
                            addedDate: '$episodes.addedDate',
                            videoUrl: '$episodes.videoUrl'
                        }
                    }
                }
            },
            
            // Sonuçları ekleme tarihine göre sırala
            { $sort: { 'episodes.addedDate': -1 } }
        ]);

        res.render('yenibolumler', {
            title: 'Yeni Eklenen Bölümler',
            user: req.user,
            animes: animes
        });
    } catch (error) {
        console.error('Yeni bölümler getirme hatası:', error);
        res.status(500).render('error', {
            message: 'Yeni bölümler yüklenirken bir hata oluştu'
        });
    }
});

// Video stream route'u
router.get('/api/video/:episodeId', isAuthenticated, async (req, res) => {
    try {
        const anime = await Anime.findOne({
            'seasons.episodes._id': req.params.episodeId
        });

        if (!anime) {
            return res.status(404).send('Bölüm bulunamadı');
        }

        // Bölümü bul
        const episode = anime.seasons
            .flatMap(season => season.episodes)
            .find(ep => ep._id.toString() === req.params.episodeId);

        if (!episode) {
            return res.status(404).send('Bölüm bulunamadı');
        }

        // Video URL'ini al ve yönlendir
        res.redirect(episode.videoUrl);
    } catch (error) {
        console.error('Video stream hatası:', error);
        res.status(500).send('Video yüklenirken bir hata oluştu');
    }
});

module.exports = router; 