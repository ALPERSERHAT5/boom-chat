// ==================== BOOM CHAT v3 — server.js ====================

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

const JWT_SECRET = process.env.JWT_SECRET || 'boom-chat-secret-2024';
const ADMIN_KODLARI = ['001', '002'];

// Uploads klasoru
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, ['image/jpeg','image/png','image/gif','image/webp'].includes(file.mimetype));
    }
});

app.use(express.static('public'));
app.use(express.json());

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

        // Admin kodu kontrolu
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

// Foto mesaj
app.post('/api/foto', upload.single('foto'), (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yuklenemedi' });
    res.json({ url: '/uploads/' + req.file.filename });
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
let aktifKullanicilar = {}; // socketId -> { kullanici, odaAdi }
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
        zaman: new Date(m.zaman * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        okundu: false
    };
}

function socketBul(kullaniciId) {
    return Object.entries(aktifKullanicilar).find(([, v]) => v.kullanici.id === kullaniciId);
}

// ==================== SOCKET.IO ====================

io.on('connection', async (socket) => {
    const ben = socket.kullanici;
    console.log('Baglandi:', ben.ad, '(' + ben.rol + ')');

    if (!engellemeler[ben.id]) engellemeler[ben.id] = new Set();

    // Baglananı hemen kaydet (oda girmeden de gorunsun)
    aktifKullanicilar[socket.id] = { kullanici: ben, odaAdi: null };

    // Oda listesini gonder
    const odalar = await db.odalariGetir();
    socket.emit('odalar-listesi', odalar);
    
    // Herkese yeni kullaniciyi bildir
    socket.broadcast.emit('kullanici-katildi-oda', { kullanici: ben, odaAdi: null });

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

        // Odadaki kullanicilari gonder
        const odadakiler = Object.values(aktifKullanicilar)
            .filter(k => k.odaAdi === odaAdi)
            .map(k => k.kullanici)
            .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
        socket.emit('oda-kullanicilari', odadakiler);

        // Tum aktif kullanicilari gonder
        const tumKullanicilar = Object.values(aktifKullanicilar)
            .map(k => k.kullanici)
            .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)
            .filter(k => k.id !== ben.id);
        socket.emit('kullanici-listesi', tumKullanicilar);
        socket.broadcast.emit('kullanici-katildi-oda', { kullanici: ben, odaAdi });

        // Gecmis mesajlar
        const odaObj = odalar.find(o => o.ad === odaAdi);
        if (odaObj) {
            const gecmis = await db.odaMesajlariGetir(odaObj.id, 50);
            socket.emit('oda-gecmis', { odaAdi, mesajlar: gecmis.map(mesajFormat) });
        }
    });

    // ---- ODA MESAJI ----
    socket.on('oda-mesaj', async ({ odaAdi, metin, foto }) => {
        if (!metin?.trim() && !foto) return;
        const odaList = await db.odalariGetir();
        const odaObj = odaList.find(o => o.ad === odaAdi);
        if (!odaObj) return;

        const mesajId = uuidv4();
        await db.mesajKaydet({
            id: mesajId, odaId: odaObj.id,
            gonderenId: ben.id,
            metin: (metin || '').trim().slice(0, 2000),
            fotoUrl: foto || null, tip: 'mesaj'
        });

        io.to(odaAdi).emit('oda-mesaj', {
            odaAdi,
            mesaj: {
                id: mesajId, tip: 'mesaj',
                gonderenId: ben.id, gonderenAd: ben.ad, gonderenAvatar: ben.avatarUrl,
                metin: (metin || '').trim().slice(0, 2000),
                foto: foto || null, zaman: zamanStr(), okundu: false
            }
        });
    });

    // ---- ÖZEL MESAJ ----
    socket.on('ozel-mesaj', async ({ aliciId, metin, foto }) => {
        if (!metin?.trim() && !foto) return;
        if (engellemeler[aliciId]?.has(ben.id)) { socket.emit('engel-uyarisi', 'Bu kullanıcı sizi engelledi.'); return; }
        if (engellemeler[ben.id]?.has(aliciId)) { socket.emit('engel-uyarisi', 'Bu kullanıcıyı engellediniz.'); return; }

        const dmKey = [ben.id, aliciId].sort().join('_');
        const mesajId = uuidv4();
        await db.mesajKaydet({
            id: mesajId, dmKey,
            gonderenId: ben.id,
            metin: (metin || '').trim().slice(0, 2000),
            fotoUrl: foto || null, tip: 'ozel'
        });

        const gonder = {
            id: mesajId, tip: 'ozel',
            gonderenId: ben.id, gonderenAd: ben.ad, gonderenAvatar: ben.avatarUrl,
            aliciId, metin: (metin || '').trim().slice(0, 2000),
            foto: foto || null, zaman: zamanStr(), okundu: false
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
    socket.on('yaziyor-basladi', ({ tip, odaAdi, aliciId }) => {
        if (tip === 'oda') socket.to(odaAdi).emit('yaziyor-oda', { id: ben.id, ad: ben.ad, odaAdi });
        else if (aliciId) { const s = socketBul(aliciId); if (s) io.to(s[0]).emit('yaziyor-ozel', { id: ben.id, ad: ben.ad }); }
    });
    socket.on('yaziyor-bitti', ({ tip, odaAdi, aliciId }) => {
        if (tip === 'oda') socket.to(odaAdi).emit('yazmayi-bitti-oda', { id: ben.id, odaAdi });
        else if (aliciId) { const s = socketBul(aliciId); if (s) io.to(s[0]).emit('yazmayi-bitti-ozel', ben.id); }
    });

    // ---- ENGELLE ----
    socket.on('engelle', (id) => { engellemeler[ben.id].add(id); socket.emit('engel-basarili', id); });
    socket.on('engel-kaldir', (id) => { engellemeler[ben.id]?.delete(id); socket.emit('engel-kaldirildi', id); });

    // ======== ADMİN ========

    socket.on('admin-banla', async ({ hedefId, sebep, sureDk }) => {
        if (ben.rol !== 'admin') return;
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
        if (ben.rol !== 'admin') return;
        await db.banKaldir(hedefId);
        socket.emit('admin-islem-tamam', 'Ban kaldırıldı!');
    });

    socket.on('admin-oda-temizle', async (odaAdi) => {
        if (ben.rol !== 'admin') return;
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
        if (ben.rol !== 'admin') return;
        const liste = await db.banListesi();
        socket.emit('admin-ban-listesi', liste);
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

// Her 5 dk suresi biten banlari temizle
setInterval(async () => { await db.suresiBitenBanlariTemizle(); }, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('✅ BOOM Chat: http://localhost:' + PORT));
