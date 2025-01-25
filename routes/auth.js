const express = require('express');
const router = express.Router();
const passport = require('passport');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const User = require('../models/User');

// Discord login route'u
router.get('/discord', passport.authenticate('discord', {
    scope: ['identify', 'email'],
    prompt: 'consent'
}));

// Discord callback route'u
router.get('/discord/callback',
    (req, res, next) => {
        passport.authenticate('discord', (err, user, info) => {
            if (err) {
                console.error('Discord auth hatası:', err);
                return res.redirect('/auth/error?message=' + encodeURIComponent('Discord girişi başarısız oldu'));
            }
            
            if (!user) {
                console.error('Kullanıcı bulunamadı:', info);
                return res.redirect('/auth/error?message=' + encodeURIComponent('Kullanıcı bilgileri alınamadı'));
            }

            req.logIn(user, (err) => {
                if (err) {
                    console.error('Login hatası:', err);
                    return res.redirect('/auth/error?message=' + encodeURIComponent('Giriş yapılırken bir hata oluştu'));
                }
                
                console.log('Başarılı giriş:', user.username);
                return res.redirect('/');
            });
        })(req, res, next);
    }
);

// Hata sayfası route'u
router.get('/error', (req, res) => {
    res.render('error', {
        message: req.query.message || 'Bir hata oluştu',
        path: req.path
    });
});

// Çıkış route'u
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Çıkış hatası:', err);
            return res.redirect('/auth/error?message=' + encodeURIComponent('Çıkış yapılırken bir hata oluştu'));
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