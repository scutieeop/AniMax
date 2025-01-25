const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { isAuthenticated, isNotBanned } = require('../middleware/auth');

// Yorum ekle
router.post('/add', isAuthenticated, isNotBanned, async (req, res) => {
    try {
        const { animeId, content, rating } = req.body;

        // Boş yorum kontrolü
        if (!content || content.trim().length === 0) {
            req.flash('error', 'Yorum boş olamaz');
            return res.redirect('back');
        }

        // Rating kontrolü
        const ratingNum = parseInt(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            req.flash('error', 'Geçerli bir puan vermelisiniz (1-5)');
            return res.redirect('back');
        }

        // Kullanıcının daha önce yorum yapıp yapmadığını kontrol et
        const existingComment = await Comment.findOne({
            user: req.user._id,
            anime: animeId,
            isDeleted: false
        });

        if (existingComment) {
            req.flash('error', 'Bu anime için zaten bir yorum yapmışsınız');
            return res.redirect('back');
        }

        // Yeni yorum oluştur
        const comment = await Comment.create({
            user: req.user._id,
            anime: animeId,
            content: content.trim(),
            rating: ratingNum
        });

        req.flash('success', 'Yorumunuz başarıyla eklendi');
        res.redirect('back');
    } catch (error) {
        console.error('Yorum eklenirken hata:', error);
        req.flash('error', 'Yorum eklenirken bir hata oluştu');
        res.redirect('back');
    }
});

// Yorum sil
router.post('/delete/:id', isAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            req.flash('error', 'Yorum bulunamadı');
            return res.redirect('back');
        }

        // Silme yetkisi kontrolü
        if (!comment.canDelete(req.user)) {
            req.flash('error', 'Bu yorumu silme yetkiniz yok');
            return res.redirect('back');
        }

        // Yorumu silindi olarak işaretle
        await Comment.findByIdAndUpdate(comment._id, { isDeleted: true });
        
        req.flash('success', 'Yorum başarıyla silindi');
        res.redirect('back');
    } catch (error) {
        console.error('Yorum silinirken hata:', error);
        req.flash('error', 'Yorum silinirken bir hata oluştu');
        res.redirect('back');
    }
});

// Yorumu beğen/beğenmekten vazgeç
router.post('/:id/like', isAuthenticated, isNotBanned, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            return res.status(404).json({ error: 'Yorum bulunamadı' });
        }

        const userIndex = comment.likes.indexOf(req.user._id);
        
        if (userIndex === -1) {
            // Yorumu beğen
            comment.likes.push(req.user._id);
        } else {
            // Beğeniyi kaldır
            comment.likes.splice(userIndex, 1);
        }

        await comment.save();
        
        res.json({ 
            success: true, 
            liked: userIndex === -1,
            likeCount: comment.likes.length 
        });
    } catch (error) {
        console.error('Beğeni işlemi sırasında hata:', error);
        res.status(500).json({ error: 'Beğeni işlemi sırasında bir hata oluştu' });
    }
});

// Anime yorumlarını getir
router.get('/:animeId', async (req, res) => {
    try {
        const comments = await Comment.find({ anime: req.params.animeId })
            .populate('user', 'username avatar roles')
            .sort('-createdAt');
        
        res.json(comments);
    } catch (error) {
        console.error('Yorumları getirme hatası:', error);
        res.status(500).json({ error: 'Yorumlar getirilirken bir hata oluştu' });
    }
});

module.exports = router; 