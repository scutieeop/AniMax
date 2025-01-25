const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');

// Admin paneli ana sayfası
router.get('/', isAdmin, async (req, res) => {
    res.redirect('/admin/users');
});

// Kullanıcı yönetimi sayfası
router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.render('admin/users', { users });
    } catch (error) {
        console.error('Kullanıcılar getirilirken hata:', error);
        res.status(500).send('Bir hata oluştu');
    }
});

// Kullanıcı rollerini güncelle
router.post('/users/update-roles', isAdmin, async (req, res) => {
    try {
        const { userId, roles } = req.body;
        
        // roles dizisi gönderilmediyse boş dizi kullan
        const newRoles = Array.isArray(roles) ? roles : [];
        
        // 'user' rolü her zaman olmalı
        if (!newRoles.includes('user')) {
            newRoles.push('user');
        }

        await User.findByIdAndUpdate(userId, { roles: newRoles });
        
        req.flash('success', 'Kullanıcı rolleri güncellendi');
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Roller güncellenirken hata:', error);
        req.flash('error', 'Roller güncellenirken bir hata oluştu');
        res.redirect('/admin/users');
    }
});

module.exports = router; 