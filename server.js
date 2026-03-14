const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Hem avatar hem fotoğraf mesajı için aynı multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
        cb(null, allowed.includes(file.mimetype));
    }
});

app.use(express.static('public'));
app.use(express.json());

// Avatar yükle
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yuklenemedi' });
    res.json({ url: '/uploads/' + req.file.filename });
});

// Mesaj fotoğrafı yükle
app.post('/upload-foto', upload.single('foto'), (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yuklenemedi' });
    res.json({ url: '/uploads/' + req.file.filename });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- VERİ ----
let kullanicilar  = {};   // id -> { id, ad, avatarUrl }
let kullaniciIsimleri = new Set();
let genelMesajlar = [];   // son 100
let ozelMesajlar  = {};   // key -> []
let engellemeler  = {};   // id -> Set
// Okundu takibi: mesajId -> Set(okuyanId)
let mesajOkumalar = {};

function chatKey(a, b) { return [a, b].sort().join('_'); }
function zamanStr() {
    return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

io.on('connection', (socket) => {
    console.log('Baglandi:', socket.id);

    // 1) GİRİŞ
    socket.on('yeni-kullanici', ({ ad, avatarUrl }) => {
        if (!ad || !ad.trim()) { socket.emit('isim-hatasi', 'Kullanici adi bos olamaz!'); return; }
        const temizAd = ad.trim().slice(0, 20);
        if (kullaniciIsimleri.has(temizAd.toLowerCase())) {
            socket.emit('isim-hatasi', 'Bu kullanici adi zaten kullaniliyor!'); return;
        }
        const kullanici = { id: socket.id, ad: temizAd, avatarUrl: avatarUrl || null };
        kullanicilar[socket.id] = kullanici;
        kullaniciIsimleri.add(temizAd.toLowerCase());
        engellemeler[socket.id] = new Set();

        socket.emit('giris-basarili', kullanici);
        socket.emit('kullanici-listesi', Object.values(kullanicilar).filter(k => k.id !== socket.id));
        socket.emit('gecmis-mesajlar', genelMesajlar.slice(-50));
        socket.broadcast.emit('yeni-kullanici-katildi', kullanici);

        const sist = { id: uuidv4(), tip: 'sistem', metin: temizAd + ' sohbete katildi', zaman: zamanStr() };
        genelMesajlar.push(sist);
        if (genelMesajlar.length > 100) genelMesajlar.shift();
        io.emit('genel-mesaj', sist);
    });

    // 2) GENEL MESAJ (metin veya fotoğraf)
    socket.on('genel-mesaj', (data) => {
        const g = kullanicilar[socket.id];
        if (!g) return;
        // data: string (eski) veya { metin, foto }
        const metin = typeof data === 'string' ? data : (data.metin || '');
        const foto  = typeof data === 'object' ? (data.foto || null) : null;
        if (!metin.trim() && !foto) return;

        const mesaj = {
            id: uuidv4(), tip: 'genel',
            gonderenId: socket.id, gonderenAd: g.ad, gonderenAvatar: g.avatarUrl,
            metin: metin.trim().slice(0, 1000),
            foto: foto || null,
            zaman: zamanStr()
        };
        genelMesajlar.push(mesaj);
        if (genelMesajlar.length > 100) genelMesajlar.shift();
        io.emit('genel-mesaj', mesaj);
    });

    // 3) ÖZEL MESAJ (metin veya fotoğraf)
    socket.on('ozel-mesaj', ({ aliciId, metin, foto }) => {
        const g = kullanicilar[socket.id];
        const a = kullanicilar[aliciId];
        if (!g || !a) return;
        if (!metin?.trim() && !foto) return;
        if (engellemeler[aliciId]?.has(socket.id)) { socket.emit('engel-uyarisi', 'Bu kullanici sizi engelledi.'); return; }
        if (engellemeler[socket.id]?.has(aliciId)) { socket.emit('engel-uyarisi', 'Bu kullaniciyi engellediniz.'); return; }

        const key = chatKey(socket.id, aliciId);
        if (!ozelMesajlar[key]) ozelMesajlar[key] = [];

        const mesaj = {
            id: uuidv4(), tip: 'ozel',
            gonderenId: socket.id, gonderenAd: g.ad, gonderenAvatar: g.avatarUrl,
            aliciId,
            metin: (metin || '').trim().slice(0, 1000),
            foto: foto || null,
            zaman: zamanStr(),
            okundu: false   // <-- okundu takibi
        };
        ozelMesajlar[key].push(mesaj);
        if (ozelMesajlar[key].length > 200) ozelMesajlar[key].shift();
        mesajOkumalar[mesaj.id] = new Set([socket.id]); // gönderen zaten "okudu"

        io.to(socket.id).emit('ozel-mesaj', mesaj);
        io.to(aliciId).emit('ozel-mesaj', mesaj);
    });

    // 4) OKUNDU BİLDİRİMİ — alıcı mesajı gördüğünde
    socket.on('mesaj-goruldu', ({ mesajId, gonderenId }) => {
        if (!mesajOkumalar[mesajId]) mesajOkumalar[mesajId] = new Set();
        mesajOkumalar[mesajId].add(socket.id);
        // Gönderene "görüldü" bildir
        io.to(gonderenId).emit('mesaj-goruldu-bildir', { mesajId, okuyanId: socket.id });
        // Mesaj objesini de güncelle
        const key = chatKey(socket.id, gonderenId);
        if (ozelMesajlar[key]) {
            const m = ozelMesajlar[key].find(x => x.id === mesajId);
            if (m) m.okundu = true;
        }
    });

    // 5) GEÇMİŞ
    socket.on('gecmis-iste', (karsiId) => {
        const key = chatKey(socket.id, karsiId);
        socket.emit('ozel-gecmis', { karsiId, mesajlar: (ozelMesajlar[key] || []).slice(-50) });
    });

    // 6) ENGELLE / KALDIR
    socket.on('engelle', (hedefId) => {
        if (!kullanicilar[hedefId]) return;
        engellemeler[socket.id].add(hedefId);
        socket.emit('engel-basarili', hedefId);
    });
    socket.on('engel-kaldir', (hedefId) => {
        engellemeler[socket.id]?.delete(hedefId);
        socket.emit('engel-kaldirildi', hedefId);
    });

    // 7) YAZIYOR
    socket.on('yaziyor-basladi', ({ tip, aliciId }) => {
        const g = kullanicilar[socket.id]; if (!g) return;
        if (tip === 'genel') socket.broadcast.emit('yaziyor-genel', { id: socket.id, ad: g.ad });
        else if (aliciId) io.to(aliciId).emit('yaziyor-ozel', { id: socket.id, ad: g.ad });
    });
    socket.on('yaziyor-bitti', ({ tip, aliciId }) => {
        if (tip === 'genel') socket.broadcast.emit('yazmayi-bitti-genel', socket.id);
        else if (aliciId) io.to(aliciId).emit('yazmayi-bitti-ozel', socket.id);
    });

    // 8) AYRILMA
    socket.on('disconnect', () => {
        const k = kullanicilar[socket.id];
        if (k) {
            kullaniciIsimleri.delete(k.ad.toLowerCase());
            delete kullanicilar[socket.id];
            delete engellemeler[socket.id];
            io.emit('kullanici-ayrildi', socket.id);
            const sist = { id: uuidv4(), tip: 'sistem', metin: k.ad + ' ayrildi', zaman: zamanStr() };
            genelMesajlar.push(sist);
            if (genelMesajlar.length > 100) genelMesajlar.shift();
            io.emit('genel-mesaj', sist);
        }
        console.log('Ayrildi:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('✅ BOOM Chat calisiyor: http://localhost:' + PORT));