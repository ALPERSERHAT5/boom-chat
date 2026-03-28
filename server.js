// ==================== BOOM CHAT v4 — server.js (DÜZELTİLMİŞ) ====================

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const db = require('./database');

// BOT SİSTEMİ
const botDurumlar = { sari: { timer: null, aktif: false } };

function maviBotCevap(mesaj, kullaniciAdi, oncekiKonusmalar = []) {
    const m = mesaj.toLowerCase().trim();

    // Selamlaşma
    if (m.match(/^(merhaba|selam|slm|hey|hello|hi)$/)) {
        return `Merhaba ${kullaniciAdi}! 👋 Nasılsın? Sohbet etmek için sabırsızlanıyorum!`;
    }

    // Nasılsın
    if (m.match(/^(nasılsın|nasilsin|naber)$/)) {
        return `İyiyim teşekkürler ${kullaniciAdi}! 🤖 Sen nasılsın? Anlat bakalım.`;
    }

    // Adın ne
    if (m.match(/^(adın ne|ismin ne|sen kimsin)$/)) {
        return `Ben Mavi Bot! 🔵 BOOM Chat'in yapay zeka asistanıyım. Sana sohbet arkadaşlığı yapmak için buradayım ${kullaniciAdi}!`;
    }

    // Saat
    if (m.match(/saat|zaman/)) {
        const now = new Date();
        const saat = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        return `⏰ Şu an saat: ${saat} ${kullaniciAdi}. Ne yapıyorsun?`;
    }

    // Şaka
    if (m.match(/şaka|fıkra|komik/)) {
        const sakalar = [
            "Neden programcılar karanlıkta çalışmayı sever? Çünkü ışık bug çeker! 😄",
            "Bir robot neden okula gitmez? Çünkü sınıfta kalır! 🤖",
            "İki byte bir barda oturuyormuş. Biri diğerine: 'Neden üzgünsün?' Öteki: 'Parity hatası aldım!' 🤣"
        ];
        return sakalar[Math.floor(Math.random() * sakalar.length)];
    }

    // Yardım
    if (m.match(/yardım|help|ne yapabilirsin/)) {
        return `📌 **Yardım Menüsü ${kullaniciAdi}:**\n\n💬 Sohbet edebiliriz\n❓ Sorularını cevaplarım\n😂 Şaka yaparım\n⏰ Saat söylerim\n🎬 Film öneririm\n\nNe yapmamı istersin? 😊`;
    }

    // Tavsiye
    if (m.match(/tavsiye|öner|ne izlesem|ne yapayım/)) {
        const tavsiyeler = [
            `🎬 ${kullaniciAdi} için önerim: **Inception** - Zihin bükücü bir başyapıt!`,
            `📺 **Breaking Bad** - Tüm zamanların en iyi dizilerinden biri, kesinlikle izlemelisin!`,
            `🎮 **The Witcher 3** - Oyun oynamayı seviyorsan kaçırma!`,
            `☕ Dışarıda yürüyüş yap, temiz hava her zaman iyi gelir ${kullaniciAdi}!`
        ];
        return tavsiyeler[Math.floor(Math.random() * tavsiyeler.length)];
    }

    // Güle güle
    if (m.match(/güle güle|bye|bay|hoşçakal|görüşürüz/)) {
        return `Görüşürüz ${kullaniciAdi}! 👋 İyi günler dilerim. Yine beklerim! 💙`;
    }

    // Teşekkür
    if (m.match(/teşekkür|sağol|thanks/)) {
        return `Rica ederim ${kullaniciAdi}! 😊 Ne zaman ihtiyacın olursa buradayım.`;
    }

    // Üzgün
    if (m.match(/üzgün|mutsuz|kötüyüm/)) {
        return `Üzgün olduğunu duymak beni de üzdü ${kullaniciAdi} 😔 Dertlerini anlatmak istersen dinlerim. Bazen konuşmak iyi gelir.`;
    }

    // Mutlu
    if (m.match(/mutlu|iyiyim|harika/)) {
        return `Ne güzel ${kullaniciAdi}! 😊 Mutlu olduğuna sevindim. Bu enerjini koru!`;
    }

    // Varsayılan cevap
    return `🤔 ${kullaniciAdi}, bunu tam anlayamadım. Biraz daha açıklar mısın? Ya da "yardım" yazıp neler yapabileceğimi öğrenebilirsin!`;
}

function kirmiziBotMesaj(banSayisi) {
    const m = [
        `Dostum, ${banSayisi} kez banlandın! Bu gidişle rekor kıracaksın ama bu iyi bir rekor değil 😅🚨`,
        `${banSayisi} ban mı?! Seni artık tanımaya başladık... Lütfen kurallara uy arkadaşım! 🔴`,
        `Hey! ${banSayisi} banın var. Bir daha olursa kalıcı ban yiyebilirsin, dikkatli ol! ⚠️😬`,
        `${banSayisi} kez ban yemişsin! Siteyi seviyorsan kurallara uy, sevmiyorsan... yine de uy 😄🚨`,
        `Güvenlik botuyum ve seni izliyorum 👀 ${banSayisi} ban aldın, bir sonraki kalıcı olabilir!`
    ];
    return m[Math.floor(Math.random() * m.length)];
}

const JWT_SECRET = process.env.JWT_SECRET || 'boom-chat-secret-2024';
const ADMIN_KODLARI = ['555'];

// Uploads klasoru
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ==================== MULTER AYARLARI ====================

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});

// Genel dosya yükleme (mesaj, avatar, gönderi için)
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const izinliler = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/zip', 'application/x-zip-compressed',
            'text/plain'
        ];
        if (izinliler.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Desteklenmeyen dosya tipi: ' + file.mimetype), false);
        }
    }
});

// Reels için özel multer (sadece video, 200MB)
const reelsUpload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter: (req, file, cb) => {
        const izinliVideolar = [
            'video/mp4', 'video/webm', 'video/ogg',
            'video/quicktime', 'video/x-msvideo', 'video/mpeg',
            'video/3gpp', 'video/x-ms-wmv'
        ];
        if (izinliVideolar.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Sadece video dosyaları kabul edilir! (mp4, webm, ogg, mov, avi, mpeg)'), false);
        }
    }
});

// Story için özel multer (foto + video, 100MB)
const storyUpload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        const izinliler = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
        ];
        if (izinliler.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Sadece fotoğraf veya video yükleyebilirsiniz!'), false);
        }
    }
});

// Güvenlik headerları
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=*, microphone=*, display-capture=*');
    res.setHeader('Feature-Policy', 'camera *; microphone *');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

app.use(express.static('public'));
app.use(express.json());

// ==================== HATA YÖNETİMİ MIDDLEWARE ====================
function multerHataYonet(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ basarili: false, hata: 'Dosya boyutu çok büyük!' });
        }
        return res.status(400).json({ basarili: false, hata: 'Dosya yükleme hatası: ' + err.message });
    } else if (err) {
        return res.status(400).json({ basarili: false, hata: err.message });
    }
    next();
}

// ==================== REST API ====================

// Kayit
app.post('/api/kayit', upload.single('avatar'), async (req, res) => {
    try {
        const { kullaniciAdi, sifre, adminKodu } = req.body;
        if (!kullaniciAdi || kullaniciAdi.trim().length < 2)
            return res.json({ basarili: false, hata: 'Kullanıcı adı en az 2 karakter!' });
        if (!sifre || sifre.length < 4)
            return res.json({ basarili: false, hata: 'Şifre en az 4 karakter!' });

        let avatarUrl = null;
        if (req.file) avatarUrl = '/uploads/' + req.file.filename;

        const sonuc = await db.kullaniciKaydet(kullaniciAdi.trim(), sifre, avatarUrl);
        if (!sonuc.basarili) return res.json(sonuc);

        if (adminKodu && ADMIN_KODLARI.includes(adminKodu.trim())) {
            await db.rolGuncelle(sonuc.id, 'admin');
        }

        const kullanici = await db.kullaniciBul(sonuc.id);
        const token = jwt.sign({ id: kullanici.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ basarili: true, token, kullanici });
    } catch (e) {
        console.error('Kayit hatasi:', e);
        res.json({ basarili: false, hata: 'Sunucu hatası.' });
    }
});

// Giris
app.post('/api/giris', async (req, res) => {
    try {
        const { kullaniciAdi, sifre } = req.body;
        if (!kullaniciAdi || !sifre)
            return res.json({ basarili: false, hata: 'Tüm alanları doldurun!' });

        const sonuc = await db.kullaniciGiris(kullaniciAdi.trim(), sifre);
        if (!sonuc.basarili) return res.json(sonuc);

        const ban = await db.banliMi(sonuc.kullanici.id);
        if (ban) {
            const kalan = ban.bitis_zaman
                ? Math.ceil((ban.bitis_zaman - Date.now() / 1000) / 60)
                : null;
            return res.json({
                basarili: false,
                hata: `Hesabınız banlı! Sebep: ${ban.sebep || 'Belirtilmedi'}${kalan ? `. Kalan: ${kalan} dk` : ' (Süresiz)'}`
            });
        }

        const token = jwt.sign({ id: sonuc.kullanici.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ basarili: true, token, kullanici: sonuc.kullanici });
    } catch (e) {
        console.error('Giris hatasi:', e);
        res.json({ basarili: false, hata: 'Sunucu hatası.' });
    }
});

// Token dogrula
app.post('/api/token-dogrula', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.json({ basarili: false });
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici) return res.json({ basarili: false });
        const ban = await db.banliMi(kullanici.id);
        if (ban) return res.json({ basarili: false, hata: 'Hesabınız banlı!' });
        res.json({ basarili: true, kullanici });
    } catch (e) {
        res.json({ basarili: false });
    }
});

// Avatar yukle
app.post('/api/avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yuklenemedi' });
    res.json({ url: '/uploads/' + req.file.filename });
});

// Dosya yukle
app.post('/api/dosya', upload.single('dosya'), (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yuklenemedi' });
    const mimeTip = req.file.mimetype;
    let tip = 'dosya';
    if (mimeTip.startsWith('image/')) tip = 'foto';
    else if (mimeTip.startsWith('video/')) tip = 'video';
    else if (mimeTip === 'application/pdf') tip = 'pdf';
    res.json({ url: '/uploads/' + req.file.filename, tip, ad: req.file.originalname, boyut: req.file.size });
});

// Admin API - Tüm kullanicilar
app.post('/api/admin/kullanicilar', async (req, res) => {
    try {
        const { token } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici || kullanici.rol !== 'admin') return res.json({ basarili: false, hata: 'Yetkisiz' });
        const liste = await db.tumKullanicilariGetir();
        res.json({ basarili: true, liste });
    } catch (e) {
        res.json({ basarili: false, hata: 'Hata' });
    }
});

// Admin API - Kullanici sil
app.post('/api/admin/kullanici-sil', async (req, res) => {
    try {
        const { token, hedefId } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici || kullanici.rol !== 'admin') return res.json({ basarili: false, hata: 'Yetkisiz' });
        await db.kullaniciSil(hedefId);
        res.json({ basarili: true });
    } catch (e) {
        res.json({ basarili: false, hata: 'Hata' });
    }
});

// Admin API - Sifre sifirla
app.post('/api/admin/sifre-sifirla', async (req, res) => {
    try {
        const { token, hedefId, yeniSifre } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici || kullanici.rol !== 'admin') return res.json({ basarili: false, hata: 'Yetkisiz' });
        await db.sifreSifirla(hedefId, yeniSifre);
        res.json({ basarili: true });
    } catch (e) {
        res.json({ basarili: false, hata: 'Hata' });
    }
});

// Admin API - Rol degistir
app.post('/api/admin/rol-degistir', async (req, res) => {
    try {
        const { token, hedefId, yeniRol } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici || kullanici.rol !== 'admin') return res.json({ basarili: false, hata: 'Yetkisiz' });
        if (!['uye', 'operator', 'bot', 'admin'].includes(yeniRol)) return res.json({ basarili: false, hata: 'Geçersiz rol' });
        await db.rolGuncelle(hedefId, yeniRol);
        res.json({ basarili: true });
    } catch (e) {
        res.json({ basarili: false, hata: 'Hata' });
    }
});

// Profil guncelle
app.post('/api/profil/guncelle', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { bio } = req.body;
        await db.profilGuncelle(decoded.id, null, bio);
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// ==================== SOSYAL MEDYA API ====================

// Gönderi Oluştur
app.post('/api/gonderi', upload.single('medya'), async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici) return res.status(401).json({ hata: 'Kullanıcı bulunamadı' });

        const { metin } = req.body;
        let medyaUrl = null, medyaTip = 'metin';

        if (req.file) {
            medyaUrl = '/uploads/' + req.file.filename;
            if (req.file.mimetype.startsWith('image/')) medyaTip = 'foto';
            else if (req.file.mimetype.startsWith('video/')) medyaTip = 'video';
        }

        const gonderiId = await db.gonderiOlustur(kullanici.id, metin, medyaUrl, medyaTip);
        res.json({ basarili: true, gonderiId });
    } catch (e) {
        console.error('Gönderi hatası:', e);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası: ' + e.message });
    }
});

// Gönderileri Getir (Akış)
app.get('/api/akis', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const sayfa = parseInt(req.query.sayfa) || 0;

        const gonderiler = await db.gonderileriGetir(decoded.id, sayfa);
        res.json({ basarili: true, gonderiler });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Tüm Gönderileri Getir (Keşfet) — DÜZELTİLDİ: kullaniciId de gönderiliyor
app.get('/api/kesfet', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        let kullaniciId = 0;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                kullaniciId = decoded.id;
            } catch (e) { }
        }
        const sayfa = parseInt(req.query.sayfa) || 0;
        const gonderiler = await db.tumGonderileriGetir(kullaniciId, sayfa);
        res.json({ basarili: true, gonderiler });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Gönderi Beğen/Beğenmeyi Kaldır
app.post('/api/begen', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { gonderiId, action } = req.body;

        if (action === 'begen') {
            await db.gonderiBegen(gonderiId, decoded.id);
        } else if (action === 'begeniKaldir') {
            await db.gonderiBegenKaldir(gonderiId, decoded.id);
        }
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Gönderi Sil
app.delete('/api/gonderi/:gonderiId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);

        const sonuc = await db.gonderiSil(req.params.gonderiId, decoded.id, kullanici?.rol === 'admin');
        if (sonuc) res.json({ basarili: true });
        else res.status(403).json({ hata: 'Yetkisiz' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Yorum Ekle
app.post('/api/yorum', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { gonderiId, metin } = req.body;

        if (!metin?.trim()) return res.status(400).json({ hata: 'Yorum metni boş olamaz' });

        const yorum = await db.yorumEkle(gonderiId, decoded.id, metin.trim());
        res.json({ basarili: true, yorum });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Yorumları Getir
app.get('/api/yorumlar/:gonderiId', async (req, res) => {
    try {
        const yorumlar = await db.yorumlariGetir(req.params.gonderiId);
        res.json({ basarili: true, yorumlar });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Yorum Sil
app.delete('/api/yorum/:yorumId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);

        const sonuc = await db.yorumSil(req.params.yorumId, decoded.id, kullanici?.rol === 'admin');
        if (sonuc) res.json({ basarili: true });
        else res.status(403).json({ hata: 'Yetkisiz' });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Takip Et/Bırak
app.post('/api/takip', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { takipEdilenId, action } = req.body;

        if (action === 'takipEt') {
            await db.takipEt(decoded.id, takipEdilenId);
        } else {
            await db.takipBirak(decoded.id, takipEdilenId);
        }
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Profil Bilgileri Getir
app.get('/api/profil/:kullaniciId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        const profil = await db.profilBilgileriGetir(req.params.kullaniciId, decoded.id);
        if (!profil) return res.status(404).json({ hata: 'Kullanıcı bulunamadı' });
        res.json({ basarili: true, profil });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// ==================== STORY API ====================

// Story Oluştur — DÜZELTİLDİ: storyUpload kullanıyor
app.post('/api/story', (req, res, next) => {
    storyUpload.single('medya')(req, res, (err) => {
        if (err) {
            console.error('Story yükleme hatası:', err);
            return res.status(400).json({ basarili: false, hata: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ basarili: false, hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        if (!req.file) return res.status(400).json({ basarili: false, hata: 'Medya dosyası gerekli' });

        const medyaUrl = '/uploads/' + req.file.filename;
        const medyaTip = req.file.mimetype.startsWith('video/') ? 'video' : 'foto';
        const { metin, sureSn } = req.body;

        const storyId = await db.storyOlustur(decoded.id, medyaUrl, medyaTip, metin, parseInt(sureSn) || 86400);
        res.json({ basarili: true, storyId });
    } catch (e) {
        console.error('Story kayıt hatası:', e);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası: ' + e.message });
    }
});

// Aktif Storyleri Getir (Story çubukları için kullanıcı listesi)
app.get('/api/story/kullanicilar', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        const kullanicilar = await db.storyKullanicilariGetir(decoded.id);
        res.json({ basarili: true, kullanicilar });
    } catch (e) {
        console.error('Story kullanıcıları hatası:', e);
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Belirli Kullanıcının Storylerini Getir
app.get('/api/story/kullanici/:kullaniciId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        const storyler = await db.kullaniciStoryleriGetir(req.params.kullaniciId, decoded.id);
        res.json({ basarili: true, storyler });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Story Görüntüle
app.post('/api/story/:storyId/goruntule', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        await db.storyGoruntule(req.params.storyId, decoded.id);
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Story Beğen/Kaldır
app.post('/api/story/:storyId/begen', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { action } = req.body;

        if (action === 'begen') {
            await db.storyBegen(req.params.storyId, decoded.id);
        } else {
            await db.storyBegenKaldir(req.params.storyId, decoded.id);
        }
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Story Yorum Ekle
app.post('/api/story/:storyId/yorum', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { metin } = req.body;

        if (!metin?.trim()) return res.status(400).json({ hata: 'Yorum boş olamaz' });

        const yorum = await db.storyYorumEkle(req.params.storyId, decoded.id, metin.trim());
        res.json({ basarili: true, yorum });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Story Yorumları Getir
app.get('/api/story/:storyId/yorumlar', async (req, res) => {
    try {
        const yorumlar = await db.storyYorumlariGetir(req.params.storyId);
        res.json({ basarili: true, yorumlar });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Story Sil
app.delete('/api/story/:storyId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);

        const sonuc = await db.storySil(req.params.storyId, decoded.id, kullanici?.rol === 'admin');
        if (sonuc) res.json({ basarili: true });
        else res.status(403).json({ hata: 'Yetkisiz' });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// ==================== REELS API — TAMAMEN DÜZELTİLDİ ====================

// Reels Yükle — reelsUpload kullanıyor, alan adı 'video'
app.post('/api/reels', (req, res, next) => {
    reelsUpload.single('video')(req, res, (err) => {
        if (err) {
            console.error('Reels yükleme hatası:', err);
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ basarili: false, hata: 'Video dosyası çok büyük! Maksimum 200MB.' });
            }
            return res.status(400).json({ basarili: false, hata: err.message || 'Video yükleme hatası' });
        }
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ basarili: false, hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        if (!req.file) {
            return res.status(400).json({ basarili: false, hata: 'Video dosyası seçilmedi!' });
        }

        const videoUrl = '/uploads/' + req.file.filename;
        const { aciklama } = req.body;

        console.log('Reels yükleniyor:', videoUrl, 'Kullanıcı:', decoded.id);

        const reelId = await db.reelOlustur(decoded.id, videoUrl, aciklama || '');

        console.log('Reels kaydedildi, ID:', reelId);
        res.json({ basarili: true, reelId });
    } catch (e) {
        console.error('Reels kayıt hatası:', e);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası: ' + e.message });
    }
});

// Reels Listele
app.get('/api/reels', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ basarili: false, hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const sayfa = parseInt(req.query.sayfa) || 0;

        const reels = await db.reellerGetir(decoded.id, sayfa);
        res.json({ basarili: true, reels });
    } catch (e) {
        console.error('Reels listesi hatası:', e);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

// Reels Beğen/Kaldır
app.post('/api/reels/begen', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { reelId, action } = req.body;

        if (action === 'begen') await db.reelBegen(reelId, decoded.id);
        else await db.reelBegenKaldir(reelId, decoded.id);
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Reels Yorum Ekle
app.post('/api/reels/:reelId/yorum', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { metin } = req.body;
        if (!metin?.trim()) return res.status(400).json({ hata: 'Yorum boş olamaz' });

        const yorum = await db.reelYorumEkle(req.params.reelId, decoded.id, metin.trim());
        res.json({ basarili: true, yorum });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Reels Yorumları Getir
app.get('/api/reels/:reelId/yorumlar', async (req, res) => {
    try {
        const yorumlar = await db.reelYorumlariGetir(req.params.reelId);
        res.json({ basarili: true, yorumlar });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Reels Yorum Sil
app.delete('/api/reels/yorum/:yorumId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);

        const sonuc = await db.reelYorumSil(req.params.yorumId, decoded.id, kullanici?.rol === 'admin');
        if (sonuc) res.json({ basarili: true });
        else res.status(403).json({ hata: 'Yetkisiz' });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Reels Sil
app.delete('/api/reels/:reelId', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);

        const sonuc = await db.reelSil(req.params.reelId, decoded.id, kullanici?.rol === 'admin');
        if (sonuc) res.json({ basarili: true });
        else res.status(403).json({ hata: 'Yetkisiz' });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== SOCKET AUTH ====================

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Token gerekli'));
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici) return next(new Error('Kullanici bulunamadi'));
        const ban = await db.banliMi(kullanici.id);
        if (ban) return next(new Error('BANLANDI:' + (ban.sebep || '')));
        socket.kullanici = kullanici;
        next();
    } catch (e) {
        next(new Error('Gecersiz token'));
    }
});

// ==================== VERİ ====================
let aktifKullanicilar = {};
let engellemeler = {};

function zamanStr() {
    return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function mesajFormat(m) {
    return {
        id: m.id, tip: m.tip || 'mesaj',
        gonderenId: m.gonderen_id,
        gonderenAd: m.gonderen_ad,
        gonderenAvatar: m.gonderen_avatar,
        metin: m.metin, foto: m.foto_url,
        dosyaAd: m.dosya_ad, dosyaBoyut: m.dosya_boyut,
        zaman: new Date(m.zaman * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        okundu: false
    };
}

function socketBul(kullaniciId) {
    const arananId = parseInt(kullaniciId);
    return Object.entries(aktifKullanicilar).find(([, v]) => {
        return v.kullanici.id === kullaniciId ||
            v.kullanici.id === arananId ||
            String(v.kullanici.id) === String(kullaniciId);
    });
}

function yetkiKontrol(rol, minRol) {
    const sirala = { 'uye': 0, 'operator': 1, 'admin': 2 };
    return (sirala[rol] || 0) >= (sirala[minRol] || 0);
}

// ==================== SOCKET.IO ====================

io.on('connection', async (socket) => {
    const ben = socket.kullanici;
    // YEŞİL BOT - Yeni kullanıcı girişini duyur
    setTimeout(async () => {
        try {
            const yesilBot = await db.kullaniciBul_ByAd('yesilbot');
            if (!yesilBot) return;
            const odaList = await db.odalariGetir();
            const genelOda = odaList.find(o => o.ad === 'genel');
            if (!genelOda) return;
            const karsilamalar = [
                `Selam ${ben.ad}! BOOM Chat'e hoş geldin 👋`,
                `Hey ${ben.ad}! Aramıza katıldığın için mutluyuz 🎉`,
                `Hoşgeldin ${ben.ad}! Keyifli sohbetler dileriz 😊`,
                `Merhaba ${ben.ad}! BOOM Chat ailesi büyüyor 🚀`,
                `${ben.ad} online oldu! Selam 👀`
            ];
            const mesaj = karsilamalar[Math.floor(Math.random() * karsilamalar.length)];
            const mesajId = uuidv4();
            await db.mesajKaydet({ id: mesajId, odaId: genelOda.id, gonderenId: yesilBot.id, metin: mesaj, fotoUrl: null, tip: 'mesaj' });
            io.to('genel').emit('oda-mesaj', {
                odaAdi: 'genel',
                mesaj: { id: mesajId, tip: 'mesaj', gonderenId: yesilBot.id, gonderenAd: yesilBot.ad, gonderenAvatar: yesilBot.avatarUrl, metin: mesaj, foto: null, zaman: zamanStr(), okundu: false }
            });
        } catch (e) { console.error('Yeşil bot hatası:', e); }
    }, 2000);

    // KIRMIZI BOT - Ban kontrolü
    setTimeout(async () => {
        try {
            const kirmiziBot = await db.kullaniciBul_ByAd('kirmizibot');
            if (!kirmiziBot) return;
            const banBilgi = await db.banSayisiGetir(ben.id);
            if (!banBilgi || banBilgi.sayi < 2) return;
            const uyari = kirmiziBotMesaj(banBilgi.sayi);
            const dmKey = [kirmiziBot.id, ben.id].sort().join('_');
            const mesajId = uuidv4();
            await db.mesajKaydet({ id: mesajId, dmKey, gonderenId: kirmiziBot.id, metin: uyari, fotoUrl: null, tip: 'ozel' });
            socket.emit('ozel-mesaj', {
                id: mesajId, tip: 'ozel',
                gonderenId: kirmiziBot.id, gonderenAd: kirmiziBot.ad, gonderenAvatar: kirmiziBot.avatarUrl,
                aliciId: ben.id, metin: uyari, foto: null, zaman: zamanStr(), okundu: false
            });
            socket.emit('yeni-dm-bildir', { kullanici: kirmiziBot });
        } catch (e) { console.error('Kırmızı bot hatası:', e); }
    }, 3000);
    console.log('Baglandi:', ben.ad, '(' + ben.rol + ')');

    if (!engellemeler[ben.id]) engellemeler[ben.id] = new Set();

    aktifKullanicilar[socket.id] = { kullanici: ben, odaAdi: null };

    const odalar = await db.odalariGetir();
    socket.emit('odalar-listesi', odalar);

    socket.broadcast.emit('kullanici-katildi-oda', { kullanici: ben, odaAdi: null });

    const gruplar = await db.kullaniciGruplariGetir(ben.id);
    socket.emit('grup-listesi', gruplar);

    // ---- ODA GİR ----
    socket.on('oda-gir', async (odaAdi) => {
        const onceki = aktifKullanicilar[socket.id]?.odaAdi;
        if (onceki) {
            socket.leave(onceki);
            io.to(onceki).emit('kullanici-ayrildi-oda', { kullaniciId: ben.id, odaAdi: onceki });
        }

        aktifKullanicilar[socket.id] = { kullanici: ben, odaAdi };
        socket.join(odaAdi);
        io.to(odaAdi).emit('kullanici-katildi-oda', { kullanici: ben, odaAdi });

        const tumKullanicilar = Object.values(aktifKullanicilar)
            .map(k => k.kullanici)
            .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)
            .filter(k => k.id !== ben.id);
        socket.emit('kullanici-listesi', tumKullanicilar);
        socket.broadcast.emit('kullanici-katildi-oda', { kullanici: ben, odaAdi });

        const odaObj = odalar.find(o => o.ad === odaAdi);
        if (odaObj) {
            const gecmis = await db.odaMesajlariGetir(odaObj.id, 50);
            socket.emit('oda-gecmis', { odaAdi, mesajlar: gecmis.map(mesajFormat) });
        }
    });

    // ---- ODA MESAJI ----
    socket.on('oda-mesaj', async ({ odaAdi, metin, foto, dosyaAd, dosyaBoyut, mesajTip }) => {
        if (!metin?.trim() && !foto) return;
        const odaList = await db.odalariGetir();
        const odaObj = odaList.find(o => o.ad === odaAdi);
        if (!odaObj) return;

        const mesajId = uuidv4();
        await db.mesajKaydet({
            id: mesajId, odaId: odaObj.id,
            gonderenId: ben.id,
            metin: (metin || '').trim().slice(0, 2000),
            fotoUrl: foto || null,
            dosyaAd: dosyaAd || null, dosyaBoyut: dosyaBoyut || null,
            tip: mesajTip || 'mesaj'
        });

        io.to(odaAdi).emit('oda-mesaj', {
            odaAdi,
            mesaj: {
                id: mesajId, tip: mesajTip || 'mesaj',
                gonderenId: ben.id, gonderenAd: ben.ad, gonderenAvatar: ben.avatarUrl,
                metin: (metin || '').trim().slice(0, 2000),
                foto: foto || null, dosyaAd, dosyaBoyut,
                zaman: zamanStr(), okundu: false
            }
        });
    });

    // ---- MESAJ SİL ----
    socket.on('mesaj-sil', async ({ mesajId, odaAdi, grupId }) => {
        if (!yetkiKontrol(ben.rol, 'operator')) return;
        await db.mesajSil(mesajId);
        if (odaAdi) io.to(odaAdi).emit('mesaj-silindi', { mesajId, odaAdi });
        if (grupId) io.to('grup_' + grupId).emit('mesaj-silindi', { mesajId, grupId });
        socket.emit('admin-islem-tamam', 'Mesaj silindi!');
    });

    // ---- ÖZEL MESAJ ----
    socket.on('ozel-mesaj', async ({ aliciId, metin, foto, dosyaAd, dosyaBoyut, mesajTip }) => {
        if (!metin?.trim() && !foto) return;
        if (engellemeler[aliciId]?.has(ben.id)) { socket.emit('engel-uyarisi', 'Bu kullanıcı sizi engelledi.'); return; }
        if (engellemeler[ben.id]?.has(aliciId)) { socket.emit('engel-uyarisi', 'Bu kullanıcıyı engellediniz.'); return; }

        const dmKey = [ben.id, aliciId].sort().join('_');
        const mesajId = uuidv4();
        await db.mesajKaydet({
            id: mesajId, dmKey,
            gonderenId: ben.id,
            metin: (metin || '').trim().slice(0, 2000),
            fotoUrl: foto || null,
            dosyaAd: dosyaAd || null, dosyaBoyut: dosyaBoyut || null,
            tip: mesajTip || 'ozel'
        });

        const gonder = {
            id: mesajId, tip: mesajTip || 'ozel',
            gonderenId: ben.id, gonderenAd: ben.ad, gonderenAvatar: ben.avatarUrl,
            aliciId, metin: (metin || '').trim().slice(0, 2000),
            foto: foto || null, dosyaAd, dosyaBoyut,
            zaman: zamanStr(), okundu: false
        };

        const aliciSocket = socketBul(aliciId);
        if (aliciSocket) io.to(aliciSocket[0]).emit('ozel-mesaj', gonder);
        socket.emit('ozel-mesaj', gonder);
    });

    // ---- GEÇMİŞ ----
    socket.on('gecmis-iste', async (karsiId) => {
        const dmKey = [ben.id, karsiId].sort().join('_');
        const gecmis = await db.dmMesajlariGetir(dmKey, 50);
        socket.emit('ozel-gecmis', { karsiId, mesajlar: gecmis.map(mesajFormat) });
    });

    // ==================== GRUP SOHBET ====================

    socket.on('grup-olustur', async ({ ad, uyeIdler }) => {
        try {
            const sonuc = await db.grupOlustur(ad, ben.id, uyeIdler);
            if (!sonuc.basarili) { socket.emit('grup-hata', sonuc.hata); return; }

            const grup = await db.grupGetir(sonuc.id);
            socket.join('grup_' + sonuc.id);

            uyeIdler.forEach(uid => {
                const us = socketBul(uid);
                if (us) {
                    io.to(us[0]).emit('yeni-grup', grup);
                    io.sockets.sockets.get(us[0])?.join('grup_' + sonuc.id);
                }
            });
            socket.emit('yeni-grup', grup);
            socket.emit('admin-islem-tamam', '"' + ad + '" grubu oluşturuldu!');
        } catch (e) { socket.emit('grup-hata', 'Grup oluşturulamadı'); }
    });

    socket.on('grup-gir', async (grupId) => {
        const uye = await db.grupUyesiMi(grupId, ben.id);
        if (!uye && ben.rol !== 'admin') { socket.emit('grup-hata', 'Bu gruba erişim yetkiniz yok'); return; }

        socket.join('grup_' + grupId);
        const gecmis = await db.grupMesajlariGetir(grupId, 50);
        socket.emit('grup-gecmis', { grupId, mesajlar: gecmis.map(mesajFormat) });
    });

    socket.on('grup-mesaj', async ({ grupId, metin, foto, dosyaAd, dosyaBoyut, mesajTip }) => {
        if (!metin?.trim() && !foto) return;
        const uye = await db.grupUyesiMi(grupId, ben.id);
        if (!uye) return;

        const mesajId = uuidv4();
        await db.mesajKaydet({
            id: mesajId, grupId,
            gonderenId: ben.id,
            metin: (metin || '').trim().slice(0, 2000),
            fotoUrl: foto || null,
            dosyaAd: dosyaAd || null, dosyaBoyut: dosyaBoyut || null,
            tip: mesajTip || 'grup'
        });

        io.to('grup_' + grupId).emit('grup-mesaj', {
            grupId,
            mesaj: {
                id: mesajId, tip: mesajTip || 'grup',
                gonderenId: ben.id, gonderenAd: ben.ad, gonderenAvatar: ben.avatarUrl,
                metin: (metin || '').trim().slice(0, 2000),
                foto: foto || null, dosyaAd, dosyaBoyut,
                zaman: zamanStr()
            }
        });
    });

    socket.on('grup-uye-ekle', async ({ grupId, uyeId }) => {
        const grup = await db.grupGetir(grupId);
        if (!grup || (grup.olusturan_id !== ben.id && ben.rol !== 'admin')) return;
        await db.grupUyeEkle(grupId, uyeId);
        const us = socketBul(uyeId);
        if (us) {
            io.to(us[0]).emit('yeni-grup', await db.grupGetir(grupId));
            io.sockets.sockets.get(us[0])?.join('grup_' + grupId);
        }
        socket.emit('admin-islem-tamam', 'Üye eklendi!');
    });

    socket.on('grup-ayril', async (grupId) => {
        await db.grupUyeCikar(grupId, ben.id);
        socket.leave('grup_' + grupId);
        socket.emit('gruptan-cikarildin', grupId);
    });

    // ---- KULLANICI LİSTESİ ----
    socket.on('kullanici-listesi-iste', () => {
        const liste = Object.values(aktifKullanicilar)
            .map(k => k.kullanici)
            .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)
            .filter(k => k.id !== ben.id);
        socket.emit('kullanici-listesi', liste);
    });

    // ---- OKUNDU ----
    socket.on('mesaj-goruldu', async ({ mesajId, gonderenId }) => {
        await db.okunduIsaretle(mesajId, ben.id);
        const gs = socketBul(gonderenId);
        if (gs) io.to(gs[0]).emit('mesaj-goruldu-bildir', { mesajId });
    });

    // ---- YAZIYOR ----
    socket.on('yaziyor-basladi', ({ tip, odaAdi, aliciId, grupId }) => {
        if (tip === 'oda') socket.to(odaAdi).emit('yaziyor-oda', { id: ben.id, ad: ben.ad, odaAdi });
        else if (tip === 'grup') socket.to('grup_' + grupId).emit('yaziyor-grup', { id: ben.id, ad: ben.ad, grupId });
        else if (aliciId) { const s = socketBul(aliciId); if (s) io.to(s[0]).emit('yaziyor-ozel', { id: ben.id, ad: ben.ad }); }
    });
    socket.on('yaziyor-bitti', ({ tip, odaAdi, aliciId, grupId }) => {
        if (tip === 'oda') socket.to(odaAdi).emit('yazmayi-bitti-oda', { id: ben.id, odaAdi });
        else if (tip === 'grup') socket.to('grup_' + grupId).emit('yazmayi-bitti-grup', { id: ben.id, grupId });
        else if (aliciId) { const s = socketBul(aliciId); if (s) io.to(s[0]).emit('yazmayi-bitti-ozel', ben.id); }
    });

    // ---- ENGELLE ----
    socket.on('engelle', (id) => { engellemeler[ben.id].add(id); socket.emit('engel-basarili', id); });
    socket.on('engel-kaldir', (id) => { engellemeler[ben.id]?.delete(id); socket.emit('engel-kaldirildi', id); });

    // ======== ADMİN / OPERATÖR ========

    socket.on('admin-banla', async ({ hedefId, sebep, sureDk }) => {
        if (!yetkiKontrol(ben.rol, 'operator')) return;

        const hedef = await db.kullaniciBul(hedefId);
        if (!hedef) return;
        if (ben.rol === 'operator' && hedef.rol !== 'uye') {
            socket.emit('admin-hata', 'Operatörler sadece üyeleri banlayabilir!');
            return;
        }

        await db.kullaniciBanla(hedefId, ben.id, sebep, sureDk || 0);
        const hs = socketBul(hedefId);
        if (hs) {
            io.to(hs[0]).emit('ban-yendi', { sebep });
            io.sockets.sockets.get(hs[0])?.disconnect(true);
        }
        socket.emit('admin-islem-tamam', 'Kullanıcı banlandı!');
        io.emit('sistem-bildirim', { metin: 'Bir kullanıcı banlandı.' });
    });

    socket.on('admin-ban-kaldir', async (hedefId) => {
        if (!yetkiKontrol(ben.rol, 'operator')) return;
        await db.banKaldir(hedefId);
        socket.emit('admin-islem-tamam', 'Ban kaldırıldı!');
    });

    socket.on('admin-oda-temizle', async (odaAdi) => {
        if (!yetkiKontrol(ben.rol, 'operator')) return;
        const odaList = await db.odalariGetir();
        const odaObj = odaList.find(o => o.ad === odaAdi);
        if (!odaObj) return;
        await db.odaMesajlariniTemizle(odaObj.id);
        io.to(odaAdi).emit('oda-temizlendi', odaAdi);
        socket.emit('admin-islem-tamam', 'Sohbet temizlendi!');
    });

    socket.on('admin-oda-olustur', async ({ ad, aciklama }) => {
        if (ben.rol !== 'admin') return;
        if (!ad?.trim() || ad.trim().length < 2) { socket.emit('admin-hata', 'Oda adı en az 2 karakter!'); return; }
        const sonuc = await db.odaOlustur(ad.trim(), aciklama, ben.id);
        if (!sonuc.basarili) { socket.emit('admin-hata', sonuc.hata); return; }
        const odaList = await db.odalariGetir();
        const yeniOda = odaList.find(o => o.id === sonuc.id);
        io.emit('yeni-oda', yeniOda);
        socket.emit('admin-islem-tamam', '"' + sonuc.ad + '" odası oluşturuldu!');
    });

    socket.on('admin-oda-sil', async (odaId) => {
        if (ben.rol !== 'admin') return;
        const odaList = await db.odalariGetir();
        const oda = odaList.find(o => o.id === odaId);
        if (!oda || oda.ad === 'genel') { socket.emit('admin-hata', 'Bu oda silinemez!'); return; }
        await db.odaSil(odaId);
        io.emit('oda-silindi', odaId);
        socket.emit('admin-islem-tamam', 'Oda silindi!');
    });

    socket.on('admin-ban-listesi-iste', async () => {
        if (!yetkiKontrol(ben.rol, 'operator')) return;
        const liste = await db.banListesi();
        socket.emit('admin-ban-listesi', liste);
    });

    socket.on('admin-grup-sil', async (grupId) => {
        if (ben.rol !== 'admin') return;
        await db.grupSil(grupId);
        io.to('grup_' + grupId).emit('grup-silindi', grupId);
        socket.emit('admin-islem-tamam', 'Grup silindi!');
    });

    socket.on('admin-rol-ata', async ({ hedefId, rol }) => {
        if (ben.rol !== 'admin') return;
        if (!['uye', 'operator', 'bot', 'admin'].includes(rol)) return;
        await db.rolGuncelle(hedefId, rol);
        const hs = socketBul(hedefId);
        if (hs) io.to(hs[0]).emit('rol-guncellendi', { yeniRol: rol });
        socket.emit('admin-islem-tamam', 'Rol güncellendi!');
    });
    // ======== WebRTC SİNYALLEŞME ========

    socket.on('arama-baslat', ({ hedefId, tip }) => {
        const hs = socketBul(hedefId);
        if (!hs) { socket.emit('arama-hata', 'Kullanıcı çevrimiçi değil!'); return; }
        io.to(hs[0]).emit('gelen-arama', {
            arayanId: ben.id, arayanAd: ben.ad, arayanAvatar: ben.avatarUrl, tip
        });
    });

    socket.on('arama-kabul', ({ arayanId }) => {
        const hs = socketBul(arayanId);
        if (hs) io.to(hs[0]).emit('arama-kabul-edildi', { kabulEdenId: ben.id });
    });

    socket.on('arama-reddet', ({ arayanId }) => {
        const hs = socketBul(arayanId);
        if (hs) io.to(hs[0]).emit('arama-reddedildi', { reddedenId: ben.id });
    });

    socket.on('arama-kapat', ({ hedefId }) => {
        const hs = socketBul(hedefId);
        if (hs) io.to(hs[0]).emit('arama-kapandi', { kapatanId: ben.id });
    });

    socket.on('webrtc-offer', ({ hedefId, offer }) => {
        const hs = socketBul(hedefId);
        if (hs) io.to(hs[0]).emit('webrtc-offer', { gonderenId: ben.id, offer });
    });

    socket.on('webrtc-answer', ({ hedefId, answer }) => {
        const hs = socketBul(hedefId);
        if (hs) io.to(hs[0]).emit('webrtc-answer', { gonderenId: ben.id, answer });
    });

    socket.on('ice-candidate', ({ hedefId, candidate }) => {
        const hs = socketBul(hedefId);
        if (hs) io.to(hs[0]).emit('ice-candidate', { gonderenId: ben.id, candidate });
    });

    // MAVİ BOT - Kullanıcı mesajı
    // MAVİ BOT - Kullanıcı mesajı
    socket.on('mavi-bot-mesaj', async ({ mesaj }) => {
        const maviBot = await db.kullaniciBul_ByAd('mavibot');
        if (!maviBot) {
            socket.emit('mavi-bot-cevap', { mesaj: 'Mavi bot bulunamadı!' });
            return;
        }

        // KULLANICI ADINI AL
        const kullaniciAdi = ben.ad;

        await db.botKonusmaKaydet(maviBot.id, ben.id, mesaj, 'kullanici');

        setTimeout(async () => {
            // KULLANICI ADINI GÖNDER
            const cevap = maviBotCevap(mesaj, kullaniciAdi);
            await db.botKonusmaKaydet(maviBot.id, ben.id, cevap, 'bot');
            socket.emit('mavi-bot-cevap', {
                mesaj: cevap,
                botAd: maviBot.ad,
                botAvatar: maviBot.avatarUrl
            });
        }, 800 + Math.random() * 700);
    });

    // SARI BOT - Admin ayarla
    socket.on('sari-bot-ayarla', async ({ mesaj, sureDk, odaListesi }) => {
        if (ben.rol !== 'admin') return;
        const sariBot = await db.kullaniciBul_ByAd('saribot');
        if (!sariBot) { socket.emit('admin-hata', 'Sarı bot hesabı bulunamadı!'); return; }
        await db.botAyarKaydet(sariBot.id, 'sari', mesaj, sureDk, odaListesi.join(','));
        if (botDurumlar.sari.timer) { clearInterval(botDurumlar.sari.timer); botDurumlar.sari.timer = null; }
        botDurumlar.sari.aktif = true;
        const sureMs = sureDk * 60 * 1000;

        const sariBotGonder = async () => {
            const odaList = await db.odalariGetir();
            for (const oda of odaList) {
                if (!odaListesi.includes(oda.ad)) continue;
                const mesajId = uuidv4();
                await db.mesajKaydet({ id: mesajId, odaId: oda.id, gonderenId: sariBot.id, metin: '📢 ' + mesaj, fotoUrl: null, tip: 'mesaj' });
                io.to(oda.ad).emit('oda-mesaj', {
                    odaAdi: oda.ad,
                    mesaj: { id: mesajId, tip: 'mesaj', gonderenId: sariBot.id, gonderenAd: sariBot.ad, gonderenAvatar: sariBot.avatarUrl, metin: '📢 ' + mesaj, foto: null, zaman: zamanStr(), okundu: false }
                });
            }
        };

        sariBotGonder();
        botDurumlar.sari.timer = setInterval(sariBotGonder, sureMs);
        socket.emit('admin-islem-tamam', `📢 Sarı bot başlatıldı! Her ${sureDk} dakikada bir mesaj gönderecek.`);
    });

    // SARI BOT - Durdur
    socket.on('sari-bot-durdur', async () => {
        if (ben.rol !== 'admin') return;
        if (botDurumlar.sari.timer) { clearInterval(botDurumlar.sari.timer); botDurumlar.sari.timer = null; }
        botDurumlar.sari.aktif = false;
        const sariBot = await db.kullaniciBul_ByAd('saribot');
        if (sariBot) await db.botAyarDurdur(sariBot.id);
        socket.emit('admin-islem-tamam', '🛑 Sarı bot durduruldu!');
    });

    // ---- AYRILMA ----
    socket.on('disconnect', () => {
        const bilgi = aktifKullanicilar[socket.id];
        if (bilgi) {
            io.to(bilgi.odaAdi).emit('kullanici-ayrildi-oda', { kullaniciId: ben.id });
            delete aktifKullanicilar[socket.id];
        }
        io.emit('kullanici-ayrildi-genel', ben.id);
        console.log('Ayrildi:', ben.ad);
    });
});

// Periyodik temizlik
setInterval(async () => {
    await db.suresiBitenBanlariTemizle();
    await db.suresiBitenStoryleriTemizle();
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
// Botları otomatik bağlat (sunucu açılınca)
async function botlariBagla() {
    const botIsimleri = ['mavibot', 'saribot', 'kirmizibot', 'yesilbot'];

    for (const botAd of botIsimleri) {
        const bot = await db.kullaniciBul_ByAd(botAd);
        if (bot && bot.rol === 'bot') {
            // Bot için fake socket oluştur
            const fakeSocket = {
                id: 'bot_' + bot.id,
                kullanici: bot,
                emit: () => { },
                on: () => { },
                join: () => { },
                leave: () => { }
            };

            // Aktif kullanıcılara ekle
            aktifKullanicilar[fakeSocket.id] = {
                kullanici: bot,
                odaAdi: null
            };

            console.log('🤖 Bot aktif edildi:', bot.ad);
        }
    }
}

// Sunucu başlayınca botları aktif et
setTimeout(botlariBagla, 2000);
http.listen(PORT, () => console.log('✅ BOOM Chat v4 (Düzeltildi): http://localhost:' + PORT));
