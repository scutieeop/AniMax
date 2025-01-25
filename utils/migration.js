const mongoose = require('mongoose');
const Anime = require('../models/Anime');
const cron = require('node-cron');

// Migrasyon işlemi için durum kontrolü
let isMigrationRunning = false;

// Migrasyon fonksiyonu
async function migrateSeasons() {
    if (isMigrationRunning) {
        console.log('Migrasyon zaten çalışıyor, bu işlem atlanıyor...');
        return;
    }

    try {
        isMigrationRunning = true;
        console.log('Migrasyon başlatılıyor...');

        const animes = await Anime.find({}).lean();
        let updatedCount = 0;

        for (const anime of animes) {
            try {
                // Eğer episodes varsa ama seasons boşsa
                if (anime.episodes && anime.episodes.length > 0 && (!anime.seasons || anime.seasons.length === 0)) {
                    // Bölümleri sezonlara göre grupla
                    const seasonMap = new Map();
                    
                    anime.episodes.forEach(episode => {
                        if (!seasonMap.has(episode.season)) {
                            seasonMap.set(episode.season, []);
                        }
                        seasonMap.get(episode.season).push({
                            episodeNumber: episode.episodeNumber,
                            title: episode.title || `Bölüm ${episode.episodeNumber}`,
                            videoUrl: episode.videoUrl,
                            thumbnail: episode.thumbnail || '',
                            duration: episode.duration || 0
                        });
                    });

                    // Sezonları oluştur
                    const seasons = Array.from(seasonMap.entries()).map(([seasonNumber, episodes]) => ({
                        seasonNumber: parseInt(seasonNumber),
                        title: `Sezon ${seasonNumber}`,
                        episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber)
                    }));

                    // Anime'yi güncelle
                    await Anime.findByIdAndUpdate(anime._id, {
                        $set: {
                            seasons: seasons,
                            totalEpisodes: anime.episodes.length
                        }
                    });

                    updatedCount++;
                    console.log(`${anime.name} için sezonlar güncellendi.`);
                }
            } catch (error) {
                console.error(`${anime.name} güncellenirken hata:`, error);
            }
        }

        console.log(`Migrasyon tamamlandı. ${updatedCount} anime güncellendi.`);
    } catch (error) {
        console.error('Migrasyon sırasında hata:', error);
    } finally {
        isMigrationRunning = false;
    }
}

// Migrasyon işlemini başlat
function startMigration() {
    // İlk çalıştırmada migrasyon yap
    migrateSeasons();

    // Her 10 dakikada bir migrasyon yap
    cron.schedule('*/10 * * * *', migrateSeasons);
}

module.exports = {
    startMigration
}; 