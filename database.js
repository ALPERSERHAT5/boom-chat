// ==================== BOOM CHAT — database.js (sqlite3) ====================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database(path.join(__dirname, 'boom-chat.db'));

// Promise yardimcisi
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
async function tablolariOlustur() {
    await run(`CREATE TABLE IF NOT EXISTS kullanicilar (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        kullanici_adi TEXT UNIQUE NOT NULL COLLATE NOCASE,
        sifre_hash    TEXT NOT NULL,
        avatar_url    TEXT,
        rol           TEXT DEFAULT 'uye',
        olusturma     INTEGER DEFAULT (strftime('%s','now')),
        son_giris     INTEGER
    )`);

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
        gonderen_id INTEGER NOT NULL,
        metin       TEXT DEFAULT '',
        foto_url    TEXT,
        tip         TEXT DEFAULT 'mesaj',
        zaman       INTEGER DEFAULT (strftime('%s','now')),
        silindi     INTEGER DEFAULT 0
    )`);

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

    // Varsayilan odalar
    await run(`INSERT OR IGNORE INTO odalar (ad, aciklama) VALUES ('genel', 'Herkesin kullanabilecegi genel sohbet odasi')`);
    await run(`INSERT OR IGNORE INTO odalar (ad, aciklama) VALUES ('tanitim', 'Kendinizi tanitabilirsiniz')`);

    console.log('✅ Veritabani hazir');
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
    return { basarili: true, kullanici: { id: k.id, ad: k.kullanici_adi, avatarUrl: k.avatar_url, rol: k.rol } };
}

async function kullaniciBul(id) {
    const k = await get('SELECT id, kullanici_adi, avatar_url, rol FROM kullanicilar WHERE id = ?', [id]);
    if (!k) return null;
    return { id: k.id, ad: k.kullanici_adi, avatarUrl: k.avatar_url, rol: k.rol };
}

async function rolGuncelle(kullaniciId, rol) {
    await run('UPDATE kullanicilar SET rol = ? WHERE id = ?', [rol, kullaniciId]);
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
        `INSERT INTO mesajlar (id, oda_id, dm_key, gonderen_id, metin, foto_url, tip)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [mesaj.id, mesaj.odaId || null, mesaj.dmKey || null,
         mesaj.gonderenId, mesaj.metin || '', mesaj.fotoUrl || null, mesaj.tip || 'mesaj']
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

async function odaMesajlariniTemizle(odaId) {
    await run('UPDATE mesajlar SET silindi = 1 WHERE oda_id = ?', [odaId]);
}

async function okunduIsaretle(mesajId, kullaniciId) {
    await run('INSERT OR IGNORE INTO okundu (mesaj_id, kullanici_id) VALUES (?, ?)', [mesajId, kullaniciId]);
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

module.exports = {
    kullaniciKaydet, kullaniciGiris, kullaniciBul, rolGuncelle,
    odalariGetir, odaOlustur, odaSil,
    mesajKaydet, odaMesajlariGetir, dmMesajlariGetir, odaMesajlariniTemizle, okunduIsaretle,
    kullaniciBanla, banKaldir, banliMi, banListesi, suresiBitenBanlariTemizle
};