const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Bu sayfayı görüntülemek için giriş yapmalısınız');
    res.redirect('/auth/login');
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
    if (!req.isAuthenticated()) {
        req.flash('error', 'Bu sayfayı görüntülemek için giriş yapmalısınız');
        return res.redirect('/auth/login');
    }

    if (!req.user.roles.includes('admin') && !req.user.roles.includes('founder')) {
        req.flash('error', 'Bu sayfaya erişim yetkiniz yok');
        return res.redirect('/');
    }

    next();
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

const isFounder = (req, res, next) => {
    if (req.isAuthenticated() && req.user.roles.includes('founder')) {
        return next();
    }
    req.flash('error', 'Bu sayfaya erişim yetkiniz yok');
    res.redirect('/');
};

module.exports = {
    isAuthenticated,
    isNotBanned,
    isAdmin,
    isGuide,
    isUploader,
    isFounder
}; 