const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { isAuthenticated, isNotBanned } = require('../middleware/auth');

// Yorum ekle
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { content, animeId } = req.body;

        // Boş yorum kontrolü
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Yorum boş olamaz' });
        }

        const comment = new Comment({
            user: req.user._id,
            anime: animeId,
            content: content.trim()
        });

        await comment.save();
        
        // Yorumu kullanıcı bilgileriyle birlikte getir
        const populatedComment = await Comment.findById(comment._id)
            .populate('user', 'username avatar roles');

        res.redirect(`/anime/${animeId}#comments`);
    } catch (error) {
        console.error('Yorum ekleme hatası:', error);
        res.status(500).json({ error: 'Yorum eklenirken bir hata oluştu' });
    }
});

// Yorum sil
router.delete('/:commentId', isAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId)
            .populate('user', 'username');

        if (!comment) {
            return res.status(404).json({ error: 'Yorum bulunamadı' });
        }

        // Yetki kontrolü
        if (comment.user._id.toString() !== req.user.id && 
            !req.user.roles.includes('admin') && 
            !req.user.roles.includes('founder')) {
            return res.status(403).json({ error: 'Bu yorumu silme yetkiniz yok' });
        }

        await comment.deleteOne();
        res.json({ success: true });
    } catch (error) {
        console.error('Yorum silme hatası:', error);
        res.status(500).json({ error: 'Yorum silinirken bir hata oluştu' });
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