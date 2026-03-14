// ==================== BOOM CHAT — script.js ====================

const socket = io();

let ben = null;
let aktifKanal = 'genel';
let aktifKullanici = null;
let kullanicilar = {};
let engelliIdler = new Set();
let yaziyorKisiGenel = new Set();
let yaziyorKisiOzel = null;
let yaziyorTimer = null;
let genelOkunmamis = 0;
let dmOkunmamis = {};
let bekleyenFoto = null;
let _cachedGenelMesajlar = [];
let _ayracEklendi = false;
let _sonGonderenId = null;
let tema = localStorage.getItem('boom-tema') || 'karanlik';

// ---- BAŞLANGIC ----
document.documentElement.setAttribute('data-tema', tema);

// iOS'ta klavye açıldığında viewport düzeltme
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    window.addEventListener('resize', () => {
        const footer = document.getElementById('mesajFooter');
        if (footer) footer.style.paddingBottom = '';
    });
}

// Android keyboard için scroll düzeltme
window.visualViewport && window.visualViewport.addEventListener('resize', () => {
    const alan = document.getElementById('mesajAlani');
    if (alan) setTimeout(() => { alan.scrollTop = alan.scrollHeight; }, 100);
});

// ---- TEMA ----
function temaDegistir() {
    tema = tema === 'karanlik' ? 'aydinlik' : 'karanlik';
    document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem('boom-tema', tema);
    toast(tema === 'karanlik' ? '🌙 Karanlık tema' : '☀️ Aydınlık tema');
}

// ---- SIDEBAR MOBİL ----
function sidebarAc() {
    document.getElementById('sidebar').classList.add('mobil-acik');
    document.getElementById('sidebarOverlay').classList.add('aktif');
    document.body.style.overflow = 'hidden';
}
function sidebarKapat() {
    document.getElementById('sidebar').classList.remove('mobil-acik');
    document.getElementById('sidebarOverlay').classList.remove('aktif');
    document.body.style.overflow = '';
}

// ---- AVATAR ÖNİZLEME ----
document.getElementById('avatarInput').addEventListener('change', function () {
    const dosya = this.files[0]; if (!dosya) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('avatarOnizleme').innerHTML =
            `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    };
    reader.readAsDataURL(dosya);
});

// ---- FOTOĞRAF SEÇ ----
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

function fotoyuIptalEt() {
    bekleyenFoto = null;
    document.getElementById('fotoOnizlemeAlan').style.display = 'none';
    document.getElementById('fotoOnizlemeImg').src = '';
}

// ---- GİRİŞ ----
document.getElementById('kullaniciAdi').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); girisYap(); }
});

async function girisYap() {
    const ad = document.getElementById('kullaniciAdi').value.trim();
    if (!ad) { hataGoster('Kullanıcı adı giriniz!'); return; }
    if (ad.length < 2) { hataGoster('En az 2 karakter!'); return; }

    const btn = document.getElementById('girisBtn');
    btn.disabled = true;
    btn.querySelector('.btn-yazi').textContent = 'BAĞLANIYOR...';

    let avatarUrl = null;
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput.files[0]) {
        try {
            const fd = new FormData();
            fd.append('avatar', avatarInput.files[0]);
            const res = await fetch('/upload-avatar', { method: 'POST', body: fd });
            const veri = await res.json();
            avatarUrl = veri.url || null;
        } catch (e) { console.warn('Avatar yüklenemedi'); }
    }
    socket.emit('yeni-kullanici', { ad, avatarUrl });
}

function hataGoster(mesaj) {
    document.getElementById('hataMesaji').textContent = mesaj;
    setTimeout(() => { document.getElementById('hataMesaji').textContent = ''; }, 3000);
    const btn = document.getElementById('girisBtn');
    btn.disabled = false;
    btn.querySelector('.btn-yazi').textContent = 'KATIL';
}

// ---- SOCKET OLAYLARI ----

socket.on('isim-hatasi', hataGoster);

socket.on('giris-basarili', (kullanici) => {
    ben = kullanici;
    document.getElementById('girisEkrani').classList.remove('aktif');
    document.getElementById('sohbetEkrani').classList.add('aktif');
    profilSidebarGuncelle();
    inputAktifEt('# genel kanalına mesaj yaz...');
    toast('👋 Hoş geldiniz, ' + ben.ad + '!');
});

socket.on('kullanici-listesi', (liste) => {
    kullanicilar = {};
    liste.forEach(k => kullanicilar[k.id] = k);
    kullanicilariRender();
    document.getElementById('kullaniciSayisi').textContent = liste.length;
});

socket.on('yeni-kullanici-katildi', (kullanici) => {
    kullanicilar[kullanici.id] = kullanici;
    kullanicilariRender();
    document.getElementById('kullaniciSayisi').textContent = Object.keys(kullanicilar).length;
});

socket.on('kullanici-ayrildi', (id) => {
    delete kullanicilar[id];
    kullanicilariRender();
    document.getElementById('kullaniciSayisi').textContent = Object.keys(kullanicilar).length;
    document.querySelector(`[data-dm-id="${id}"]`)?.remove();
    if (aktifKullanici?.id === id) kanalSec('genel');
});

socket.on('gecmis-mesajlar', (mesajlar) => {
    _cachedGenelMesajlar = mesajlar;
    if (aktifKanal !== 'genel') return;
    const alan = document.getElementById('mesajAlani');
    alan.innerHTML = hosgeldinHTML();
    _sonGonderenId = null;
    mesajlar.forEach(m => genelMesajRender(m, false));
    kaydir();
});

socket.on('genel-mesaj', (mesaj) => {
    if (mesaj.tip !== 'sistem') _cachedGenelMesajlar.push(mesaj);
    if (aktifKanal === 'genel') {
        genelMesajRender(mesaj);
    } else if (mesaj.tip !== 'sistem') {
        genelOkunmamis++;
        const s = document.getElementById('genelSayac');
        s.textContent = genelOkunmamis > 99 ? '99+' : genelOkunmamis;
        s.style.display = 'flex';
    }
});

socket.on('ozel-mesaj', (mesaj) => {
    const diger = mesaj.gonderenId === ben.id ? mesaj.aliciId : mesaj.gonderenId;
    if (aktifKullanici?.id === diger) {
        if (mesaj.gonderenId !== ben.id) {
            if (!_ayracEklendi) {
                yeniMesajAyraciEkle();
                _ayracEklendi = true;
            }
            socket.emit('mesaj-goruldu', { mesajId: mesaj.id, gonderenId: mesaj.gonderenId });
        }
        ozelMesajRender(mesaj);
    } else if (mesaj.gonderenId !== ben.id) {
        dmOkunmamis[diger] = (dmOkunmamis[diger] || 0) + 1;
        const k = kullanicilar[diger] || { id: diger, ad: mesaj.gonderenAd, avatarUrl: mesaj.gonderenAvatar };
        dmListesineEkle(k);
        dmBadgeGuncelle(diger);
        dmSonMesajGuncelle(diger, mesaj.foto ? '📷 Fotoğraf' : mesaj.metin);
        toast('💬 ' + k.ad + ': ' + (mesaj.foto ? '📷 Fotoğraf' : mesaj.metin.slice(0, 40)));
    }
});

socket.on('ozel-gecmis', ({ karsiId, mesajlar }) => {
    if (aktifKullanici?.id !== karsiId) return;
    const alan = document.getElementById('mesajAlani');
    alan.innerHTML = '';
    _sonGonderenId = null;
    _ayracEklendi = false;
    mesajlar.forEach(m => ozelMesajRender(m, false));
    kaydir();
    mesajlar.filter(m => m.gonderenId !== ben.id && !m.okundu).forEach(m => {
        socket.emit('mesaj-goruldu', { mesajId: m.id, gonderenId: m.gonderenId });
    });
});

socket.on('mesaj-goruldu-bildir', ({ mesajId }) => {
    const el = document.querySelector(`[data-mesaj-id="${mesajId}"] .okundu-ikon`);
    if (el) { el.textContent = '✓✓'; el.classList.add('goruldu'); }
});

socket.on('engel-basarili', (id) => {
    engelliIdler.add(id);
    toast('🚫 Kullanıcı engellendi');
    headerAksiyonlarGuncelle(); sagPanelGuncelle();
});
socket.on('engel-kaldirildi', (id) => {
    engelliIdler.delete(id);
    toast('✅ Engel kaldırıldı');
    headerAksiyonlarGuncelle(); sagPanelGuncelle();
});
socket.on('engel-uyarisi', (m) => toast('⛔ ' + m, 'hata'));

socket.on('yaziyor-genel', ({ id, ad }) => {
    if (aktifKanal !== 'genel') return;
    yaziyorKisiGenel.add(id + '|' + ad); yaziyorGuncelle();
});
socket.on('yazmayi-bitti-genel', (id) => {
    yaziyorKisiGenel.forEach(v => { if (v.startsWith(id + '|')) yaziyorKisiGenel.delete(v); });
    yaziyorGuncelle();
});
socket.on('yaziyor-ozel', ({ id, ad }) => {
    if (!aktifKullanici || aktifKullanici.id !== id) return;
    yaziyorKisiOzel = ad; yaziyorGuncelle();
});
socket.on('yazmayi-bitti-ozel', (id) => {
    if (!aktifKullanici || aktifKullanici.id !== id) return;
    yaziyorKisiOzel = null; yaziyorGuncelle();
});

// ---- RENDER ----
function hosgeldinHTML() {
    return `<div class="hosgeldin-mesaji">
        <div class="hosgeldin-ikon">💥</div>
        <h2>BOOM Chat'e Hoş Geldiniz!</h2>
        <p>İlk mesajı gönderin ve konuşmayı başlatın.</p>
    </div>`;
}

function profilSidebarGuncelle() {
    if (!ben) return;
    document.getElementById('sidebarAd').textContent = ben.ad;
    const av = document.getElementById('sidebarAvatar');
    av.innerHTML = ben.avatarUrl
        ? `<img src="${ben.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : ben.ad[0].toUpperCase();
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
            <span class="kullanici-ad-metin">${esc(k.ad)}</span>`;
        liste.appendChild(div);
    });
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
    let etiket = dmItem.querySelector('.yeni-mesaj-etiket');
    if (!etiket) { etiket = document.createElement('div'); etiket.className = 'yeni-mesaj-etiket var'; dmItem.appendChild(etiket); }
    etiket.textContent = onizleme.slice(0, 28) + (onizleme.length > 28 ? '…' : '');
}

function yeniMesajAyraciEkle() {
    const alan = document.getElementById('mesajAlani');
    if (alan.querySelector('.yeni-mesaj-ayrac')) return;
    const div = document.createElement('div');
    div.className = 'yeni-mesaj-ayrac';
    div.innerHTML = `<span class="yeni-mesaj-ayrac-yazi">YENİ MESAJLAR</span>`;
    alan.appendChild(div);
    _sonGonderenId = null;
}

// ---- KANAL SEÇ ----
function kanalSec(kanal) {
    aktifKanal = kanal; aktifKullanici = null;
    yaziyorKisiOzel = null; _ayracEklendi = false;
    document.querySelectorAll('.kanal-item').forEach(e => e.classList.remove('aktif-kanal'));
    document.querySelectorAll('.dm-item').forEach(e => e.classList.remove('aktif-dm'));
    document.getElementById('genelKanal').classList.add('aktif-kanal');
    document.getElementById('headerBaslik').innerHTML = '<span class="header-ikon">#</span><span id="headerAd">genel</span>';
    document.getElementById('headerAksiyonlar').innerHTML = '';
    sagPanelGizle();

    genelOkunmamis = 0;
    const s = document.getElementById('genelSayac'); s.textContent = ''; s.style.display = 'none';

    const alan = document.getElementById('mesajAlani');
    alan.innerHTML = hosgeldinHTML();
    _sonGonderenId = null;
    _cachedGenelMesajlar.forEach(m => genelMesajRender(m, false));
    kaydir();
    inputAktifEt('# genel kanalına mesaj yaz...');
    sidebarKapat();
}

// ---- DM AÇ ----
function dmAc(kullanici) {
    aktifKullanici = kullanici; aktifKanal = kullanici.id;
    yaziyorKisiGenel.clear(); _ayracEklendi = false;

    document.querySelectorAll('.kanal-item').forEach(e => e.classList.remove('aktif-kanal'));
    document.querySelectorAll('.dm-item').forEach(e => e.classList.remove('aktif-dm'));

    dmListesineEkle(kullanici);
    document.querySelector(`[data-dm-id="${kullanici.id}"]`)?.classList.add('aktif-dm');

    delete dmOkunmamis[kullanici.id];
    dmBadgeGuncelle(kullanici.id);
    document.querySelector(`[data-dm-id="${kullanici.id}"] .yeni-mesaj-etiket`)?.remove();

    document.getElementById('headerBaslik').innerHTML =
        `<span class="header-ikon" style="color:var(--mavi2)">@</span><span id="headerAd">${esc(kullanici.ad)}</span>`;
    headerAksiyonlarGuncelle();

    document.getElementById('mesajAlani').innerHTML = '';
    _sonGonderenId = null;
    socket.emit('gecmis-iste', kullanici.id);
    inputAktifEt('@' + kullanici.ad + ' ile mesajlaş...');
    sagPanelGuncelle();
    sidebarKapat();
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

function headerAksiyonlarGuncelle() {
    if (!aktifKullanici) { document.getElementById('headerAksiyonlar').innerHTML = ''; return; }
    const engellendi = engelliIdler.has(aktifKullanici.id);
    document.getElementById('headerAksiyonlar').innerHTML = engellendi
        ? `<button class="aksiyon-btn" onclick="engelKaldir('${aktifKullanici.id}')">✅ <span class="aksiyon-yazi">Engeli Kaldır</span></button>`
        : `<button class="aksiyon-btn tehlikeli" onclick="engelleModal('${aktifKullanici.id}')">🚫 <span class="aksiyon-yazi">Engelle</span></button>`;
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
            ${engellendi
                ? `<button class="aksiyon-btn" onclick="engelKaldir('${k.id}')">✅ Engeli Kaldır</button>`
                : `<button class="aksiyon-btn tehlikeli" onclick="engelleModal('${k.id}')">🚫 Engelle</button>`}
        </div>`;
}
function sagPanelGizle() { document.getElementById('sagPanel').style.display = 'none'; }

// ---- MESAJ GÖNDER ----
function inputAktifEt(placeholder) {
    const input = document.getElementById('mesajInput');
    const btn = document.getElementById('gonderBtn');
    const fotoBtn = document.getElementById('fotoEkleBtn');
    input.disabled = false; input.placeholder = placeholder;
    btn.disabled = false; fotoBtn.disabled = false;
    // Mobilde otomatik focus açmasın (klavye açılır)
    if (window.innerWidth > 768) setTimeout(() => input.focus(), 100);
}

// Enter ile gönder (Shift+Enter yeni satır)
document.getElementById('mesajInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mesajGonder(); }
});

// Textarea otomatik büyü
document.getElementById('mesajInput').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    clearTimeout(yaziyorTimer);
    const p = aktifKanal === 'genel' ? { tip: 'genel' } : { tip: 'ozel', aliciId: aktifKullanici?.id };
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
            const res = await fetch('/upload-foto', { method: 'POST', body: fd });
            fotoUrl = (await res.json()).url || null;
        } catch (e) { toast('Fotoğraf yüklenemedi!', 'hata'); return; }
        fotoyuIptalEt();
    }

    const payload = { metin, foto: fotoUrl };
    if (aktifKanal === 'genel') {
        socket.emit('genel-mesaj', payload);
    } else if (aktifKullanici) {
        socket.emit('ozel-mesaj', { aliciId: aktifKullanici.id, ...payload });
    }
    input.value = ''; input.style.height = 'auto';
    const p = aktifKanal === 'genel' ? { tip: 'genel' } : { tip: 'ozel', aliciId: aktifKullanici?.id };
    socket.emit('yaziyor-bitti', p);
}

// ---- MESAJ RENDER ----
function genelMesajRender(mesaj, kayirYap = true) {
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

function ozelMesajRender(mesaj, kayirYap = true) {
    document.getElementById('mesajAlani').appendChild(mesajWrap(mesaj));
    if (kayirYap) kaydir();
}

function mesajWrap(mesaj) {
    const benim = mesaj.gonderenId === ben?.id;
    const k = benim
        ? ben
        : (kullanicilar[mesaj.gonderenId] || { ad: mesaj.gonderenAd, avatarUrl: mesaj.gonderenAvatar });

    const yeniBlok = _sonGonderenId !== mesaj.gonderenId;
    _sonGonderenId = mesaj.gonderenId;

    const wrap = document.createElement('div');
    wrap.className = 'mesaj-wrap' + (benim ? ' kendi' : '') + (yeniBlok ? ' yeni-blok' : '');
    wrap.setAttribute('data-mesaj-id', mesaj.id);

    const avImg = k.avatarUrl || k.avatar;
    const avatarHTML = avImg
        ? `<img src="${avImg}" style="width:100%;height:100%;object-fit:cover">`
        : k.ad[0].toUpperCase();

    const balonIcerik = mesaj.foto
        ? `<img src="${mesaj.foto}" class="mesaj-foto" onclick="lightboxAc('${mesaj.foto}')" alt="Fotoğraf">`
        : `<div class="mesaj-balon">${esc(mesaj.metin)}</div>`;

    const okunduHTML = benim
        ? `<div class="mesaj-alt">
            <span class="mesaj-zaman-alt">${mesaj.zaman}</span>
            <span class="okundu-ikon${mesaj.okundu ? ' goruldu' : ''}">${mesaj.okundu ? '✓✓' : '✓'}</span>
           </div>`
        : `<div class="mesaj-alt"><span class="mesaj-zaman-alt">${mesaj.zaman}</span></div>`;

    wrap.innerHTML = `
        <div class="mesaj-row">
            <div class="mesaj-avatar ${yeniBlok ? '' : 'gizli'}">${avatarHTML}</div>
            <div class="mesaj-icerik">
                ${yeniBlok && !benim
                    ? `<div class="mesaj-meta"><span class="mesaj-yazar">${esc(k.ad)}</span><span class="mesaj-zaman-meta">${mesaj.zaman}</span></div>`
                    : ''}
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
    if (aktifKanal === 'genel') {
        if (yaziyorKisiGenel.size === 0) { el.textContent = ''; return; }
        const adlar = [...yaziyorKisiGenel].map(v => v.split('|')[1]);
        el.textContent = adlar.join(', ') + ' yazıyor...';
    } else {
        el.textContent = yaziyorKisiOzel ? yaziyorKisiOzel + ' yazıyor...' : '';
    }
}

// ---- LİGHTBOX ----
function lightboxAc(url) {
    document.getElementById('lightboxImg').src = url;
    document.getElementById('lightbox').classList.add('aktif');
}
function lightboxKapat() {
    document.getElementById('lightbox').classList.remove('aktif');
    document.getElementById('lightboxImg').src = '';
}

// ---- ENGELLEME ----
function engelleModal(hedefId) {
    const k = kullanicilar[hedefId]; if (!k) return;
    document.getElementById('engelModalIcerik').textContent = '"' + k.ad + '" adlı kullanıcıyı engellemek istediğinize emin misiniz?';
    document.getElementById('engelOnayBtn').onclick = () => { socket.emit('engelle', hedefId); modalKapat('engelModal'); };
    document.getElementById('engelModal').style.display = 'flex';
}
function engelKaldir(hedefId) { socket.emit('engel-kaldir', hedefId); }
function modalKapat(id) { document.getElementById(id).style.display = 'none'; }

// ---- ÇIKIŞ ----
function cikisYap() { location.reload(); }

// ---- TOAST ----
function toast(mesaj, tip = 'bilgi') {
    const kap = document.getElementById('toastKap');
    const div = document.createElement('div'); div.className = 'toast';
    div.innerHTML = `<span class="toast-ikon">${tip === 'hata' ? '⚠️' : 'ℹ️'}</span><span>${esc(mesaj)}</span>`;
    kap.appendChild(div);
    setTimeout(() => { div.classList.add('cikis'); setTimeout(() => div.remove(), 250); }, 3500);
}

// ---- GÜVENLİK ----
function esc(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
