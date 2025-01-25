const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { isAuthenticated, isNotBanned } = require('../middleware/auth');

// Yorum ekle
router.post('/add', isAuthenticated, async (req, res) => {
    try {
        const { animeId, content, rating } = req.body;
        
        const comment = await Comment.create({
            user: req.user._id,
            anime: animeId,
            content,
            rating: parseInt(rating)
        });

        req.flash('success', 'Yorumunuz eklendi');
        res.redirect(`/anime/${animeId}`);
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

        if (comment.user.toString() !== req.user._id.toString() && !req.user.roles.includes('admin')) {
            req.flash('error', 'Bu yorumu silme yetkiniz yok');
            return res.redirect('back');
        }

        await Comment.findByIdAndUpdate(comment._id, { isDeleted: true });
        
        req.flash('success', 'Yorum silindi');
        res.redirect('back');
    } catch (error) {
        console.error('Yorum silinirken hata:', error);
        req.flash('error', 'Yorum silinirken bir hata oluştu');
        res.redirect('back');
    }
});

// Yorumu beğen/beğenmekten vazgeç
router.post('/:commentId/like', isAuthenticated, isNotBanned, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        
        if (!comment) {
            return res.status(404).json({ error: 'Yorum bulunamadı' });
        }

        const userIndex = comment.likes.indexOf(req.user._id);
        
        if (userIndex === -1) {
            comment.likes.push(req.user._id);
        } else {
            comment.likes.splice(userIndex, 1);
        }

        await comment.save();
        
        res.json({ 
            success: true, 
            liked: userIndex === -1,
            likeCount: comment.likes.length 
        });
    } catch (err) {
        res.status(500).json({ error: 'İşlem sırasında bir hata oluştu' });
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