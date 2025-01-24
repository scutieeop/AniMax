const mongoose = require('mongoose');
const cron = require('node-cron');
require('dotenv').config();

mongoose.connect('mongodb+srv://uptrical:berkay@guildcode.nnxcj.mongodb.net/animeDB')
  .then(() => console.log('MongoDB bağlantısı başarılı'))
  .catch(err => console.error('MongoDB bağlantı hatası:', err));

const animeSchema = new mongoose.Schema({
  name: String,
  description: String,
  imageUrl: String,
  viewCount: Number,
  genres: [String],
  episodes: [{
    season: Number,
    episodeNumber: Number,
    videoUrl: String,
    _id: mongoose.Schema.Types.ObjectId
  }],
  seasons: [{
    seasonNumber: Number,
    episodes: [{
      name: String,
      episodeNumber: Number,
      videoUrl: String,
      duration: String,
      _id: mongoose.Schema.Types.ObjectId
    }]
  }]
});

const Anime = mongoose.model('Anime', animeSchema);

async function migrateData() {
  try {
    console.log('Sezon migrasyonu başlatılıyor...');
    const animes = await Anime.find({});
    let updatedCount = 0;
    
    for (const anime of animes) {
      if (!anime.episodes) continue;

      // Sezonları grupla
      const seasonMap = new Map();
      
      anime.episodes.forEach(episode => {
        if (!seasonMap.has(episode.season)) {
          seasonMap.set(episode.season, []);
        }
        seasonMap.get(episode.season).push({
          name: `Bölüm ${episode.episodeNumber}`,
          episodeNumber: episode.episodeNumber,
          videoUrl: episode.videoUrl,
          duration: '24:00',
          _id: episode._id
        });
      });

      // Yeni sezon yapısını oluştur
      const seasons = Array.from(seasonMap.entries()).map(([seasonNumber, episodes]) => ({
        seasonNumber,
        episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber)
      }));

      // Sıralı sezonları kaydet
      anime.seasons = seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
      await anime.save();
      updatedCount++;
      
      console.log(`${anime.name} için sezonlar güncellendi.`);
    }

    console.log(`Migrasyon tamamlandı! ${updatedCount} anime güncellendi.`);
    console.log('Bir sonraki migrasyon için bekleniyor...');
  } catch (error) {
    console.error('Migrasyon hatası:', error);
  }
}

// Her 10 dakikada bir çalışacak cron job
cron.schedule('*/10 * * * *', () => {
  console.log('Zamanlanmış migrasyon başlatılıyor...');
  migrateData();
});

// İlk çalıştırma
console.log('İlk migrasyon başlatılıyor...');
migrateData(); 