require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// View engine ayarı
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Sadece ana sayfa rotası
app.get('/', (req, res) => {
    res.render('index');
});

// Port dinleme
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
}); 