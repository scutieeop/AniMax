const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Anime = require('../models/Anime');
const { isAuthenticated } = require('../middleware/auth');

// Kendi profil sayfası
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('favorites');
        res.render('profile', { 
            user: user,
            profileUser: user,
            isOwnProfile: true
        });
    } catch (error) {
        console.error('Profil sayfası hatası:', error);
        res.status(500).render('error', { message: 'Profil yüklenirken bir hata oluştu' });
    }
});

// Başka kullanıcının profil sayfası (Discord ID ile)
router.get('/:discordId', async (req, res) => {
    try {
        const profileUser = await User.findOne({ discordId: req.params.discordId })
            .populate('favorites');

        if (!profileUser) {
            return res.status(404).render('error', { 
                message: 'Kullanıcı bulunamadı',
                path: req.path 
            });
        }

        res.render('profile', {
            user: req.user, // Giriş yapmış kullanıcı
            profileUser: profileUser, // Profili görüntülenen kullanıcı
            isOwnProfile: req.user && req.user.id === profileUser.id
        });
    } catch (error) {
        console.error('Profil sayfası yüklenirken hata:', error);
        res.status(500).render('error', { message: 'Profil yüklenirken bir hata oluştu' });
    }
});

// Favoriler sayfası
router.get('/favorites', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('favorites');
        res.render('favorites', { 
            user: user,
            favorites: user.favorites || []
        });
    } catch (error) {
        console.error('Favoriler sayfası hatası:', error);
        res.status(500).render('error', { message: 'Favoriler yüklenirken bir hata oluştu' });
    }
});

// Favorilere anime ekleme/çıkarma
router.post('/favorites/:animeId', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const animeId = req.params.animeId;

        const favoriteIndex = user.favorites.indexOf(animeId);
        
        if (favoriteIndex === -1) {
            // Favorilere ekle
            user.favorites.push(animeId);
            await user.save();
            res.json({ success: true, isFavorite: true });
        } else {
            // Favorilerden çıkar
            user.favorites.splice(favoriteIndex, 1);
            await user.save();
            res.json({ success: true, isFavorite: false });
        }
    } catch (error) {
        console.error('Favori işlemi hatası:', error);
        res.status(500).json({ success: false, error: 'Favori işlemi başarısız oldu' });
    }
});

module.exports = router; 