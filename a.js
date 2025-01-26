const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://uptrical:berkay@guildcode.nnxcj.mongodb.net/animeDB";

async function removeKomploField() {
    const client = new MongoClient(uri);

    try {
        await client.connect();

        const database = client.db("animeDB");
        const collection = database.collection("animes");

        const result = await collection.updateMany(
            {}, // Tüm belgeleri seçmek için boş bir filtre
            { $unset: { komplo: "" } } // `komplo` alanını kaldırır
        );

        console.log(`${result.modifiedCount} belge güncellendi.`);
    } catch (error) {
        console.error("Hata oluştu:", error);
    } finally {
        await client.close();
    }
}

async function resetDatabase() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('MongoDB\'ye bağlanıldı');

        const db = client.db("animeDB");

        // Tüm koleksiyonları al
        const collections = await db.listCollections().toArray();

        // Her koleksiyonu sıfırla
        for (const collection of collections) {
            await db.collection(collection.name).deleteMany({});
            console.log(`${collection.name} koleksiyonu temizlendi`);
        }

        console.log('Veritabanı başarıyla sıfırlandı');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await client.close();
        console.log('MongoDB bağlantısı kapatıldı');
    }
}

removeKomploField();
resetDatabase();

// Ana sayfa rotası
app.get('/', (req, res) => {
    res.render('index');
});

// Diğer rotaları devre dışı bırakıyoruz
/*
app.get('/yeni', (req, res) => {
    res.render('yeni');
});

app.get('/profile', (req, res) => {
    res.render('profile');
});

// Diğer muhtemel rotalar...
*/
