const express = require('express');
const router = express.Router();
const passport = require('passport');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const User = require('../models/User');

// Discord ile giriş
router.get('/discord', passport.authenticate('discord'));

// Discord callback
router.get('/discord/callback', 
    passport.authenticate('discord', {
        failureRedirect: '/login',
        failureFlash: true
    }),
    (req, res) => {
        // Başarılı giriş sonrası ana sayfaya yönlendir
        res.redirect('/');
    }
);

// Çıkış yap
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            console.error('Çıkış yapılırken hata:', err);
            return next(err);
        }
        res.redirect('/');
    });
});

// Kullanıcı banla/ban kaldır (Admin)
router.post('/ban/:userId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        // Kurucular banlanamaz
        if (user.isFounder) {
            return res.status(403).json({ error: 'Kurucular banlanamaz' });
        }

        user.isBanned = !user.isBanned;
        await user.save();

        res.json({ 
            success: true, 
            message: user.isBanned ? 'Kullanıcı banlandı' : 'Kullanıcının banı kaldırıldı' 
        });
    } catch (err) {
        res.status(500).json({ error: 'Bir hata oluştu' });
    }
});

module.exports = router; 