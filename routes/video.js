const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { isAuthenticated } = require('../middleware/auth');

// Video token'larını saklamak için geçici bir depo
const videoTokens = new Map();

// Video token'ı oluştur
router.post('/token', isAuthenticated, async (req, res) => {
    try {
        const { videoUrl, animeId, season, episode } = req.body;
        
        // Token oluştur
        const token = crypto.randomBytes(32).toString('hex');
        
        // Token bilgilerini sakla
        videoTokens.set(token, {
            videoUrl,
            animeId,
            season,
            episode,
            userId: req.user._id,
            createdAt: Date.now()
        });

        // 1 saat sonra token'ı sil
        setTimeout(() => {
            videoTokens.delete(token);
        }, 3600000);

        res.json({ token });
    } catch (error) {
        console.error('Video token oluşturma hatası:', error);
        res.status(500).json({ error: 'Video token oluşturulamadı' });
    }
});

// Video stream
router.get('/stream/:token', isAuthenticated, async (req, res) => {
    try {
        const token = req.params.token;
        const videoData = videoTokens.get(token);

        if (!videoData) {
            return res.status(404).json({ error: 'Video bulunamadı' });
        }

        // Video URL'sini doğrudan yönlendir
        res.redirect(videoData.videoUrl);
    } catch (error) {
        console.error('Video stream hatası:', error);
        res.status(500).json({ error: 'Video oynatılamadı' });
    }
});

module.exports = router; 