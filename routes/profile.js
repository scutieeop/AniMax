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

// Profil sayfası
router.get('/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        
        if (!user) {
            req.flash('error', 'Kullanıcı bulunamadı');
            return res.redirect('/');
        }

        res.render('profile', { profileUser: user });
    } catch (error) {
        console.error('Profil sayfası yüklenirken hata:', error);
        req.flash('error', 'Bir hata oluştu');
        res.redirect('/');
    }
});

// Profil düzenleme sayfası
router.get('/:username/edit', isAuthenticated, async (req, res) => {
    try {
        // Sadece kendi profilini düzenleyebilir
        if (req.params.username !== req.user.username) {
            req.flash('error', 'Başka bir kullanıcının profilini düzenleyemezsiniz');
            return res.redirect('/');
        }

        res.render('profile-edit', { user: req.user });
    } catch (error) {
        console.error('Profil düzenleme sayfası yüklenirken hata:', error);
        req.flash('error', 'Bir hata oluştu');
        res.redirect('/');
    }
});

// Profil güncelleme
router.post('/:username/update', isAuthenticated, async (req, res) => {
    try {
        // Sadece kendi profilini güncelleyebilir
        if (req.params.username !== req.user.username) {
            req.flash('error', 'Başka bir kullanıcının profilini güncelleyemezsiniz');
            return res.redirect('/');
        }

        const { email, avatar } = req.body;
        
        await User.findByIdAndUpdate(req.user._id, {
            email,
            avatar
        });

        req.flash('success', 'Profiliniz güncellendi');
        res.redirect(`/profile/${req.user.username}`);
    } catch (error) {
        console.error('Profil güncellenirken hata:', error);
        req.flash('error', 'Profil güncellenirken bir hata oluştu');
        res.redirect('back');
    }
});

module.exports = router; 