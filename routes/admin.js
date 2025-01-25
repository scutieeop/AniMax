const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');

// Admin paneli ana sayfası
router.get('/', isAdmin, async (req, res) => {
    try {
        // Kullanıcı istatistiklerini getir
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ roles: 'admin' });
        const founderUsers = await User.countDocuments({ roles: 'founder' });

        res.render('admin/dashboard', { 
            stats: {
                totalUsers,
                adminUsers,
                founderUsers
            }
        });
    } catch (error) {
        console.error('Admin paneli yüklenirken hata:', error);
        req.flash('error', 'Bir hata oluştu');
        res.redirect('/');
    }
});

// Kullanıcı yönetimi sayfası
router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.render('admin/users', { users });
    } catch (error) {
        console.error('Kullanıcılar getirilirken hata:', error);
        req.flash('error', 'Kullanıcılar getirilirken bir hata oluştu');
        res.redirect('/admin');
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