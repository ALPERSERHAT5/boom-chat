// ==================== BOOM CHAT v3 — script.js ====================

let socket = null;
let ben = null;
let aktifMod = 'oda';       // 'oda' veya 'dm'
let aktifOda = null;        // oda adi
let aktifKullanici = null;  // dm için
let kullanicilar = {};      // id -> kullanici
let odalar = [];            // oda listesi
let engelliIdler = new Set();
let yaziyorOda = new Set();
let yaziyorOzel = null;
let yaziyorTimer = null;
let dmOkunmamis = {};
let odaOkunmamis = {};
let bekleyenFoto = null;
let _cachedOdaMesajlar = {}; // odaAdi -> mesajlar
let _ayracEklendi = false;
let _sonGonderenId = null;
let tema = localStorage.getItem('boom-tema') || 'karanlik';

document.documentElement.setAttribute('data-tema', tema);

// ==================== AUTH ====================

// Tab seç
function tabSec(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('aktif'));
    event.target.classList.add('aktif');
    document.getElementById('girisForm').style.display = tab === 'giris' ? 'block' : 'none';
    document.getElementById('kayitForm').style.display = tab === 'kayit' ? 'block' : 'none';
}

// Şifre göster/gizle
function sifreGoster(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Enter ile giriş/kayıt
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const girisEkrani = document.getElementById('girisEkrani');
    if (!girisEkrani.classList.contains('aktif')) return;
    const aktifTab = document.querySelector('.auth-tab.aktif')?.textContent;
    if (aktifTab === 'Giriş Yap') girisYap();
    else kayitOl();
});

// Avatar önizleme
document.getElementById('avatarInput').addEventListener('change', function () {
    const dosya = this.files[0]; if (!dosya) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('avatarOnizleme').innerHTML =
            `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    };
    reader.readAsDataURL(dosya);
});

// Sayfa açılınca token kontrolü
window.addEventListener('load', async () => {
    const token = localStorage.getItem('boom-token');
    if (token) {
        try {
            const res = await fetch('/api/token-dogrula', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const veri = await res.json();
            if (veri.basarili) { socketBaglan(token, veri.kullanici); return; }
        } catch (e) {}
        localStorage.removeItem('boom-token');
    }
});

// Kayıt ol
async function kayitOl() {
    const ad = document.getElementById('kayitAdi').value.trim();
    const sifre = document.getElementById('kayitSifre').value;
    const adminKodu = document.getElementById('adminKodu').value.trim();
    const btn = document.getElementById('kayitBtn');

    if (!ad) { hataGoster('kayitHata', 'Kullanıcı adı giriniz!'); return; }
    if (ad.length < 2) { hataGoster('kayitHata', 'En az 2 karakter!'); return; }
    if (!sifre || sifre.length < 4) { hataGoster('kayitHata', 'Şifre en az 4 karakter!'); return; }

    btn.disabled = true; btn.querySelector('.btn-yazi').textContent = 'KAYIT OLUYOR...';

    const fd = new FormData();
    fd.append('kullaniciAdi', ad);
    fd.append('sifre', sifre);
    if (adminKodu) fd.append('adminKodu', adminKodu);
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput.files[0]) fd.append('avatar', avatarInput.files[0]);

    try {
        const res = await fetch('/api/kayit', { method: 'POST', body: fd });
        const veri = await res.json();
        if (!veri.basarili) {
            hataGoster('kayitHata', veri.hata);
            btn.disabled = false; btn.querySelector('.btn-yazi').textContent = 'KAYIT OL';
            return;
        }
        localStorage.setItem('boom-token', veri.token);
        socketBaglan(veri.token, veri.kullanici);
    } catch (e) {
        hataGoster('kayitHata', 'Bağlantı hatası!');
        btn.disabled = false; btn.querySelector('.btn-yazi').textContent = 'KAYIT OL';
    }
}

// Giriş yap
async function girisYap() {
    const ad = document.getElementById('girisAdi').value.trim();
    const sifre = document.getElementById('girisSifre').value;
    const btn = document.getElementById('girisBtn');

    if (!ad || !sifre) { hataGoster('girisHata', 'Tüm alanları doldurun!'); return; }

    btn.disabled = true; btn.querySelector('.btn-yazi').textContent = 'GİRİYOR...';

    try {
        const res = await fetch('/api/giris', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kullaniciAdi: ad, sifre })
        });
        const veri = await res.json();
        if (!veri.basarili) {
            hataGoster('girisHata', veri.hata);
            btn.disabled = false; btn.querySelector('.btn-yazi').textContent = 'GİRİŞ YAP';
            return;
        }
        localStorage.setItem('boom-token', veri.token);
        socketBaglan(veri.token, veri.kullanici);
    } catch (e) {
        hataGoster('girisHata', 'Bağlantı hatası!');
        btn.disabled = false; btn.querySelector('.btn-yazi').textContent = 'GİRİŞ YAP';
    }
}

function hataGoster(elId, mesaj) {
    document.getElementById(elId).textContent = mesaj;
    setTimeout(() => { document.getElementById(elId).textContent = ''; }, 4000);
}

function cikisYap() {
    localStorage.removeItem('boom-token');
    socket?.disconnect();
    location.reload();
}

// ==================== SOCKET BAĞLAN ====================

function socketBaglan(token, kullanici) {
    ben = kullanici;

    socket = io({ auth: { token } });

    // Bağlantı hatası
    socket.on('connect_error', (err) => {
        if (err.message.startsWith('BANLANDI:')) {
            const sebep = err.message.replace('BANLANDI:', '');
            alert('Hesabınız banlandı!\nSebep: ' + sebep);
            localStorage.removeItem('boom-token');
        } else {
            hataGoster('girisHata', 'Bağlantı hatası: ' + err.message);
            const btn = document.getElementById('girisBtn');
            if (btn) { btn.disabled = false; btn.querySelector('.btn-yazi').textContent = 'GİRİŞ YAP'; }
        }
    });

    socket.on('connect', () => {
        // Giriş ekranından çık
        document.getElementById('girisEkrani').classList.remove('aktif');
        document.getElementById('sohbetEkrani').classList.add('aktif');

        profilSidebarGuncelle();
        if (ben.rol === 'admin') document.body.classList.add('admin');

        // Kullanıcı listesini iste
        socket.emit('kullanici-listesi-iste');

        toast('👋 Hoş geldiniz, ' + ben.ad + (ben.rol === 'admin' ? ' ⚡' : '') + '!');
    });

    socketOlaylariKur();
}

// ==================== SOCKET OLAYLARI ====================

function socketOlaylariKur() {

    socket.on('odalar-listesi', (liste) => {
        odalar = liste;
        odalariRender();
        // İlk odaya gir
        if (liste.length > 0 && !aktifOda) {
            odaGir(liste[0].ad);
        }
    });

    socket.on('yeni-oda', (oda) => {
        odalar.push(oda);
        odalariRender();
        toast('🆕 Yeni oda: #' + oda.ad);
    });

    socket.on('oda-silindi', (odaId) => {
        odalar = odalar.filter(o => o.id !== odaId);
        odalariRender();
        if (aktifOda && aktifOda === odalar.find(o => o.id === odaId)?.ad) {
            odaGir(odalar[0]?.ad);
        }
    });

    socket.on('kullanici-listesi', (liste) => {
        kullanicilar = {};
        liste.forEach(k => kullanicilar[k.id] = k);
        kullanicilariRender();
        document.getElementById('kullaniciSayisi').textContent = liste.length;
    });

    socket.on('kullanici-katildi-oda', ({ kullanici, odaAdi }) => {
        kullanicilar[kullanici.id] = kullanici;
        kullanicilariRender();
        document.getElementById('kullaniciSayisi').textContent = Object.keys(kullanicilar).length;
    });

    socket.on('kullanici-ayrildi-oda', ({ kullaniciId }) => {
        // Sadece o odadan ayrıldı, kullanicilar listesinden silme
    });

    socket.on('kullanici-ayrildi-genel', (id) => {
        delete kullanicilar[id];
        kullanicilariRender();
        document.getElementById('kullaniciSayisi').textContent = Object.keys(kullanicilar).length;
        document.querySelector(`[data-dm-id="${id}"]`)?.remove();
        if (aktifKullanici?.id === id) { aktifKullanici = null; odaGir(aktifOda); }
    });

    socket.on('oda-gecmis', ({ odaAdi, mesajlar }) => {
        _cachedOdaMesajlar[odaAdi] = mesajlar;
        if (aktifMod === 'oda' && aktifOda === odaAdi) {
            const alan = document.getElementById('mesajAlani');
            alan.innerHTML = hosgeldinHTML();
            _sonGonderenId = null;
            mesajlar.forEach(m => mesajRender(m, false, 'oda'));
            kaydir();
        }
    });

    socket.on('oda-mesaj', ({ odaAdi, mesaj }) => {
        if (aktifMod === 'oda' && aktifOda === odaAdi) {
            if (!_cachedOdaMesajlar[odaAdi]) _cachedOdaMesajlar[odaAdi] = [];
            _cachedOdaMesajlar[odaAdi].push(mesaj);
            mesajRender(mesaj, true, 'oda');
        } else if (mesaj.gonderenId !== ben.id) {
            odaOkunmamis[odaAdi] = (odaOkunmamis[odaAdi] || 0) + 1;
            odaBadgeGuncelle(odaAdi);
            toast('💬 #' + odaAdi + ' → ' + (mesaj.foto ? '📷' : mesaj.metin?.slice(0, 30)));
        }
    });

    socket.on('oda-temizlendi', (odaAdi) => {
        _cachedOdaMesajlar[odaAdi] = [];
        if (aktifMod === 'oda' && aktifOda === odaAdi) {
            document.getElementById('mesajAlani').innerHTML = hosgeldinHTML();
            _sonGonderenId = null;
        }
    });

    socket.on('ozel-mesaj', (mesaj) => {
        const diger = mesaj.gonderenId === ben.id ? mesaj.aliciId : mesaj.gonderenId;
        if (aktifMod === 'dm' && aktifKullanici?.id === diger) {
            if (mesaj.gonderenId !== ben.id) {
                if (!_ayracEklendi) { yeniMesajAyraciEkle(); _ayracEklendi = true; }
                socket.emit('mesaj-goruldu', { mesajId: mesaj.id, gonderenId: mesaj.gonderenId });
            }
            mesajRender(mesaj, true, 'dm');
        } else if (mesaj.gonderenId !== ben.id) {
            dmOkunmamis[diger] = (dmOkunmamis[diger] || 0) + 1;
            const k = kullanicilar[diger] || { id: diger, ad: mesaj.gonderenAd, avatarUrl: mesaj.gonderenAvatar };
            dmListesineEkle(k);
            dmBadgeGuncelle(diger);
            dmSonMesajGuncelle(diger, mesaj.foto ? '📷 Fotoğraf' : mesaj.metin);
            toast('💬 ' + k.ad + ': ' + (mesaj.foto ? '📷 Fotoğraf' : mesaj.metin?.slice(0, 35)));
        }
    });

    socket.on('ozel-gecmis', ({ karsiId, mesajlar }) => {
        if (aktifKullanici?.id !== karsiId) return;
        const alan = document.getElementById('mesajAlani');
        alan.innerHTML = ''; _sonGonderenId = null; _ayracEklendi = false;
        mesajlar.forEach(m => mesajRender(m, false, 'dm'));
        kaydir();
        mesajlar.filter(m => m.gonderenId !== ben.id && !m.okundu).forEach(m => {
            socket.emit('mesaj-goruldu', { mesajId: m.id, gonderenId: m.gonderenId });
        });
    });

    socket.on('mesaj-goruldu-bildir', ({ mesajId }) => {
        const el = document.querySelector(`[data-mesaj-id="${mesajId}"] .okundu-ikon`);
        if (el) { el.textContent = '✓✓'; el.classList.add('goruldu'); }
    });

    socket.on('engel-basarili',   (id) => { engelliIdler.add(id);    toast('🚫 Engellendi');     headerAksiyonlarGuncelle(); sagPanelGuncelle(); });
    socket.on('engel-kaldirildi', (id) => { engelliIdler.delete(id); toast('✅ Engel kaldırıldı'); headerAksiyonlarGuncelle(); sagPanelGuncelle(); });
    socket.on('engel-uyarisi', (m) => toast('⛔ ' + m, 'hata'));

    socket.on('yaziyor-oda', ({ id, ad, odaAdi }) => {
        if (aktifMod !== 'oda' || aktifOda !== odaAdi) return;
        yaziyorOda.add(id + '|' + ad); yaziyorGuncelle();
    });
    socket.on('yazmayi-bitti-oda', ({ id }) => {
        yaziyorOda.forEach(v => { if (v.startsWith(id + '|')) yaziyorOda.delete(v); });
        yaziyorGuncelle();
    });
    socket.on('yaziyor-ozel', ({ id, ad }) => {
        if (!aktifKullanici || aktifKullanici.id !== id) return;
        yaziyorOzel = ad; yaziyorGuncelle();
    });
    socket.on('yazmayi-bitti-ozel', (id) => {
        if (!aktifKullanici || aktifKullanici.id !== id) return;
        yaziyorOzel = null; yaziyorGuncelle();
    });

    // Admin olayları
    socket.on('admin-islem-tamam', (mesaj) => toast('✅ ' + mesaj));
    socket.on('admin-hata', (mesaj) => toast('❌ ' + mesaj, 'hata'));
    socket.on('admin-ban-listesi', (liste) => adminBanListesiGoster(liste));
    socket.on('ban-yendi', ({ sebep }) => {
        alert('Hesabınız banlandı!\nSebep: ' + (sebep || 'Belirtilmedi'));
        cikisYap();
    });
    socket.on('sistem-bildirim', ({ metin }) => toast('📢 ' + metin));

    // WebRTC olaylarını kur
    webrtcOlaylariKur();

    // Fotoğraf inputu
    document.getElementById('fotoInput').addEventListener('change', function () {
        const dosya = this.files[0]; if (!dosya) return;
        const reader = new FileReader();
        reader.onload = e => {
            bekleyenFoto = { dataUrl: e.target.result, file: dosya };
            document.getElementById('fotoOnizlemeImg').src = e.target.result;
            document.getElementById('fotoOnizlemeAlan').style.display = 'block';
        };
        reader.readAsDataURL(dosya);
        this.value = '';
    });
}

// ==================== RENDER ====================

function hosgeldinHTML() {
    return `<div class="hosgeldin-mesaji">
        <div class="hosgeldin-ikon">💥</div>
        <h2>BOOM Chat'e Hoş Geldiniz!</h2>
        <p>Mesaj göndererek konuşmayı başlatın.</p>
    </div>`;
}

function profilSidebarGuncelle() {
    document.getElementById('sidebarAd').textContent = ben.ad;
    const rolEl = document.getElementById('profilRol');
    rolEl.textContent = ben.rol === 'admin' ? '⚡ Admin' : 'Üye';
    if (ben.rol === 'admin') rolEl.classList.add('admin');
    const av = document.getElementById('sidebarAvatar');
    av.innerHTML = ben.avatarUrl
        ? `<img src="${ben.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : ben.ad[0].toUpperCase();
}

function odalariRender() {
    const liste = document.getElementById('odaListesi');
    liste.innerHTML = '';
    odalar.forEach(oda => {
        const div = document.createElement('div');
        div.className = 'oda-item' + (aktifOda === oda.ad && aktifMod === 'oda' ? ' aktif-oda' : '');
        div.setAttribute('data-oda', oda.ad);
        div.onclick = () => { odaGir(oda.ad); sidebarKapat(); };
        div.innerHTML = `
            <span class="kanal-ikon">#</span>
            <span style="flex:1">${esc(oda.ad)}</span>
            <span class="mesaj-sayaci oda-sayac" id="oda-sayac-${oda.ad}" style="display:none"></span>
            ${ben?.rol === 'admin' && oda.ad !== 'genel'
                ? `<button class="oda-sil-btn admin-only" onclick="event.stopPropagation();odaSil(${oda.id})">✕</button>`
                : ''}`;
        liste.appendChild(div);
    });
}

function kullanicilariRender() {
    const liste = document.getElementById('kullaniciListesi');
    const digerler = Object.values(kullanicilar).filter(k => k.id !== ben?.id);
    if (digerler.length === 0) {
        liste.innerHTML = '<div style="padding:6px 10px;font-size:11px;color:var(--t3);font-style:italic">Başka kullanıcı yok</div>';
        return;
    }
    liste.innerHTML = '';
    digerler.forEach(k => {
        const div = document.createElement('div');
        div.className = 'kullanici-item';
        div.onclick = () => { dmAc(k); sidebarKapat(); };
        div.innerHTML = `
            <div class="kullanici-avatar">
                ${k.avatarUrl ? `<img src="${k.avatarUrl}" style="width:100%;height:100%;object-fit:cover">` : k.ad[0].toUpperCase()}
                <div class="online-badge"></div>
            </div>
            <span class="kullanici-ad-metin">${esc(k.ad)}</span>
            ${k.rol === 'admin' ? '<span class="admin-badge">ADMİN</span>' : ''}`;
        liste.appendChild(div);
    });
}

function odaBadgeGuncelle(odaAdi) {
    const el = document.getElementById('oda-sayac-' + odaAdi); if (!el) return;
    const sayi = odaOkunmamis[odaAdi] || 0;
    if (sayi === 0) { el.style.display = 'none'; return; }
    el.textContent = sayi > 99 ? '99+' : sayi;
    el.style.display = 'flex';
}

function dmBadgeGuncelle(karsiId) {
    const dmItem = document.querySelector(`[data-dm-id="${karsiId}"]`); if (!dmItem) return;
    let badge = dmItem.querySelector('.dm-badge');
    const sayi = dmOkunmamis[karsiId] || 0;
    if (sayi === 0) { badge?.remove(); return; }
    if (!badge) { badge = document.createElement('span'); badge.className = 'dm-badge'; dmItem.appendChild(badge); }
    badge.textContent = sayi > 99 ? '99+' : sayi;
}

function dmSonMesajGuncelle(karsiId, onizleme) {
    const dmItem = document.querySelector(`[data-dm-id="${karsiId}"]`); if (!dmItem) return;
    let el = dmItem.querySelector('.yeni-mesaj-etiket');
    if (!el) { el = document.createElement('div'); el.className = 'yeni-mesaj-etiket var'; dmItem.appendChild(el); }
    el.textContent = onizleme?.slice(0, 28) + (onizleme?.length > 28 ? '…' : '');
}

function yeniMesajAyraciEkle() {
    const alan = document.getElementById('mesajAlani');
    if (alan.querySelector('.yeni-mesaj-ayrac')) return;
    const div = document.createElement('div');
    div.className = 'yeni-mesaj-ayrac';
    div.innerHTML = `<span class="yeni-mesaj-ayrac-yazi">YENİ MESAJLAR</span>`;
    alan.appendChild(div); _sonGonderenId = null;
}

// ==================== ODA / DM SEÇİM ====================

function odaGir(odaAdi) {
    if (!odaAdi) return;
    aktifMod = 'oda'; aktifOda = odaAdi; aktifKullanici = null;
    yaziyorOda.clear(); yaziyorOzel = null; _ayracEklendi = false;

    document.querySelectorAll('.oda-item').forEach(e => e.classList.remove('aktif-oda'));
    document.querySelectorAll('.dm-item').forEach(e => e.classList.remove('aktif-dm'));
    document.querySelector(`[data-oda="${odaAdi}"]`)?.classList.add('aktif-oda');

    delete odaOkunmamis[odaAdi];
    odaBadgeGuncelle(odaAdi);

    document.getElementById('headerBaslik').innerHTML =
        `<span class="header-ikon">#</span><span id="headerAd">${esc(odaAdi)}</span>`;
    adminHeaderGuncelle();

    const alan = document.getElementById('mesajAlani');
    alan.innerHTML = hosgeldinHTML(); _sonGonderenId = null;

    // Cache varsa göster, yoksa sunucudan iste
    if (_cachedOdaMesajlar[odaAdi]) {
        _cachedOdaMesajlar[odaAdi].forEach(m => mesajRender(m, false, 'oda'));
        kaydir();
    }

    socket.emit('oda-gir', odaAdi);
    inputAktifEt('# ' + odaAdi + ' kanalına mesaj yaz...');
    sagPanelGizle();
}

function dmAc(kullanici) {
    aktifMod = 'dm'; aktifKullanici = kullanici;
    yaziyorOda.clear(); _ayracEklendi = false;

    document.querySelectorAll('.oda-item').forEach(e => e.classList.remove('aktif-oda'));
    document.querySelectorAll('.dm-item').forEach(e => e.classList.remove('aktif-dm'));

    dmListesineEkle(kullanici);
    document.querySelector(`[data-dm-id="${kullanici.id}"]`)?.classList.add('aktif-dm');

    delete dmOkunmamis[kullanici.id];
    dmBadgeGuncelle(kullanici.id);
    document.querySelector(`[data-dm-id="${kullanici.id}"] .yeni-mesaj-etiket`)?.remove();

    document.getElementById('headerBaslik').innerHTML =
        `<span class="header-ikon" style="color:var(--mavi2)">@</span><span id="headerAd">${esc(kullanici.ad)}</span>`;
    headerAksiyonlarGuncelle();

    document.getElementById('mesajAlani').innerHTML = ''; _sonGonderenId = null;
    socket.emit('gecmis-iste', kullanici.id);
    inputAktifEt('@' + kullanici.ad + ' ile mesajlaş...');
    sagPanelGuncelle();
}

function dmListesineEkle(kullanici) {
    if (document.querySelector(`[data-dm-id="${kullanici.id}"]`)) return;
    const liste = document.getElementById('dmListesi');
    const div = document.createElement('div');
    div.className = 'dm-item'; div.setAttribute('data-dm-id', kullanici.id);
    div.onclick = () => { dmAc(kullanici); sidebarKapat(); };
    div.innerHTML = `
        <div class="dm-avatar">
            ${kullanici.avatarUrl ? `<img src="${kullanici.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : kullanici.ad[0].toUpperCase()}
        </div>
        <span class="dm-ad">${esc(kullanici.ad)}</span>`;
    liste.appendChild(div);
}

function adminHeaderGuncelle() {
    const aksiyonlar = document.getElementById('headerAksiyonlar');
    if (ben?.rol !== 'admin') { aksiyonlar.innerHTML = ''; return; }
    aksiyonlar.innerHTML = `
        <button class="aksiyon-btn mavi" onclick="adminPanelAc()">⚡ <span class="aksiyon-yazi">Admin</span></button>
        <button class="aksiyon-btn tehlikeli" onclick="odaTemizle()">🗑 <span class="aksiyon-yazi">Temizle</span></button>`;
}

function headerAksiyonlarGuncelle() {
    if (!aktifKullanici) { document.getElementById('headerAksiyonlar').innerHTML = ''; return; }
    const engellendi = engelliIdler.has(aktifKullanici.id);
    let html = `
        <button class="aksiyon-btn mavi" onclick="aramaBaslat('${aktifKullanici.id}','sesli')" title="Sesli Ara">📞</button>
        <button class="aksiyon-btn mavi" onclick="aramaBaslat('${aktifKullanici.id}','goruntulu')" title="Görüntülü Ara">📹</button>
    `;
    html += engellendi
        ? `<button class="aksiyon-btn" onclick="engelKaldir('${aktifKullanici.id}')">✅ <span class="aksiyon-yazi">Engeli Kaldır</span></button>`
        : `<button class="aksiyon-btn tehlikeli" onclick="engelleModal('${aktifKullanici.id}')">🚫 <span class="aksiyon-yazi">Engelle</span></button>`;
    if (ben?.rol === 'admin') {
        html += `<button class="aksiyon-btn ban" onclick="banModalAc('${aktifKullanici.id}')">⛔ <span class="aksiyon-yazi">Banla</span></button>`;
    }
    document.getElementById('headerAksiyonlar').innerHTML = html;
}

function sagPanelGuncelle() {
    if (!aktifKullanici) { sagPanelGizle(); return; }
    const k = aktifKullanici; const engellendi = engelliIdler.has(k.id);
    document.getElementById('sagPanel').style.display = 'block';
    document.getElementById('sagPanelIcerik').innerHTML = `
        <div class="sag-panel-profil">
            <div class="sag-panel-avatar">
                ${k.avatarUrl ? `<img src="${k.avatarUrl}" style="width:100%;height:100%;object-fit:cover">` : k.ad[0].toUpperCase()}
            </div>
            <div class="sag-panel-ad">${esc(k.ad)}</div>
            <div class="sag-panel-durum"><span class="online-nokta"></span> Çevrimiçi</div>
        </div>
        <div class="sag-panel-aksiyonlar">
            <button class="arama-baslat-btn" onclick="aramaBaslat('${k.id}','sesli')">📞 Sesli Ara</button>
            <button class="arama-baslat-btn goruntulu" onclick="aramaBaslat('${k.id}','goruntulu')">📹 Görüntülü</button>
            ${engellendi
                ? `<button class="aksiyon-btn" onclick="engelKaldir('${k.id}')">✅ Engeli Kaldır</button>`
                : `<button class="aksiyon-btn tehlikeli" onclick="engelleModal('${k.id}')">🚫 Engelle</button>`}
            ${ben?.rol === 'admin' ? `<button class="aksiyon-btn ban" onclick="banModalAc('${k.id}')">⛔ Banla</button>` : ''}
        </div>`;
}
function sagPanelGizle() { document.getElementById('sagPanel').style.display = 'none'; }

// ==================== MESAJ GÖNDER ====================

function inputAktifEt(placeholder) {
    const input = document.getElementById('mesajInput');
    const btn = document.getElementById('gonderBtn');
    const fotoBtn = document.getElementById('fotoEkleBtn');
    input.disabled = false; input.placeholder = placeholder;
    btn.disabled = false; fotoBtn.disabled = false;
    if (window.innerWidth > 768) setTimeout(() => input.focus(), 100);
}

document.getElementById('mesajInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mesajGonder(); }
});

document.getElementById('mesajInput').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    clearTimeout(yaziyorTimer);
    const p = aktifMod === 'oda'
        ? { tip: 'oda', odaAdi: aktifOda }
        : { tip: 'dm', aliciId: aktifKullanici?.id };
    socket.emit('yaziyor-basladi', p);
    yaziyorTimer = setTimeout(() => socket.emit('yaziyor-bitti', p), 2500);
});

async function mesajGonder() {
    const input = document.getElementById('mesajInput');
    const metin = input.value.trim();
    if (!metin && !bekleyenFoto) return;

    let fotoUrl = null;
    if (bekleyenFoto) {
        try {
            const fd = new FormData(); fd.append('foto', bekleyenFoto.file);
            const res = await fetch('/api/foto', { method: 'POST', body: fd });
            fotoUrl = (await res.json()).url || null;
        } catch (e) { toast('Fotoğraf yüklenemedi!', 'hata'); return; }
        fotoyuIptalEt();
    }

    if (aktifMod === 'oda') {
        socket.emit('oda-mesaj', { odaAdi: aktifOda, metin, foto: fotoUrl });
    } else if (aktifKullanici) {
        socket.emit('ozel-mesaj', { aliciId: aktifKullanici.id, metin, foto: fotoUrl });
    }
    input.value = ''; input.style.height = 'auto';
    const p = aktifMod === 'oda' ? { tip: 'oda', odaAdi: aktifOda } : { tip: 'dm', aliciId: aktifKullanici?.id };
    socket.emit('yaziyor-bitti', p);
}

function fotoyuIptalEt() {
    bekleyenFoto = null;
    document.getElementById('fotoOnizlemeAlan').style.display = 'none';
    document.getElementById('fotoOnizlemeImg').src = '';
}

// ==================== MESAJ RENDER ====================

function mesajRender(mesaj, kayirYap = true, mod = 'oda') {
    const alan = document.getElementById('mesajAlani');
    if (mesaj.tip === 'sistem') {
        const d = document.createElement('div'); d.className = 'sistem-mesaj';
        d.innerHTML = `<span>${esc(mesaj.metin)} — ${mesaj.zaman}</span>`;
        alan.appendChild(d); _sonGonderenId = null;
    } else {
        alan.appendChild(mesajWrap(mesaj));
    }
    if (kayirYap) kaydir();
}

function mesajWrap(mesaj) {
    const benim = mesaj.gonderenId === ben?.id;
    const k = benim
        ? { ...ben, ad: ben.ad, avatarUrl: ben.avatarUrl }
        : (kullanicilar[mesaj.gonderenId] || { id: mesaj.gonderenId, ad: mesaj.gonderenAd, avatarUrl: mesaj.gonderenAvatar });

    const yeniBlok = _sonGonderenId !== mesaj.gonderenId;
    _sonGonderenId = mesaj.gonderenId;

    const wrap = document.createElement('div');
    wrap.className = 'mesaj-wrap' + (benim ? ' kendi' : '') + (yeniBlok ? ' yeni-blok' : '');
    wrap.setAttribute('data-mesaj-id', mesaj.id);

    const avImg = k.avatarUrl || k.avatar;
    const avatarHTML = avImg
        ? `<img src="${avImg}" style="width:100%;height:100%;object-fit:cover">`
        : (k.ad || '?')[0].toUpperCase();

    const balonIcerik = mesaj.foto
        ? `<img src="${mesaj.foto}" class="mesaj-foto" onclick="lightboxAc('${mesaj.foto}')" alt="Fotoğraf">`
        : `<div class="mesaj-balon">${esc(mesaj.metin)}</div>`;

    const okunduHTML = benim
        ? `<div class="mesaj-alt"><span class="mesaj-zaman-alt">${mesaj.zaman}</span><span class="okundu-ikon${mesaj.okundu ? ' goruldu' : ''}">${mesaj.okundu ? '✓✓' : '✓'}</span></div>`
        : `<div class="mesaj-alt"><span class="mesaj-zaman-alt">${mesaj.zaman}</span></div>`;

    wrap.innerHTML = `
        <div class="mesaj-row">
            <div class="mesaj-avatar ${yeniBlok ? '' : 'gizli'}">${avatarHTML}</div>
            <div class="mesaj-icerik">
                ${yeniBlok && !benim ? `<div class="mesaj-meta"><span class="mesaj-yazar">${esc(k.ad)}</span><span class="mesaj-zaman-meta">${mesaj.zaman}</span></div>` : ''}
                ${balonIcerik}
                ${okunduHTML}
            </div>
        </div>`;
    return wrap;
}

function kaydir() {
    const alan = document.getElementById('mesajAlani');
    requestAnimationFrame(() => { alan.scrollTop = alan.scrollHeight; });
}

function yaziyorGuncelle() {
    const el = document.getElementById('yaziyorAlan');
    if (aktifMod === 'oda') {
        if (yaziyorOda.size === 0) { el.textContent = ''; return; }
        el.textContent = [...yaziyorOda].map(v => v.split('|')[1]).join(', ') + ' yazıyor...';
    } else {
        el.textContent = yaziyorOzel ? yaziyorOzel + ' yazıyor...' : '';
    }
}

// ==================== ADMİN ====================

function adminPanelAc() {
    const cevrImici = Object.values(kullanicilar).filter(k => k.id !== ben.id);
    let html = `<div class="admin-bolum">
        <div class="admin-bolum-baslik">ÇEVRİMİÇİ KULLANICILAR</div>`;

    if (cevrImici.length === 0) {
        html += '<p style="font-size:12px;color:var(--t3)">Başka kullanıcı yok</p>';
    } else {
        cevrImici.forEach(k => {
            html += `<div class="admin-kullanici-satir">
                <span class="admin-kullanici-ad">${esc(k.ad)}${k.rol === 'admin' ? ' <span class="admin-badge">ADMİN</span>' : ''}</span>
                <button class="admin-btn ban" onclick="banModalAc('${k.id}');modalKapat('adminModal')">⛔ Banla</button>
            </div>`;
        });
    }

    html += `</div>
    <div class="admin-bolum">
        <div class="admin-bolum-baslik">BAN LİSTESİ</div>
        <button class="admin-btn mavi" onclick="socket.emit('admin-ban-listesi-iste')">Listeyi Yükle</button>
        <div id="adminBanListesi" style="margin-top:8px"></div>
    </div>`;

    document.getElementById('adminPanelIcerik').innerHTML = html;
    document.getElementById('adminModal').style.display = 'flex';
}

function adminBanListesiGoster(liste) {
    const el = document.getElementById('adminBanListesi'); if (!el) return;
    if (liste.length === 0) { el.innerHTML = '<p style="font-size:12px;color:var(--t3)">Ban yok</p>'; return; }
    el.innerHTML = liste.map(b => `
        <div class="admin-kullanici-satir">
            <span class="admin-kullanici-ad">${esc(b.kullanici_adi)} — ${b.sebep || 'Sebepsiz'}</span>
            <button class="admin-btn yesil" onclick="socket.emit('admin-ban-kaldir',${b.kullanici_id});this.parentElement.remove()">Kaldır</button>
        </div>`).join('');
}

function odaTemizle() {
    if (!aktifOda) return;
    if (!confirm('#' + aktifOda + ' sohbetini temizlemek istediğinize emin misiniz?')) return;
    socket.emit('admin-oda-temizle', aktifOda);
}

function yeniOdaModalAc() {
    document.getElementById('yeniOdaAdi').value = '';
    document.getElementById('yeniOdaAciklama').value = '';
    document.getElementById('yeniOdaModal').style.display = 'flex';
    setTimeout(() => document.getElementById('yeniOdaAdi').focus(), 100);
}

function yeniOdaOlustur() {
    const ad = document.getElementById('yeniOdaAdi').value.trim();
    const aciklama = document.getElementById('yeniOdaAciklama').value.trim();
    if (!ad) { toast('Oda adı gerekli!', 'hata'); return; }
    socket.emit('admin-oda-olustur', { ad, aciklama });
    modalKapat('yeniOdaModal');
}

function odaSil(odaId) {
    if (!confirm('Bu odayı silmek istediğinize emin misiniz?')) return;
    socket.emit('admin-oda-sil', odaId);
}

// ==================== ENGEL / BAN ====================

function engelleModal(hedefId) {
    const k = kullanicilar[hedefId]; if (!k) return;
    document.getElementById('engelModalIcerik').textContent = '"' + k.ad + '" adlı kullanıcıyı engellemek istediğinize emin misiniz?';
    document.getElementById('engelOnayBtn').onclick = () => { socket.emit('engelle', hedefId); modalKapat('engelModal'); };
    document.getElementById('engelModal').style.display = 'flex';
}
function engelKaldir(hedefId) { socket.emit('engel-kaldir', hedefId); }

function banModalAc(hedefId) {
    document.getElementById('banSebep').value = '';
    document.getElementById('banSure').value = '0';
    document.getElementById('banOnayBtn').onclick = () => {
        const sebep = document.getElementById('banSebep').value.trim();
        const sure = parseInt(document.getElementById('banSure').value) || 0;
        socket.emit('admin-banla', { hedefId: parseInt(hedefId), sebep, sureDk: sure });
        modalKapat('banModal');
    };
    document.getElementById('banModal').style.display = 'flex';
}

function modalKapat(id) { document.getElementById(id).style.display = 'none'; }

// ==================== LİGHTBOX ====================
function lightboxAc(url) {
    document.getElementById('lightboxImg').src = url;
    document.getElementById('lightbox').classList.add('aktif');
}
function lightboxKapat() {
    document.getElementById('lightbox').classList.remove('aktif');
    document.getElementById('lightboxImg').src = '';
}

// ==================== TEMA / MOBİL ====================
function temaDegistir() {
    tema = tema === 'karanlik' ? 'aydinlik' : 'karanlik';
    document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem('boom-tema', tema);
    toast(tema === 'karanlik' ? '🌙 Karanlık tema' : '☀️ Aydınlık tema');
}

function sidebarAc() {
    document.getElementById('sidebar').classList.add('mobil-acik');
    document.getElementById('sidebarOverlay').classList.add('aktif');
}
function sidebarKapat() {
    document.getElementById('sidebar').classList.remove('mobil-acik');
    document.getElementById('sidebarOverlay').classList.remove('aktif');
}

// ==================== TOAST ====================
function toast(mesaj, tip = 'bilgi') {
    const kap = document.getElementById('toastKap');
    const div = document.createElement('div'); div.className = 'toast';
    div.innerHTML = `<span class="toast-ikon">${tip === 'hata' ? '⚠️' : 'ℹ️'}</span><span>${esc(mesaj)}</span>`;
    kap.appendChild(div);
    setTimeout(() => { div.classList.add('cikis'); setTimeout(() => div.remove(), 250); }, 3500);
}

// ==================== GÜVENLİK ====================
function esc(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// iOS keyboard fix
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    window.addEventListener('resize', () => {
        document.getElementById('mesajFooter').style.paddingBottom = '';
    });
}

// ==================== WebRTC GÖRÜNTÜLÜ/SESLİ ====================

let pcBaglanti = null;      // RTCPeerConnection
let yerelStream = null;     // Kendi kamera/mikrofon
let aramaHedefId = null;    // Arama yapılan kişi
let aramaKabul = false;     // Arama kabul edildi mi
let videoAcik = true;
let sesAcik = true;

// STUN sunucuları (ücretsiz Google STUN)
const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// ---- Arama Başlat ----
async function aramaBaslat(hedefId, tip = 'goruntulu') {
    aramaHedefId = hedefId;
    aramaKabul = false;

    // HTTPS kontrolü
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        toast('⚠️ Sesli/görüntülü için HTTPS gerekli!', 'hata');
        return;
    }

    // Tarayıcı desteği kontrolü
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('⚠️ Tarayıcınız kamera/mikrofonu desteklemiyor!', 'hata');
        return;
    }

    try {
        // Önce sadece ses ile dene, başarısız olursa hatayı göster
        const constraints = {
            audio: true,
            video: tip === 'goruntulu' ? { facingMode: 'user' } : false
        };
        yerelStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
        console.error('getUserMedia hatası:', e.name, e.message);
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            toast('❌ Kamera/mikrofon izni verilmedi! Tarayıcı ayarlarından izin verin.', 'hata');
        } else if (e.name === 'NotFoundError') {
            toast('❌ Kamera veya mikrofon bulunamadı!', 'hata');
        } else if (e.name === 'NotReadableError') {
            toast('❌ Kamera/mikrofon başka uygulama tarafından kullanılıyor!', 'hata');
        } else {
            toast('❌ Hata: ' + e.message, 'hata');
        }
        return;
    }

    aramaPenceresiniAc('arayan', tip);
    const yerelVideoEl = document.getElementById('yerelVideo');
    if (yerelVideoEl) yerelVideoEl.srcObject = yerelStream;
    socket.emit('arama-baslat', { hedefId: parseInt(hedefId), tip });
    toast('📞 Bağlanıyor...');
}

// ---- Gelen Arama ----
socket.on && (window._webrtcOlaylarKuruldu = window._webrtcOlaylarKuruldu || false);

function webrtcOlaylariKur() {
    if (window._webrtcOlaylarKuruldu) return;
    window._webrtcOlaylarKuruldu = true;

    socket.on('gelen-arama', ({ arayanId, arayanAd, arayanAvatar, tip }) => {
        aramaHedefId = arayanId;
        gelenAramaPenceresiniAc(arayanId, arayanAd, arayanAvatar, tip);
    });

    socket.on('arama-kabul-edildi', async ({ kabulEdenId }) => {
        aramaKabul = true;
        toast('✅ Arama kabul edildi!');
        await webrtcBaslat(kabulEdenId, true);
    });

    socket.on('arama-reddedildi', () => {
        toast('❌ Arama reddedildi.', 'hata');
        aramayiKapat();
    });

    socket.on('arama-kapandi', () => {
        toast('📵 Arama sonlandırıldı.');
        aramayiKapat();
    });

    socket.on('arama-hata', (mesaj) => {
        toast('⚠️ ' + mesaj, 'hata');
        aramayiKapat();
    });

    socket.on('webrtc-offer', async ({ gonderenId, offer }) => {
        await webrtcCevapVer(gonderenId, offer);
    });

    socket.on('webrtc-answer', async ({ answer }) => {
        if (pcBaglanti) await pcBaglanti.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ candidate }) => {
        try {
            if (pcBaglanti && candidate) await pcBaglanti.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
    });
}

// ---- WebRTC Başlat (Arayan tarafı) ----
async function webrtcBaslat(hedefId, arayan = true) {
    pcBaglanti = new RTCPeerConnection(RTC_CONFIG);

    // Yerel stream ekle
    if (yerelStream) {
        yerelStream.getTracks().forEach(track => pcBaglanti.addTrack(track, yerelStream));
    }

    // Uzak stream al
    pcBaglanti.ontrack = (e) => {
        const uzakVideo = document.getElementById('uzakVideo');
        if (uzakVideo && e.streams[0]) uzakVideo.srcObject = e.streams[0];
    };

    // ICE candidate gönder
    pcBaglanti.onicecandidate = (e) => {
        if (e.candidate) socket.emit('ice-candidate', { hedefId, candidate: e.candidate });
    };

    // Bağlantı durumu
    pcBaglanti.onconnectionstatechange = () => {
        const durum = document.getElementById('aramaDurum');
        if (!durum) return;
        if (pcBaglanti.connectionState === 'connected') durum.textContent = '🟢 Bağlandı';
        else if (pcBaglanti.connectionState === 'disconnected') { durum.textContent = '🔴 Bağlantı kesildi'; setTimeout(aramayiKapat, 2000); }
    };

    if (arayan) {
        const offer = await pcBaglanti.createOffer();
        await pcBaglanti.setLocalDescription(offer);
        socket.emit('webrtc-offer', { hedefId, offer });
    }
}

// ---- WebRTC Cevap Ver (Alıcı tarafı) ----
async function webrtcCevapVer(gonderenId, offer) {
    pcBaglanti = new RTCPeerConnection(RTC_CONFIG);

    if (yerelStream) {
        yerelStream.getTracks().forEach(track => pcBaglanti.addTrack(track, yerelStream));
    }

    pcBaglanti.ontrack = (e) => {
        const uzakVideo = document.getElementById('uzakVideo');
        if (uzakVideo && e.streams[0]) uzakVideo.srcObject = e.streams[0];
    };

    pcBaglanti.onicecandidate = (e) => {
        if (e.candidate) socket.emit('ice-candidate', { hedefId: gonderenId, candidate: e.candidate });
    };

    pcBaglanti.onconnectionstatechange = () => {
        const durum = document.getElementById('aramaDurum');
        if (!durum) return;
        if (pcBaglanti.connectionState === 'connected') durum.textContent = '🟢 Bağlandı';
        else if (pcBaglanti.connectionState === 'disconnected') { durum.textContent = '🔴 Bağlantı kesildi'; setTimeout(aramayiKapat, 2000); }
    };

    await pcBaglanti.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pcBaglanti.createAnswer();
    await pcBaglanti.setLocalDescription(answer);
    socket.emit('webrtc-answer', { hedefId: gonderenId, answer });
}

// ---- Aramayı Kapat ----
function aramayiKapat() {
    if (pcBaglanti) { pcBaglanti.close(); pcBaglanti = null; }
    if (yerelStream) { yerelStream.getTracks().forEach(t => t.stop()); yerelStream = null; }
    if (aramaHedefId && !aramaKabul) {
        // Zaten kapatıldıysa tekrar gönderme
    }
    aramaHedefId = null; aramaKabul = false;
    videoAcik = true; sesAcik = true;

    const pencere = document.getElementById('aramaPenceresi');
    if (pencere) pencere.remove();
    const gelenPencere = document.getElementById('gelenAramaPenceresi');
    if (gelenPencere) gelenPencere.remove();
}

function aramaKapat() {
    if (aramaHedefId) socket.emit('arama-kapat', { hedefId: aramaHedefId });
    aramayiKapat();
}

// ---- Aramayı Kabul Et ----
async function aramaKabulEt(arayanId, tip) {
    aramaKabul = true;
    const gelenPencere = document.getElementById('gelenAramaPenceresi');
    if (gelenPencere) gelenPencere.remove();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('⚠️ Tarayıcınız kamera/mikrofonu desteklemiyor!', 'hata');
        socket.emit('arama-reddet', { arayanId }); return;
    }

    try {
        yerelStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: tip === 'goruntulu' ? { facingMode: 'user' } : false
        });
    } catch (e) {
        console.error('getUserMedia hatası:', e.name, e.message);
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            toast('❌ Kamera/mikrofon izni verilmedi!', 'hata');
        } else {
            toast('❌ Hata: ' + e.message, 'hata');
        }
        socket.emit('arama-reddet', { arayanId }); return;
    }

    aramaPenceresiniAc('alan', tip);
    document.getElementById('yerelVideo').srcObject = yerelStream;
    socket.emit('arama-kabul', { arayanId });
    await webrtcBaslat(arayanId, false);
}

// ---- Aramayı Reddet ----
function aramaReddet(arayanId) {
    socket.emit('arama-reddet', { arayanId });
    const gelenPencere = document.getElementById('gelenAramaPenceresi');
    if (gelenPencere) gelenPencere.remove();
}

// ---- Video Aç/Kapat ----
function videoToggle() {
    if (!yerelStream) return;
    const videoTrack = yerelStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoAcik = !videoAcik;
    videoTrack.enabled = videoAcik;
    const btn = document.getElementById('videoBtn');
    if (btn) btn.textContent = videoAcik ? '📹' : '📵';
}

// ---- Ses Aç/Kapat ----
function sesToggle() {
    if (!yerelStream) return;
    const audioTrack = yerelStream.getAudioTracks()[0];
    if (!audioTrack) return;
    sesAcik = !sesAcik;
    audioTrack.enabled = sesAcik;
    const btn = document.getElementById('sesBtn');
    if (btn) btn.textContent = sesAcik ? '🎤' : '🔇';
}

// ==================== ARAMA PENCERELERİ ====================

function aramaPenceresiniAc(mod, tip) {
    const mevcut = document.getElementById('aramaPenceresi');
    if (mevcut) mevcut.remove();

    const div = document.createElement('div');
    div.id = 'aramaPenceresi';
    div.className = 'arama-penceresi';
    div.innerHTML = `
        <div class="arama-ust">
            <span id="aramaDurum">${mod === 'arayan' ? '📞 Bağlanıyor...' : '📞 Bağlandı'}</span>
            <span class="arama-kisi">${aktifKullanici ? esc(aktifKullanici.ad) : ''}</span>
        </div>
        <div class="video-alan">
            ${tip === 'goruntulu' ? `
                <video id="uzakVideo" class="uzak-video" autoplay playsinline></video>
                <video id="yerelVideo" class="yerel-video" autoplay playsinline muted></video>
            ` : `
                <div class="ses-only-icon">🎤</div>
                <video id="yerelVideo" style="display:none" autoplay playsinline muted></video>
                <audio id="uzakVideo" autoplay></audio>
            `}
        </div>
        <div class="arama-kontroller">
            ${tip === 'goruntulu' ? `<button class="arama-btn" id="videoBtn" onclick="videoToggle()">📹</button>` : ''}
            <button class="arama-btn" id="sesBtn" onclick="sesToggle()">🎤</button>
            <button class="arama-btn kapat-btn" onclick="aramaKapat()">📵</button>
        </div>`;
    document.body.appendChild(div);
}

function gelenAramaPenceresiniAc(arayanId, arayanAd, arayanAvatar, tip) {
    const mevcut = document.getElementById('gelenAramaPenceresi');
    if (mevcut) mevcut.remove();

    const div = document.createElement('div');
    div.id = 'gelenAramaPenceresi';
    div.className = 'gelen-arama-penceresi';
    div.innerHTML = `
        <div class="gelen-arama-icerik">
            <div class="gelen-arama-avatar">
                ${arayanAvatar
                    ? `<img src="${arayanAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
                    : arayanAd[0].toUpperCase()}
            </div>
            <div class="gelen-arama-ad">${esc(arayanAd)}</div>
            <div class="gelen-arama-tip">${tip === 'goruntulu' ? '📹 Görüntülü arama' : '📞 Sesli arama'}</div>
            <div class="gelen-arama-butonlar">
                <button class="arama-btn kabul-btn" onclick="aramaKabulEt('${arayanId}','${tip}')">✅</button>
                <button class="arama-btn ret-btn" onclick="aramaReddet('${arayanId}')">❌</button>
            </div>
        </div>`;
    document.body.appendChild(div);

    // Zil sesi animasyonu
    div.style.animation = 'zil 0.5s ease infinite';
}

// WebRTC olaylarını socket bağlanınca kur
const _orijinalSocketBaglan = socketBaglan;
// socketBaglan override - webrtc olaylarını kur
