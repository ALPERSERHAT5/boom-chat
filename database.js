// ==================== BOOM CHAT v4 — database.js (DÜZELTİLMİŞ) ====================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database(path.join(__dirname, 'boom-chat.db'));

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ==================== TABLOLARI OLUSTUR ====================

async function sosyalTabloOlustur() {
    await run(`CREATE TABLE IF NOT EXISTS gonderiler (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        kullanici_id INTEGER NOT NULL,
        metin       TEXT DEFAULT '',
        medya_url   TEXT,
        medya_tip   TEXT DEFAULT 'metin',
        begeni_sayisi INTEGER DEFAULT 0,
        yorum_sayisi INTEGER DEFAULT 0,
        olusturma   INTEGER DEFAULT (strftime('%s','now')),
        silindi     INTEGER DEFAULT 0,
        FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS begeniler (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        gonderi_id  INTEGER NOT NULL,
        kullanici_id INTEGER NOT NULL,
        olusturma   INTEGER DEFAULT (strftime('%s','now')),
        UNIQUE(gonderi_id, kullanici_id),
        FOREIGN KEY (gonderi_id) REFERENCES gonderiler(id),
        FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS takip (
        takip_eden_id INTEGER NOT NULL,
        takip_edilen_id INTEGER NOT NULL,
        olusturma   INTEGER DEFAULT (strftime('%s','now')),
        PRIMARY KEY (takip_eden_id, takip_edilen_id),
        FOREIGN KEY (takip_eden_id) REFERENCES kullanicilar(id),
        FOREIGN KEY (takip_edilen_id) REFERENCES kullanicilar(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS yorumlar (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        gonderi_id  INTEGER NOT NULL,
        kullanici_id INTEGER NOT NULL,
        metin       TEXT NOT NULL,
        olusturma   INTEGER DEFAULT (strftime('%s','now')),
        silindi     INTEGER DEFAULT 0,
        FOREIGN KEY (gonderi_id) REFERENCES gonderiler(id),
        FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS reels (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        kullanici_id INTEGER NOT NULL,
        video_url    TEXT NOT NULL,
        aciklama     TEXT DEFAULT '',
        begeni_sayisi INTEGER DEFAULT 0,
        yorum_sayisi INTEGER DEFAULT 0,
        olusturma    INTEGER DEFAULT (strftime('%s','now')),
        silindi      INTEGER DEFAULT 0,
        FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS reel_begeniler (
        reel_id      INTEGER NOT NULL,
        kullanici_id INTEGER NOT NULL,
        olusturma    INTEGER DEFAULT (strftime('%s','now')),
        PRIMARY KEY (reel_id, kullanici_id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS reel_yorumlar (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        reel_id      INTEGER NOT NULL,
        kullanici_id INTEGER NOT NULL,
        metin        TEXT NOT NULL,
        olusturma    INTEGER DEFAULT (strftime('%s','now')),
        silindi      INTEGER DEFAULT 0
    )`);


    // ==================== STORY TABLOSU ====================
    await run(`CREATE TABLE IF NOT EXISTS storyler (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        kullanici_id INTEGER NOT NULL,
        medya_url    TEXT NOT NULL,
        medya_tip    TEXT DEFAULT 'foto',
        metin        TEXT DEFAULT '',
        sure_sn      INTEGER DEFAULT 86400,
        olusturma    INTEGER DEFAULT (strftime('%s','now')),
        bitis        INTEGER,
        silindi      INTEGER DEFAULT 0,
        FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS story_goruntulemeler (
        story_id     INTEGER NOT NULL,
        kullanici_id INTEGER NOT NULL,
        zaman        INTEGER DEFAULT (strftime('%s','now')),
        PRIMARY KEY (story_id, kullanici_id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS story_begeniler (
        story_id     INTEGER NOT NULL,
        kullanici_id INTEGER NOT NULL,
        zaman        INTEGER DEFAULT (strftime('%s','now')),
        PRIMARY KEY (story_id, kullanici_id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS story_yorumlar (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id     INTEGER NOT NULL,
        kullanici_id INTEGER NOT NULL,
        metin        TEXT NOT NULL,
        olusturma    INTEGER DEFAULT (strftime('%s','now'))
    )`);

}

async function tablolariOlustur() {
    await run(`CREATE TABLE IF NOT EXISTS kullanicilar (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        kullanici_adi TEXT UNIQUE NOT NULL COLLATE NOCASE,
        sifre_hash    TEXT NOT NULL,
        avatar_url    TEXT,
        bio           TEXT DEFAULT '',
        rol           TEXT DEFAULT 'uye',
        olusturma     INTEGER DEFAULT (strftime('%s','now')),
        son_giris     INTEGER
    )`);

    try { await run(`ALTER TABLE kullanicilar ADD COLUMN bio TEXT DEFAULT ''`); } catch (e) { }

    await run(`CREATE TABLE IF NOT EXISTS odalar (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ad          TEXT UNIQUE NOT NULL,
        aciklama    TEXT DEFAULT '',
        olusturan   INTEGER,
        olusturma   INTEGER DEFAULT (strftime('%s','now')),
        aktif       INTEGER DEFAULT 1
    )`);

    await run(`CREATE TABLE IF NOT EXISTS mesajlar (
        id          TEXT PRIMARY KEY,
        oda_id      INTEGER,
        dm_key      TEXT,
        grup_id     INTEGER,
        gonderen_id INTEGER NOT NULL,
        metin       TEXT DEFAULT '',
        foto_url    TEXT,
        dosya_ad    TEXT,
        dosya_boyut INTEGER,
        tip         TEXT DEFAULT 'mesaj',
        zaman       INTEGER DEFAULT (strftime('%s','now')),
        silindi     INTEGER DEFAULT 0
    )`);

    try { await run(`ALTER TABLE mesajlar ADD COLUMN grup_id INTEGER`); } catch (e) { }
    try { await run(`ALTER TABLE mesajlar ADD COLUMN dosya_ad TEXT`); } catch (e) { }
    try { await run(`ALTER TABLE mesajlar ADD COLUMN dosya_boyut INTEGER`); } catch (e) { }

    await run(`CREATE TABLE IF NOT EXISTS okundu (
        mesaj_id     TEXT NOT NULL,
        kullanici_id INTEGER NOT NULL,
        PRIMARY KEY (mesaj_id, kullanici_id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS banlar (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        kullanici_id INTEGER NOT NULL,
        admin_id     INTEGER NOT NULL,
        sebep        TEXT DEFAULT '',
        sure_dk      INTEGER DEFAULT 0,
        bitis_zaman  INTEGER,
        aktif        INTEGER DEFAULT 1,
        olusturma    INTEGER DEFAULT (strftime('%s','now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS gruplar (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ad          TEXT NOT NULL,
        olusturan_id INTEGER NOT NULL,
        olusturma   INTEGER DEFAULT (strftime('%s','now')),
        aktif       INTEGER DEFAULT 1
    )`);

    await run(`CREATE TABLE IF NOT EXISTS grup_uyeler (
        grup_id      INTEGER NOT NULL,
        kullanici_id INTEGER NOT NULL,
        katilma      INTEGER DEFAULT (strftime('%s','now')),
        PRIMARY KEY (grup_id, kullanici_id)
    )`);

    await run(`INSERT OR IGNORE INTO odalar (ad, aciklama) VALUES ('genel', 'Genel sohbet')`);
    await run(`INSERT OR IGNORE INTO odalar (ad, aciklama) VALUES ('tanitim', 'Tanışma odası')`);

    await run(`CREATE TABLE IF NOT EXISTS bot_ayarlar (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      INTEGER NOT NULL,
    tip         TEXT NOT NULL,
    aktif       INTEGER DEFAULT 1,
    mesaj       TEXT DEFAULT '',
    sure_dk     INTEGER DEFAULT 30,
    odalar      TEXT DEFAULT '',
    olusturma   INTEGER DEFAULT (strftime('%s','now'))
)`);

    await run(`CREATE TABLE IF NOT EXISTS bot_konusmalar (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id       INTEGER NOT NULL,
    kullanici_id INTEGER NOT NULL,
    mesaj        TEXT NOT NULL,
    gonderen     TEXT NOT NULL,
    zaman        INTEGER DEFAULT (strftime('%s','now'))
)`);
    await sosyalTabloOlustur();

    console.log('✅ Veritabanı hazır (v4 + Story + Reels Düzeltildi)');
}

tablolariOlustur().catch(console.error);

// ==================== KULLANICI ====================

async function kullaniciKaydet(kullaniciAdi, sifre, avatarUrl) {
    const hash = bcrypt.hashSync(sifre, 10);
    try {
        const result = await run(
            `INSERT INTO kullanicilar (kullanici_adi, sifre_hash, avatar_url) VALUES (?, ?, ?)`,
            [kullaniciAdi, hash, avatarUrl || null]
        );
        return { basarili: true, id: result.lastID };
    } catch (e) {
        if (e.message.includes('UNIQUE')) return { basarili: false, hata: 'Bu kullanıcı adı zaten kullanılıyor!' };
        return { basarili: false, hata: 'Kayıt hatası.' };
    }
}

async function kullaniciGiris(kullaniciAdi, sifre) {
    const k = await get('SELECT * FROM kullanicilar WHERE kullanici_adi = ? COLLATE NOCASE', [kullaniciAdi]);
    if (!k) return { basarili: false, hata: 'Kullanıcı adı veya şifre hatalı!' };
    if (!bcrypt.compareSync(sifre, k.sifre_hash)) return { basarili: false, hata: 'Kullanıcı adı veya şifre hatalı!' };
    await run('UPDATE kullanicilar SET son_giris = strftime(\'%s\',\'now\') WHERE id = ?', [k.id]);
    return { basarili: true, kullanici: { id: k.id, ad: k.kullanici_adi, avatarUrl: k.avatar_url, bio: k.bio || '', rol: k.rol } };
}

async function kullaniciBul(id) {
    const k = await get('SELECT id, kullanici_adi, avatar_url, bio, rol FROM kullanicilar WHERE id = ?', [id]);
    if (!k) return null;
    return { id: k.id, ad: k.kullanici_adi, avatarUrl: k.avatar_url, bio: k.bio || '', rol: k.rol };
}

async function tumKullanicilariGetir() {
    return await all(`
        SELECT k.id, k.kullanici_adi, k.avatar_url, k.bio, k.rol, k.olusturma, k.son_giris,
               CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END as banli,
               b.sebep as ban_sebep
        FROM kullanicilar k
        LEFT JOIN banlar b ON b.kullanici_id = k.id AND b.aktif = 1 
            AND (b.bitis_zaman IS NULL OR b.bitis_zaman > strftime('%s','now'))
        ORDER BY k.olusturma DESC
    `);
}

async function kullaniciSil(id) {
    await run('DELETE FROM kullanicilar WHERE id = ?', [id]);
    await run('DELETE FROM mesajlar WHERE gonderen_id = ?', [id]);
    await run('DELETE FROM banlar WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM grup_uyeler WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM gonderiler WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM yorumlar WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM begeniler WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM takip WHERE takip_eden_id = ? OR takip_edilen_id = ?', [id, id]);
    await run('DELETE FROM storyler WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM story_goruntulemeler WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM story_begeniler WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM story_yorumlar WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM reels WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM reel_begeniler WHERE kullanici_id = ?', [id]);
    await run('DELETE FROM reel_yorumlar WHERE kullanici_id = ?', [id]);
}

async function sifreSifirla(id, yeniSifre) {
    const hash = bcrypt.hashSync(yeniSifre, 10);
    await run('UPDATE kullanicilar SET sifre_hash = ? WHERE id = ?', [hash, id]);
}

async function rolGuncelle(kullaniciId, rol) {
    await run('UPDATE kullanicilar SET rol = ? WHERE id = ?', [rol, kullaniciId]);
}

async function profilGuncelle(id, avatarUrl, bio) {
    if (avatarUrl) {
        await run('UPDATE kullanicilar SET avatar_url = ?, bio = ? WHERE id = ?', [avatarUrl, bio, id]);
    } else {
        await run('UPDATE kullanicilar SET bio = ? WHERE id = ?', [bio, id]);
    }
}

// ==================== ODALAR ====================

async function odalariGetir() {
    return await all('SELECT * FROM odalar WHERE aktif = 1 ORDER BY id');
}

async function odaOlustur(ad, aciklama, olusturanId) {
    const temizAd = ad.toLowerCase().replace(/\s+/g, '-');
    try {
        const result = await run(
            'INSERT INTO odalar (ad, aciklama, olusturan) VALUES (?, ?, ?)',
            [temizAd, aciklama || '', olusturanId]
        );
        return { basarili: true, id: result.lastID, ad: temizAd };
    } catch (e) {
        if (e.message.includes('UNIQUE')) return { basarili: false, hata: 'Bu oda adı zaten var!' };
        return { basarili: false, hata: 'Oda oluşturulamadı.' };
    }
}

async function odaSil(odaId) {
    await run('UPDATE odalar SET aktif = 0 WHERE id = ?', [odaId]);
}

// ==================== MESAJLAR ====================

async function mesajKaydet(mesaj) {
    await run(
        `INSERT INTO mesajlar (id, oda_id, dm_key, grup_id, gonderen_id, metin, foto_url, dosya_ad, dosya_boyut, tip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mesaj.id, mesaj.odaId || null, mesaj.dmKey || null, mesaj.grupId || null,
        mesaj.gonderenId, mesaj.metin || '', mesaj.fotoUrl || null,
        mesaj.dosyaAd || null, mesaj.dosyaBoyut || null, mesaj.tip || 'mesaj']
    );
}

async function odaMesajlariGetir(odaId, limit = 50) {
    const rows = await all(`
        SELECT m.*, k.kullanici_adi as gonderen_ad, k.avatar_url as gonderen_avatar
        FROM mesajlar m
        JOIN kullanicilar k ON m.gonderen_id = k.id
        WHERE m.oda_id = ? AND m.silindi = 0
        ORDER BY m.zaman DESC LIMIT ?
    `, [odaId, limit]);
    return rows.reverse();
}

async function dmMesajlariGetir(dmKey, limit = 50) {
    const rows = await all(`
        SELECT m.*, k.kullanici_adi as gonderen_ad, k.avatar_url as gonderen_avatar
        FROM mesajlar m
        JOIN kullanicilar k ON m.gonderen_id = k.id
        WHERE m.dm_key = ? AND m.silindi = 0
        ORDER BY m.zaman DESC LIMIT ?
    `, [dmKey, limit]);
    return rows.reverse();
}

async function grupMesajlariGetir(grupId, limit = 50) {
    const rows = await all(`
        SELECT m.*, k.kullanici_adi as gonderen_ad, k.avatar_url as gonderen_avatar
        FROM mesajlar m
        JOIN kullanicilar k ON m.gonderen_id = k.id
        WHERE m.grup_id = ? AND m.silindi = 0
        ORDER BY m.zaman DESC LIMIT ?
    `, [grupId, limit]);
    return rows.reverse();
}

async function odaMesajlariniTemizle(odaId) {
    await run('UPDATE mesajlar SET silindi = 1 WHERE oda_id = ?', [odaId]);
}

async function mesajSil(mesajId) {
    await run('UPDATE mesajlar SET silindi = 1 WHERE id = ?', [mesajId]);
}

async function okunduIsaretle(mesajId, kullaniciId) {
    await run('INSERT OR IGNORE INTO okundu (mesaj_id, kullanici_id) VALUES (?, ?)', [mesajId, kullaniciId]);
}

// ==================== GRUPLAR ====================

async function grupOlustur(ad, olusturanId, uyeIdler) {
    try {
        const result = await run('INSERT INTO gruplar (ad, olusturan_id) VALUES (?, ?)', [ad, olusturanId]);
        const grupId = result.lastID;
        await run('INSERT OR IGNORE INTO grup_uyeler (grup_id, kullanici_id) VALUES (?, ?)', [grupId, olusturanId]);
        for (const uid of uyeIdler) {
            if (uid !== olusturanId) {
                await run('INSERT OR IGNORE INTO grup_uyeler (grup_id, kullanici_id) VALUES (?, ?)', [grupId, uid]);
            }
        }
        return { basarili: true, id: grupId };
    } catch (e) {
        return { basarili: false, hata: 'Grup oluşturulamadı' };
    }
}

async function grupGetir(grupId) {
    const grup = await get('SELECT * FROM gruplar WHERE id = ? AND aktif = 1', [grupId]);
    if (!grup) return null;
    const uyeler = await all(`
        SELECT k.id, k.kullanici_adi as ad, k.avatar_url as avatarUrl, k.rol
        FROM grup_uyeler gu
        JOIN kullanicilar k ON gu.kullanici_id = k.id
        WHERE gu.grup_id = ?
    `, [grupId]);
    return { ...grup, uyeler };
}

async function kullaniciGruplariGetir(kullaniciId) {
    const gruplar = await all(`
        SELECT g.id, g.ad, g.olusturan_id, g.olusturma
        FROM gruplar g
        JOIN grup_uyeler gu ON g.id = gu.grup_id
        WHERE gu.kullanici_id = ? AND g.aktif = 1
        ORDER BY g.olusturma DESC
    `, [kullaniciId]);

    const sonuc = [];
    for (const g of gruplar) {
        const uyeler = await all(`
            SELECT k.id, k.kullanici_adi as ad, k.avatar_url as avatarUrl
            FROM grup_uyeler gu
            JOIN kullanicilar k ON gu.kullanici_id = k.id
            WHERE gu.grup_id = ?
        `, [g.id]);
        sonuc.push({ ...g, uyeler });
    }
    return sonuc;
}

async function tumGruplariGetir() {
    const gruplar = await all('SELECT * FROM gruplar WHERE aktif = 1 ORDER BY olusturma DESC');
    const sonuc = [];
    for (const g of gruplar) {
        const uyeler = await all(`
            SELECT k.id, k.kullanici_adi as ad
            FROM grup_uyeler gu
            JOIN kullanicilar k ON gu.kullanici_id = k.id
            WHERE gu.grup_id = ?
        `, [g.id]);
        sonuc.push({ ...g, uyeler });
    }
    return sonuc;
}

async function grupUyesiMi(grupId, kullaniciId) {
    const row = await get('SELECT 1 FROM grup_uyeler WHERE grup_id = ? AND kullanici_id = ?', [grupId, kullaniciId]);
    return !!row;
}

async function grupUyeEkle(grupId, kullaniciId) {
    await run('INSERT OR IGNORE INTO grup_uyeler (grup_id, kullanici_id) VALUES (?, ?)', [grupId, kullaniciId]);
}

async function grupUyeCikar(grupId, kullaniciId) {
    await run('DELETE FROM grup_uyeler WHERE grup_id = ? AND kullanici_id = ?', [grupId, kullaniciId]);
}

async function grupSil(grupId) {
    await run('UPDATE gruplar SET aktif = 0 WHERE id = ?', [grupId]);
    await run('UPDATE mesajlar SET silindi = 1 WHERE grup_id = ?', [grupId]);
}

// ==================== BAN ====================

async function kullaniciBanla(kullaniciId, adminId, sebep, sureDk) {
    await run('UPDATE banlar SET aktif = 0 WHERE kullanici_id = ?', [kullaniciId]);
    const bitisBefore = sureDk > 0
        ? Math.floor(Date.now() / 1000) + (sureDk * 60)
        : null;
    await run(
        `INSERT INTO banlar (kullanici_id, admin_id, sebep, sure_dk, bitis_zaman) VALUES (?, ?, ?, ?, ?)`,
        [kullaniciId, adminId, sebep || '', sureDk, bitisBefore]
    );
}

async function banKaldir(kullaniciId) {
    await run('UPDATE banlar SET aktif = 0 WHERE kullanici_id = ?', [kullaniciId]);
}

async function banliMi(kullaniciId) {
    const now = Math.floor(Date.now() / 1000);
    return await get(`
        SELECT * FROM banlar
        WHERE kullanici_id = ? AND aktif = 1
        AND (bitis_zaman IS NULL OR bitis_zaman > ?)
    `, [kullaniciId, now]);
}

async function banListesi() {
    const now = Math.floor(Date.now() / 1000);
    return await all(`
        SELECT b.*, k.kullanici_adi, a.kullanici_adi as admin_adi
        FROM banlar b
        JOIN kullanicilar k ON b.kullanici_id = k.id
        JOIN kullanicilar a ON b.admin_id = a.id
        WHERE b.aktif = 1 AND (b.bitis_zaman IS NULL OR b.bitis_zaman > ?)
    `, [now]);
}

async function suresiBitenBanlariTemizle() {
    const now = Math.floor(Date.now() / 1000);
    await run('UPDATE banlar SET aktif = 0 WHERE bitis_zaman IS NOT NULL AND bitis_zaman <= ?', [now]);
}

// ==================== GÖNDERİLER ====================

async function gonderiOlustur(kullaniciId, metin, medyaUrl, medyaTip) {
    const result = await run(
        `INSERT INTO gonderiler (kullanici_id, metin, medya_url, medya_tip) VALUES (?, ?, ?, ?)`,
        [kullaniciId, metin || '', medyaUrl || null, medyaTip || 'metin']
    );
    return result.lastID;
}

async function gonderileriGetir(kullaniciId, sayfa = 0, limit = 20) {
    const rows = await all(`
        SELECT g.*, k.kullanici_adi as kullanici_adi, k.avatar_url as kullanici_avatar, k.rol
        FROM gonderiler g
        JOIN kullanicilar k ON g.kullanici_id = k.id
        WHERE g.silindi = 0 
        AND (g.kullanici_id IN (SELECT takip_edilen_id FROM takip WHERE takip_eden_id = ?) OR g.kullanici_id = ?)
        ORDER BY g.olusturma DESC
        LIMIT ? OFFSET ?
    `, [kullaniciId, kullaniciId, limit, sayfa * limit]);

    for (let row of rows) {
        const begeniKontrol = await get(`SELECT 1 FROM begeniler WHERE gonderi_id = ? AND kullanici_id = ?`, [row.id, kullaniciId]);
        row.begenmisMi = !!begeniKontrol;
    }
    return rows;
}

async function tumGonderileriGetir(kullaniciId, sayfa = 0, limit = 20) {
    const rows = await all(`
        SELECT g.*, k.kullanici_adi as kullanici_adi, k.avatar_url as kullanici_avatar, k.rol
        FROM gonderiler g
        JOIN kullanicilar k ON g.kullanici_id = k.id
        WHERE g.silindi = 0
        ORDER BY g.olusturma DESC
        LIMIT ? OFFSET ?
    `, [limit, sayfa * limit]);

    // Beğeni durumunu da kontrol et
    for (let row of rows) {
        const begeniKontrol = await get(`SELECT 1 FROM begeniler WHERE gonderi_id = ? AND kullanici_id = ?`, [row.id, kullaniciId]);
        row.begenmisMi = !!begeniKontrol;
    }
    return rows;
}

async function gonderiBegen(gonderiId, kullaniciId) {
    try {
        await run(`INSERT INTO begeniler (gonderi_id, kullanici_id) VALUES (?, ?)`, [gonderiId, kullaniciId]);
        await run(`UPDATE gonderiler SET begeni_sayisi = begeni_sayisi + 1 WHERE id = ?`, [gonderiId]);
        return true;
    } catch (e) { return false; }
}

async function gonderiBegenKaldir(gonderiId, kullaniciId) {
    await run(`DELETE FROM begeniler WHERE gonderi_id = ? AND kullanici_id = ?`, [gonderiId, kullaniciId]);
    await run(`UPDATE gonderiler SET begeni_sayisi = begeni_sayisi - 1 WHERE id = ? AND begeni_sayisi > 0`, [gonderiId]);
}

async function gonderiSil(gonderiId, kullaniciId, isAdmin = false) {
    const gonderi = await get(`SELECT kullanici_id FROM gonderiler WHERE id = ?`, [gonderiId]);
    if (!gonderi) return false;
    if (gonderi.kullanici_id !== kullaniciId && !isAdmin) return false;
    await run(`UPDATE gonderiler SET silindi = 1 WHERE id = ?`, [gonderiId]);
    return true;
}

// ==================== YORUMLAR ====================

async function yorumEkle(gonderiId, kullaniciId, metin) {
    const result = await run(
        `INSERT INTO yorumlar (gonderi_id, kullanici_id, metin) VALUES (?, ?, ?)`,
        [gonderiId, kullaniciId, metin]
    );
    await run(`UPDATE gonderiler SET yorum_sayisi = yorum_sayisi + 1 WHERE id = ?`, [gonderiId]);

    const yorum = await get(`
        SELECT y.*, k.kullanici_adi, k.avatar_url 
        FROM yorumlar y 
        JOIN kullanicilar k ON y.kullanici_id = k.id 
        WHERE y.id = ?
    `, [result.lastID]);
    return yorum;
}

async function yorumlariGetir(gonderiId, limit = 20) {
    return await all(`
        SELECT y.*, k.kullanici_adi, k.avatar_url 
        FROM yorumlar y 
        JOIN kullanicilar k ON y.kullanici_id = k.id 
        WHERE y.gonderi_id = ? AND y.silindi = 0
        ORDER BY y.olusturma ASC
        LIMIT ?
    `, [gonderiId, limit]);
}

async function yorumSil(yorumId, kullaniciId, isAdmin = false) {
    const yorum = await get(`SELECT kullanici_id, gonderi_id FROM yorumlar WHERE id = ?`, [yorumId]);
    if (!yorum) return false;
    if (yorum.kullanici_id !== kullaniciId && !isAdmin) return false;
    await run(`UPDATE yorumlar SET silindi = 1 WHERE id = ?`, [yorumId]);
    await run(`UPDATE gonderiler SET yorum_sayisi = yorum_sayisi - 1 WHERE id = ? AND yorum_sayisi > 0`, [yorum.gonderi_id]);
    return true;
}

// ==================== TAKİP ====================

async function takipEt(takipEdenId, takipEdilenId) {
    if (takipEdenId === takipEdilenId) return false;
    try {
        await run(`INSERT INTO takip (takip_eden_id, takip_edilen_id) VALUES (?, ?)`, [takipEdenId, takipEdilenId]);
        return true;
    } catch (e) { return false; }
}

async function takipBirak(takipEdenId, takipEdilenId) {
    await run(`DELETE FROM takip WHERE takip_eden_id = ? AND takip_edilen_id = ?`, [takipEdenId, takipEdilenId]);
}

async function takipDurumu(takipEdenId, takipEdilenId) {
    const row = await get(`SELECT 1 FROM takip WHERE takip_eden_id = ? AND takip_edilen_id = ?`, [takipEdenId, takipEdilenId]);
    return !!row;
}

async function takipciSayisi(kullaniciId) {
    const row = await get(`SELECT COUNT(*) as sayi FROM takip WHERE takip_edilen_id = ?`, [kullaniciId]);
    return row.sayi;
}

async function takipEdilenSayisi(kullaniciId) {
    const row = await get(`SELECT COUNT(*) as sayi FROM takip WHERE takip_eden_id = ?`, [kullaniciId]);
    return row.sayi;
}

async function profilBilgileriGetir(kullaniciId, mevcutKullaniciId) {
    const kullanici = await get(`SELECT id, kullanici_adi, avatar_url, bio, rol, olusturma FROM kullanicilar WHERE id = ?`, [kullaniciId]);
    if (!kullanici) return null;
    const takipEdiyorMu = await takipDurumu(mevcutKullaniciId, kullaniciId);
    const takipciSay = await takipciSayisi(kullaniciId);
    const takipEdilenSay = await takipEdilenSayisi(kullaniciId);

    return {
        ...kullanici,
        takipEdiyorMu,
        takipciSayisi: takipciSay,
        takipEdilenSayisi: takipEdilenSay
    };
}

// ==================== STORYLER ====================

async function storyOlustur(kullaniciId, medyaUrl, medyaTip, metin, sureSn) {
    const sure = sureSn || 86400;
    const bitis = Math.floor(Date.now() / 1000) + sure;
    const result = await run(
        `INSERT INTO storyler (kullanici_id, medya_url, medya_tip, metin, sure_sn, bitis) VALUES (?, ?, ?, ?, ?, ?)`,
        [kullaniciId, medyaUrl, medyaTip || 'foto', metin || '', sure, bitis]
    );
    return result.lastID;
}

async function aktifStoryleriGetir(kullaniciId) {
    const now = Math.floor(Date.now() / 1000);
    const rows = await all(`
        SELECT s.*, k.kullanici_adi, k.avatar_url,
               CASE WHEN sg.story_id IS NOT NULL THEN 1 ELSE 0 END as goruldu,
               CASE WHEN sb.story_id IS NOT NULL THEN 1 ELSE 0 END as begenildi,
               (SELECT COUNT(*) FROM story_begeniler WHERE story_id = s.id) as begeni_sayisi,
               (SELECT COUNT(*) FROM story_yorumlar WHERE story_id = s.id) as yorum_sayisi
        FROM storyler s
        JOIN kullanicilar k ON s.kullanici_id = k.id
        LEFT JOIN story_goruntulemeler sg ON sg.story_id = s.id AND sg.kullanici_id = ?
        LEFT JOIN story_begeniler sb ON sb.story_id = s.id AND sb.kullanici_id = ?
        WHERE s.silindi = 0 AND s.bitis > ?
        AND (
            s.kullanici_id = ?
            OR s.kullanici_id IN (SELECT takip_edilen_id FROM takip WHERE takip_eden_id = ?)
        )
        ORDER BY s.kullanici_id, s.olusturma ASC
    `, [kullaniciId, kullaniciId, now, kullaniciId, kullaniciId]);
    return rows;
}

async function kullaniciStoryleriGetir(kullaniciId, mevcutKullaniciId) {
    const now = Math.floor(Date.now() / 1000);
    return await all(`
        SELECT s.*,
               CASE WHEN sg.story_id IS NOT NULL THEN 1 ELSE 0 END as goruldu,
               CASE WHEN sb.story_id IS NOT NULL THEN 1 ELSE 0 END as begenildi,
               (SELECT COUNT(*) FROM story_begeniler WHERE story_id = s.id) as begeni_sayisi,
               (SELECT COUNT(*) FROM story_yorumlar WHERE story_id = s.id) as yorum_sayisi
        FROM storyler s
        LEFT JOIN story_goruntulemeler sg ON sg.story_id = s.id AND sg.kullanici_id = ?
        LEFT JOIN story_begeniler sb ON sb.story_id = s.id AND sb.kullanici_id = ?
        WHERE s.kullanici_id = ? AND s.silindi = 0 AND s.bitis > ?
        ORDER BY s.olusturma ASC
    `, [mevcutKullaniciId, mevcutKullaniciId, kullaniciId, now]);
}

async function storyGoruntule(storyId, kullaniciId) {
    await run(`INSERT OR IGNORE INTO story_goruntulemeler (story_id, kullanici_id) VALUES (?, ?)`, [storyId, kullaniciId]);
}

async function storyBegen(storyId, kullaniciId) {
    try {
        await run(`INSERT INTO story_begeniler (story_id, kullanici_id) VALUES (?, ?)`, [storyId, kullaniciId]);
        return true;
    } catch (e) { return false; }
}

async function storyBegenKaldir(storyId, kullaniciId) {
    await run(`DELETE FROM story_begeniler WHERE story_id = ? AND kullanici_id = ?`, [storyId, kullaniciId]);
}

async function storyYorumEkle(storyId, kullaniciId, metin) {
    const result = await run(
        `INSERT INTO story_yorumlar (story_id, kullanici_id, metin) VALUES (?, ?, ?)`,
        [storyId, kullaniciId, metin]
    );
    const yorum = await get(`
        SELECT sy.*, k.kullanici_adi, k.avatar_url
        FROM story_yorumlar sy
        JOIN kullanicilar k ON sy.kullanici_id = k.id
        WHERE sy.id = ?
    `, [result.lastID]);
    return yorum;
}

async function storyYorumlariGetir(storyId) {
    return await all(`
        SELECT sy.*, k.kullanici_adi, k.avatar_url
        FROM story_yorumlar sy
        JOIN kullanicilar k ON sy.kullanici_id = k.id
        WHERE sy.story_id = ?
        ORDER BY sy.olusturma ASC
    `, [storyId]);
}

async function storySil(storyId, kullaniciId, isAdmin = false) {
    const story = await get(`SELECT kullanici_id FROM storyler WHERE id = ?`, [storyId]);
    if (!story) return false;
    if (story.kullanici_id !== kullaniciId && !isAdmin) return false;
    await run(`UPDATE storyler SET silindi = 1 WHERE id = ?`, [storyId]);
    return true;
}

async function suresiBitenStoryleriTemizle() {
    const now = Math.floor(Date.now() / 1000);
    await run(`UPDATE storyler SET silindi = 1 WHERE bitis <= ? AND silindi = 0`, [now]);
}

// ==================== DÜZELTME: Tüm aktif storyli kullanıcıları getir ====================
// Artık sadece takip edilenleri değil, tüm aktif storyli kullanıcıları göster
async function storyKullanicilariGetir(kullaniciId) {
    const now = Math.floor(Date.now() / 1000);
    const rows = await all(`
        SELECT DISTINCT s.kullanici_id, k.kullanici_adi, k.avatar_url,
               COUNT(s.id) as story_sayisi,
               MAX(s.olusturma) as son_story,
               SUM(CASE WHEN sg.story_id IS NULL THEN 1 ELSE 0 END) as goruulmemis
        FROM storyler s
        JOIN kullanicilar k ON s.kullanici_id = k.id
        LEFT JOIN story_goruntulemeler sg ON sg.story_id = s.id AND sg.kullanici_id = ?
        WHERE s.silindi = 0 AND s.bitis > ?
        GROUP BY s.kullanici_id
        ORDER BY 
            CASE WHEN s.kullanici_id = ? THEN 0 ELSE 1 END,
            goruulmemis DESC,
            son_story DESC
    `, [kullaniciId, now, kullaniciId]);
    return rows;
}

// ==================== REELS ====================

async function reelOlustur(kullaniciId, videoUrl, aciklama) {
    const result = await run(
        `INSERT INTO reels (kullanici_id, video_url, aciklama) VALUES (?, ?, ?)`,
        [kullaniciId, videoUrl, aciklama || '']
    );
    return result.lastID;
}

async function reellerGetir(kullaniciId, sayfa = 0, limit = 10) {
    const rows = await all(`
        SELECT r.*, k.kullanici_adi, k.avatar_url as kullanici_avatar, k.rol,
               CASE WHEN rb.reel_id IS NOT NULL THEN 1 ELSE 0 END as begenildi
        FROM reels r
        JOIN kullanicilar k ON r.kullanici_id = k.id
        LEFT JOIN reel_begeniler rb ON rb.reel_id = r.id AND rb.kullanici_id = ?
        WHERE r.silindi = 0
        ORDER BY r.olusturma DESC
        LIMIT ? OFFSET ?
    `, [kullaniciId, limit, sayfa * limit]);
    return rows;
}

async function reelBegen(reelId, kullaniciId) {
    try {
        await run(`INSERT INTO reel_begeniler (reel_id, kullanici_id) VALUES (?, ?)`, [reelId, kullaniciId]);
        await run(`UPDATE reels SET begeni_sayisi = begeni_sayisi + 1 WHERE id = ?`, [reelId]);
        return true;
    } catch (e) { return false; }
}

async function reelBegenKaldir(reelId, kullaniciId) {
    await run(`DELETE FROM reel_begeniler WHERE reel_id = ? AND kullanici_id = ?`, [reelId, kullaniciId]);
    await run(`UPDATE reels SET begeni_sayisi = begeni_sayisi - 1 WHERE id = ? AND begeni_sayisi > 0`, [reelId]);
}

async function reelYorumEkle(reelId, kullaniciId, metin) {
    const result = await run(
        `INSERT INTO reel_yorumlar (reel_id, kullanici_id, metin) VALUES (?, ?, ?)`,
        [reelId, kullaniciId, metin]
    );
    await run(`UPDATE reels SET yorum_sayisi = yorum_sayisi + 1 WHERE id = ?`, [reelId]);
    const yorum = await get(`
        SELECT ry.*, k.kullanici_adi, k.avatar_url
        FROM reel_yorumlar ry
        JOIN kullanicilar k ON ry.kullanici_id = k.id
        WHERE ry.id = ?
    `, [result.lastID]);
    return yorum;
}

async function reelYorumlariGetir(reelId, limit = 30) {
    return await all(`
        SELECT ry.*, k.kullanici_adi, k.avatar_url
        FROM reel_yorumlar ry
        JOIN kullanicilar k ON ry.kullanici_id = k.id
        WHERE ry.reel_id = ? AND ry.silindi = 0
        ORDER BY ry.olusturma ASC
        LIMIT ?
    `, [reelId, limit]);
}

async function reelYorumSil(yorumId, kullaniciId, isAdmin = false) {
    const yorum = await get(`SELECT kullanici_id, reel_id FROM reel_yorumlar WHERE id = ?`, [yorumId]);
    if (!yorum) return false;
    if (yorum.kullanici_id !== kullaniciId && !isAdmin) return false;
    await run(`UPDATE reel_yorumlar SET silindi = 1 WHERE id = ?`, [yorumId]);
    await run(`UPDATE reels SET yorum_sayisi = yorum_sayisi - 1 WHERE id = ? AND yorum_sayisi > 0`, [yorum.reel_id]);
    return true;
}

async function reelSil(reelId, kullaniciId, isAdmin = false) {
    const reel = await get(`SELECT kullanici_id FROM reels WHERE id = ?`, [reelId]);
    if (!reel) return false;
    if (reel.kullanici_id !== kullaniciId && !isAdmin) return false;
    await run(`UPDATE reels SET silindi = 1 WHERE id = ?`, [reelId]);
    return true;
}
async function kullaniciBul_ByAd(ad) {
    const k = await get('SELECT id, kullanici_adi, avatar_url, bio, rol FROM kullanicilar WHERE kullanici_adi = ? COLLATE NOCASE', [ad]);
    if (!k) return null;
    return { id: k.id, ad: k.kullanici_adi, avatarUrl: k.avatar_url, bio: k.bio || '', rol: k.rol };
}

async function botAyarGetir(botId) {
    return await get('SELECT * FROM bot_ayarlar WHERE bot_id = ?', [botId]);
}

async function botAyarKaydet(botId, tip, mesaj, sureDk, odalar) {
    const mevcut = await get('SELECT id FROM bot_ayarlar WHERE bot_id = ?', [botId]);
    if (mevcut) {
        await run('UPDATE bot_ayarlar SET mesaj=?, sure_dk=?, odalar=?, aktif=1 WHERE bot_id=?',
            [mesaj, sureDk, odalar, botId]);
    } else {
        await run('INSERT INTO bot_ayarlar (bot_id, tip, mesaj, sure_dk, odalar) VALUES (?,?,?,?,?)',
            [botId, tip, mesaj, sureDk, odalar]);
    }
}

async function botAyarDurdur(botId) {
    await run('UPDATE bot_ayarlar SET aktif=0 WHERE bot_id=?', [botId]);
}

async function botKonusmaKaydet(botId, kullaniciId, mesaj, gonderen) {
    await run('INSERT INTO bot_konusmalar (bot_id, kullanici_id, mesaj, gonderen) VALUES (?,?,?,?)',
        [botId, kullaniciId, mesaj, gonderen]);
}

async function botKonusmaGetir(botId, kullaniciId, limit = 10) {
    return await all(`SELECT * FROM bot_konusmalar 
        WHERE bot_id=? AND kullanici_id=? 
        ORDER BY zaman DESC LIMIT ?`, [botId, kullaniciId, limit]);
}

async function banSayisiGetir(kullaniciId) {
    const row = await get('SELECT COUNT(*) as sayi FROM banlar WHERE kullanici_id=?', [kullaniciId]);
    return row;
}
module.exports = {
    // Kullanici
    kullaniciKaydet, kullaniciGiris, kullaniciBul, tumKullanicilariGetir,
    kullaniciSil, sifreSifirla, rolGuncelle, profilGuncelle,
    // Oda
    odalariGetir, odaOlustur, odaSil,
    // Mesaj
    mesajKaydet, odaMesajlariGetir, dmMesajlariGetir, grupMesajlariGetir,
    odaMesajlariniTemizle, mesajSil, okunduIsaretle,
    // Grup
    grupOlustur, grupGetir, kullaniciGruplariGetir, tumGruplariGetir,
    grupUyesiMi, grupUyeEkle, grupUyeCikar, grupSil,
    // Ban
    kullaniciBanla, banKaldir, banliMi, banListesi, suresiBitenBanlariTemizle,
    // Sosyal Medya
    gonderiOlustur, gonderileriGetir, tumGonderileriGetir, gonderiBegen, gonderiBegenKaldir, gonderiSil,
    yorumEkle, yorumlariGetir, yorumSil,
    takipEt, takipBirak, takipDurumu, takipciSayisi, takipEdilenSayisi, profilBilgileriGetir,
    // Story
    storyOlustur, aktifStoryleriGetir, kullaniciStoryleriGetir, storyGoruntule,
    storyBegen, storyBegenKaldir, storyYorumEkle, storyYorumlariGetir, storySil,
    suresiBitenStoryleriTemizle, storyKullanicilariGetir,
    // Reels
    reelOlustur, reellerGetir, reelBegen, reelBegenKaldir,
    reelYorumEkle, reelYorumlariGetir, reelYorumSil, reelSil,
    // Bot
    kullaniciBul_ByAd, botAyarGetir, botAyarKaydet, botAyarDurdur,
    botKonusmaKaydet, botKonusmaGetir, banSayisiGetir
};
