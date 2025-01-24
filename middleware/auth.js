const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/discord');
};

const isNotBanned = (req, res, next) => {
    if (req.user && !req.user.isBanned) {
        return next();
    }
    res.status(403).render('error', { 
        message: 'Hesabınız yasaklanmış durumda. Yöneticilerle iletişime geçin.' 
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && (req.user.isAdmin || req.user.isFounder)) {
        return next();
    }
    res.status(403).render('error', { 
        message: 'Bu işlem için admin yetkisine sahip olmanız gerekiyor.' 
    });
};

const isGuide = (req, res, next) => {
    if (req.user && (req.user.isGuide || req.user.isAdmin || req.user.isFounder)) {
        return next();
    }
    res.status(403).render('error', { 
        message: 'Bu işlem için rehber yetkisine sahip olmanız gerekiyor.' 
    });
};

const isUploader = (req, res, next) => {
    if (req.user && (req.user.isUploader || req.user.isAdmin || req.user.isFounder)) {
        return next();
    }
    res.status(403).render('error', { 
        message: 'Bu işlem için uploader yetkisine sahip olmanız gerekiyor.' 
    });
};

module.exports = {
    isAuthenticated,
    isNotBanned,
    isAdmin,
    isGuide,
    isUploader
}; 