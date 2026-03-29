// ==================== BOOM CHAT v4 — script.js (YENİLENDİ) ====================

let socket = null;
let ben = null;
let aktifMod = 'oda';
let aktifOda = null;
let aktifKullanici = null;
let aktifGrup = null;
let kullanicilar = {};
let odalar = [];
let gruplar = [];
let engelliIdler = new Set();
let yaziyorOda = new Set();
let yaziyorOzel = null;
let yaziyorTimer = null;
let dmOkunmamis = {};
let odaOkunmamis = {};
let grupOkunmamis = {};
let bekleyenDosya = null;
let _cachedOdaMesajlar = {};
let _ayracEklendi = false;
let _sonGonderenId = null;
let tema = localStorage.getItem('boom-tema') || 'karanlik';
let aktifSayfa = 'sohbet'; // 'sohbet', 'akis', 'kesfet'

// Sosyal medya state
let gonderilerAna = [];
let gonderilerKesfet = [];
let yukleniyorAna = false;
let yukleniyorKesfet = false;
let sayfaAna = 0;
let sayfaKesfet = 0;
let aktifGonderiId = null;

document.documentElement.setAttribute('data-tema', tema);

// ==================== ADMIN KOD TOGGLE ====================
function toggleAdminKod() {
    const sarici = document.getElementById('adminKodSarici');
    const ikon = document.getElementById('adminKodToggleIcon');
    if (sarici.style.display === 'none') {
        sarici.style.display = 'block';
        ikon.textContent = '▼';
        ikon.style.transform = 'rotate(0deg)';
    } else {
        sarici.style.display = 'none';
        ikon.textContent = '▶';
        document.getElementById('adminKodu').value = '';
    }
}

// ==================== NAVİGASYON ====================
function navGit(sayfa) {
    aktifSayfa = sayfa;

    document.querySelectorAll('.alt-nav-btn').forEach(b => b.classList.remove('aktif'));
    const navId = 'nav' + sayfa.charAt(0).toUpperCase() + sayfa.slice(1);
    const navBtn = document.getElementById(navId);
    if (navBtn) navBtn.classList.add('aktif');

    const sohbetHeader = document.getElementById('sohbetHeader');
    const mesajAlani = document.getElementById('mesajAlani');
    const mesajFooter = document.getElementById('mesajFooter');
    const yaziyorAlan = document.getElementById('yaziyorAlan');
    const akisAlani = document.getElementById('akisAlani');
    const kesfetAlani = document.getElementById('kesfetAlani');
    const reelsAlani = document.getElementById('reelsAlani');
    const sagPanel = document.getElementById('sagPanel');

    sohbetHeader.style.display = sayfa === 'sohbet' ? 'flex' : 'none';
    mesajAlani.style.display = sayfa === 'sohbet' ? 'flex' : 'none';
    mesajFooter.style.display = sayfa === 'sohbet' ? 'flex' : 'none';
    yaziyorAlan.style.display = sayfa === 'sohbet' ? 'block' : 'none';
    akisAlani.style.display = sayfa === 'akis' ? 'flex' : 'none';
    kesfetAlani.style.display = sayfa === 'kesfet' ? 'flex' : 'none';
    reelsAlani.style.display = sayfa === 'reels' ? 'flex' : 'none';
    if (sagPanel) sagPanel.style.display = 'none';

    if (sayfa === 'akis' && gonderilerAna.length === 0) akisYukle('ana');
    if (sayfa === 'kesfet' && gonderilerKesfet.length === 0) {
        akisYukle('kesfet');
        storyCubuguYukle();
    }
    if (sayfa === 'reels') {
        if (reelsListesi.length === 0) {
            reelsYukle(true).then(() => reelsObserverKur());
        } else {
            reelsObserverKur();
        }
    }

    sidebarKapat();
}

// ==================== AUTH ====================

function tabSec(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('aktif'));
    event.target.classList.add('aktif');
    document.getElementById('girisForm').style.display = tab === 'giris' ? 'block' : 'none';
    document.getElementById('kayitForm').style.display = tab === 'kayit' ? 'block' : 'none';
}

function sifreGoster(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const girisEkrani = document.getElementById('girisEkrani');
    if (!girisEkrani.classList.contains('aktif')) return;
    const aktifTab = document.querySelector('.auth-tab.aktif')?.textContent;
    if (aktifTab === 'Giriş Yap') girisYap();
    else kayitOl();
});

document.getElementById('avatarInput').addEventListener('change', function () {
    const dosya = this.files[0]; if (!dosya) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('avatarOnizleme').innerHTML =
            `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    };
    reader.readAsDataURL(dosya);
});

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
        } catch (e) { }
        localStorage.removeItem('boom-token');
    }
});

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
    setTimeout(() => { const el = document.getElementById(elId); if (el) el.textContent = ''; }, 4000);
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

    socket.on('connect_error', (err) => {
        if (err.message.startsWith('BANLANDI:')) {
            const sebep = err.message.replace('BANLANDI:', '');
            alert('Hesabınız banlandı!\nSebep: ' + sebep);
            localStorage.removeItem('boom-token');
        } else if (err.message.startsWith('IP_BANLANDI:')) {
            const sebep = err.message.replace('IP_BANLANDI:', '');
            alert('IP adresiniz banlandı!\nSebep: ' + sebep);
            localStorage.removeItem('boom-token');
        } else {
            hataGoster('girisHata', 'Bağlantı hatası: ' + err.message);
            const btn = document.getElementById('girisBtn');
            if (btn) { btn.disabled = false; btn.querySelector('.btn-yazi').textContent = 'GİRİŞ YAP'; }
        }
    });

    socket.on('connect', () => {
        document.getElementById('girisEkrani').classList.remove('aktif');
        document.getElementById('sohbetEkrani').classList.add('aktif');

        navGit('sohbet');
        profilSidebarGuncelle();
        if (ben.rol === 'admin') document.body.classList.add('admin');
        if (ben.rol === 'admin' || ben.rol === 'operator') document.body.classList.add('yetkili');

        // Gonderi oluşturma modalı için avatar güncelle
        const gonderiAv = document.getElementById('gonderiOlusturAvatar');
        if (gonderiAv) {
            gonderiAv.innerHTML = ben.avatarUrl
                ? `<img src="${ben.avatarUrl}" style="width:100%;height:100%;object-fit:cover">`
                : ben.ad[0].toUpperCase();
        }

        socket.emit('kullanici-listesi-iste');
        toast('👋 Hoş geldiniz, ' + ben.ad + (ben.rol === 'admin' ? ' ⚡' : ben.rol === 'operator' ? ' 🛡' : '') + '!');
    });

    socket.on('rol-guncellendi', ({ yeniRol }) => {
        ben.rol = yeniRol;
        profilSidebarGuncelle();
        if (yeniRol === 'operator') { document.body.classList.add('yetkili'); toast('🛡 Operatör rolü verildi!'); }
    });
    function _connectErrorHandler(err) {
        if (err.message.startsWith('BANLANDI:')) {
            const sebep = err.message.replace('BANLANDI:', '');
            alert('Hesabınız banlandı!\nSebep: ' + sebep);
            localStorage.removeItem('boom-token');
        } else if (err.message.startsWith('IP_BANLANDI:')) {
            const sebep = err.message.replace('IP_BANLANDI:', '');
            alert('⛔ IP adresiniz banlandı!\nSebep: ' + (sebep || 'Belirtilmedi') + '\n\nFarklı bir hesap açsanız dahi giriş yapamazsınız.');
            localStorage.removeItem('boom-token');
            document.getElementById('girisHata').textContent = '⛔ Bu IP adresi banlanmıştır!';
        } else {
            hataGoster('girisHata', 'Bağlantı hatası: ' + err.message);
            const btn = document.getElementById('girisBtn');
            if (btn) { btn.disabled = false; btn.querySelector('.btn-yazi').textContent = 'GİRİŞ YAP'; }
        }
    }

    socketOlaylariKur();
}

// ==================== SOCKET OLAYLARI ====================

function socketOlaylariKur() {
    socket.on('odalar-listesi', (liste) => {
        odalar = liste;
        odalariRender();
        if (liste.length > 0 && !aktifOda) odaGir(liste[0].ad);
        socket.on('admin-ip-ban-listesi', (liste) => adminIpBanListesiGoster(liste));
        socket.on('admin-kullanici-ipler', ({ kullaniciId, ipler }) => adminKullaniciIplerGoster(kullaniciId, ipler));
    });

    socket.on('yeni-oda', (oda) => { odalar.push(oda); odalariRender(); toast('🆕 Yeni oda: #' + oda.ad); });
    socket.on('oda-silindi', (odaId) => { odalar = odalar.filter(o => o.id !== odaId); odalariRender(); });

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

    socket.on('mesaj-silindi', ({ mesajId }) => {
        const el = document.querySelector(`[data-mesaj-id="${mesajId}"]`);
        if (el) {
            el.style.opacity = '0.4';
            const balon = el.querySelector('.mesaj-balon');
            if (balon) balon.innerHTML = '<em style="color:var(--t3);font-size:12px">Bu mesaj silindi</em>';
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
            toast('💬 ' + k.ad + ': ' + (mesaj.foto ? '📷' : mesaj.metin?.slice(0, 35)));
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

    socket.on('grup-listesi', (liste) => { gruplar = liste; gruplaRiRender(); liste.forEach(g => socket.emit('grup-gir', g.id)); });

    socket.on('yeni-grup', (grup) => {
        const mevcut = gruplar.find(g => g.id === grup.id);
        if (!mevcut) { gruplar.push(grup); gruplaRiRender(); }
        socket.emit('grup-gir', grup.id);
        toast('👥 "' + grup.ad + '" grubuna eklendiniz!');
    });

    socket.on('grup-gecmis', ({ grupId, mesajlar }) => {
        if (aktifMod === 'grup' && aktifGrup?.id === grupId) {
            const alan = document.getElementById('mesajAlani');
            alan.innerHTML = ''; _sonGonderenId = null;
            mesajlar.forEach(m => mesajRender(m, false, 'grup'));
            kaydir();
        }
    });

    socket.on('grup-mesaj', ({ grupId, mesaj }) => {
        if (aktifMod === 'grup' && aktifGrup?.id === grupId) {
            mesajRender(mesaj, true, 'grup');
        } else if (mesaj.gonderenId !== ben.id) {
            grupOkunmamis[grupId] = (grupOkunmamis[grupId] || 0) + 1;
            grupBadgeGuncelle(grupId);
            const g = gruplar.find(x => x.id === grupId);
            toast('👥 ' + (g?.ad || 'Grup') + ': ' + (mesaj.foto ? '📷' : mesaj.metin?.slice(0, 35)));
        }
    });

    socket.on('gruptan-cikarildin', (grupId) => {
        gruplar = gruplar.filter(g => g.id !== grupId);
        gruplaRiRender();
        if (aktifMod === 'grup' && aktifGrup?.id === grupId) odaGir(odalar[0]?.ad);
    });

    socket.on('grup-silindi', (grupId) => {
        gruplar = gruplar.filter(g => g.id !== grupId);
        gruplaRiRender();
        if (aktifMod === 'grup' && aktifGrup?.id === grupId) odaGir(odalar[0]?.ad);
        toast('👥 Bir grup silindi.');
    });

    socket.on('yaziyor-grup', ({ id, ad, grupId }) => {
        if (aktifMod !== 'grup' || aktifGrup?.id !== grupId) return;
        yaziyorOda.add(id + '|' + ad); yaziyorGuncelle();
    });
    socket.on('yazmayi-bitti-grup', ({ id }) => {
        yaziyorOda.forEach(v => { if (v.startsWith(id + '|')) yaziyorOda.delete(v); });
        yaziyorGuncelle();
    });

    socket.on('engel-basarili', (id) => { engelliIdler.add(id); toast('🚫 Engellendi'); headerAksiyonlarGuncelle(); sagPanelGuncelle(); });
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

    socket.on('admin-islem-tamam', (mesaj) => toast('✅ ' + mesaj));
    socket.on('admin-hata', (mesaj) => toast('❌ ' + mesaj, 'hata'));
    socket.on('admin-ban-listesi', (liste) => adminBanListesiGoster(liste));
    socket.on('ban-yendi', ({ sebep }) => {
        alert('Hesabınız banlandı!\nSebep: ' + (sebep || 'Belirtilmedi'));
        cikisYap();
    });
    socket.on('sistem-bildirim', ({ metin }) => toast('📢 ' + metin));
    socket.on('mavi-bot-cevap', ({ mesaj, botAd, botAvatar }) => {
        document.getElementById('yaziyorAlan').textContent = '';
        const botMesaj = {
            id: 'bot-' + Date.now(), tip: 'ozel',
            gonderenId: -1, gonderenAd: botAd || 'Mavi Bot', gonderenAvatar: botAvatar || null,
            metin: mesaj,
            zaman: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            okundu: true
        };
        mesajRender(botMesaj, true, 'dm');
    });

    socket.on('yeni-dm-bildir', ({ kullanici }) => {
        dmListesineEkle(kullanici);
        toast('🔴 ' + kullanici.ad + ' sana mesaj gönderdi!');
    });

    webrtcOlaylariKur();

    document.getElementById('fotoInput').addEventListener('change', async function () {
        const dosya = this.files[0]; if (!dosya) return;
        const reader = new FileReader();
        reader.onload = e => {
            bekleyenDosya = { dataUrl: e.target.result, file: dosya, tip: dosyaTipBelirle(dosya) };
            const isim = dosya.name.length > 25 ? dosya.name.slice(0, 22) + '...' : dosya.name;
            if (bekleyenDosya.tip === 'foto') {
                document.getElementById('fotoOnizlemeImg').src = e.target.result;
                document.getElementById('fotoOnizlemeImg').style.display = 'block';
                document.getElementById('fotoOnizlemeAd').textContent = '';
            } else {
                document.getElementById('fotoOnizlemeImg').style.display = 'none';
                document.getElementById('fotoOnizlemeAd').textContent = dosyaIkonu(bekleyenDosya.tip) + ' ' + isim;
            }
            document.getElementById('fotoOnizlemeAlan').style.display = 'block';
        };
        reader.readAsDataURL(dosya);
        this.value = '';
    });

    // Gonderi medya önizleme
    document.getElementById('gonderiMedyaInput')?.addEventListener('change', function () {
        const dosya = this.files[0]; if (!dosya) return;
        const reader = new FileReader();
        reader.onload = e => {
            const alanDiv = document.getElementById('gonderiMedyaOnizlemeAlan');
            const onizDiv = document.getElementById('gonderiMedyaOnizleme');
            if (dosya.type.startsWith('image/')) {
                onizDiv.innerHTML = `<img src="${e.target.result}">`;
            } else if (dosya.type.startsWith('video/')) {
                onizDiv.innerHTML = `<video src="${e.target.result}" controls></video>`;
            }
            alanDiv.style.display = 'block';
        };
        reader.readAsDataURL(dosya);
    });

    // Sonsuz scroll
    document.getElementById('gonderiListesiAna')?.addEventListener('scroll', function () {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 100) akisYukle('ana');
    });
    document.getElementById('gonderiListesiKesfet')?.addEventListener('scroll', function () {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 100) akisYukle('kesfet');
    });
}

function gonderiMedyaIptal() {
    document.getElementById('gonderiMedyaOnizlemeAlan').style.display = 'none';
    document.getElementById('gonderiMedyaOnizleme').innerHTML = '';
    document.getElementById('gonderiMedyaInput').value = '';
}

function dosyaTipBelirle(dosya) {
    if (dosya.type.startsWith('image/')) return 'foto';
    if (dosya.type.startsWith('video/')) return 'video';
    if (dosya.type === 'application/pdf') return 'pdf';
    return 'dosya';
}

function dosyaIkonu(tip) {
    return { foto: '🖼️', video: '🎬', pdf: '📄', dosya: '📎' }[tip] || '📎';
}

function dosyaBoyutStr(boyut) {
    if (!boyut) return '';
    if (boyut < 1024) return boyut + ' B';
    if (boyut < 1024 * 1024) return (boyut / 1024).toFixed(1) + ' KB';
    return (boyut / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==================== AKIŞ ====================

async function akisYukle(tip) {
    const yukleniyorRef = tip === 'ana' ? yukleniyorAna : yukleniyorKesfet;
    if (yukleniyorRef) return;
    if (tip === 'ana') yukleniyorAna = true; else yukleniyorKesfet = true;

    const sayfa = tip === 'ana' ? sayfaAna : sayfaKesfet;
    const url = tip === 'ana' ? '/api/akis' : '/api/kesfet';
    const token = localStorage.getItem('boom-token');
    const listesiId = tip === 'ana' ? 'gonderiListesiAna' : 'gonderiListesiKesfet';
    const listesiDiv = document.getElementById(listesiId);

    try {
        const res = await fetch(`${url}?sayfa=${sayfa}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (!veri.basarili) throw new Error(veri.hata);

        const mevcutGonderiler = tip === 'ana' ? gonderilerAna : gonderilerKesfet;

        if (veri.gonderiler.length === 0) {
            if (sayfa === 0) {
                listesiDiv.innerHTML = `<div class="gonderi-bos">
                    <div class="gonderi-bos-ikon">${tip === 'ana' ? '📡' : '🔍'}</div>
                    <h3>${tip === 'ana' ? 'Henüz gönderi yok' : 'Gönderi bulunamadı'}</h3>
                    <p>${tip === 'ana' ? 'Takip ettiğin kişilerin paylaşımları burada görünür.' : 'İlk gönderiyi sen paylaş!'}</p>
                </div>`;
            }
            if (tip === 'ana') yukleniyorAna = false; else yukleniyorKesfet = false;
            return;
        }

        const yeniGonderiler = [...mevcutGonderiler, ...veri.gonderiler];
        if (tip === 'ana') { gonderilerAna = yeniGonderiler; sayfaAna++; }
        else { gonderilerKesfet = yeniGonderiler; sayfaKesfet++; }

        if (sayfa === 0) listesiDiv.innerHTML = '';
        veri.gonderiler.forEach(g => listesiDiv.appendChild(gonderiKartOlustur(g)));

    } catch (e) {
        console.error('Akış yükleme hatası:', e);
        if (sayfa === 0) listesiDiv.innerHTML = `<div class="gonderi-bos"><div class="gonderi-bos-ikon">⚠️</div><h3>Hata</h3><p>Gönderiler yüklenemedi.</p></div>`;
    } finally {
        if (tip === 'ana') yukleniyorAna = false; else yukleniyorKesfet = false;
    }
}

function gonderiKartOlustur(gonderi) {
    const kart = document.createElement('div');
    kart.className = 'gonderi-kart';
    kart.dataset.id = gonderi.id;

    const zaman = zamanFarki(gonderi.olusturma);
    const rolBadge = gonderi.rol === 'admin' ? '<span class="gonderi-rol-badge">⚡ Admin</span>'
        : gonderi.rol === 'operator' ? '<span class="gonderi-rol-badge">🛡 Op</span>' : '';
    const silBtn = (ben && (ben.id === gonderi.kullanici_id || ben.rol === 'admin'))
        ? `<button class="gonderi-sil-btn" onclick="gonderiSil(${gonderi.id})" title="Sil">🗑</button>` : '';

    let medyaHtml = '';
    if (gonderi.medya_url) {
        if (gonderi.medya_tip === 'foto') {
            medyaHtml = `<div class="gonderi-medya"><img src="${gonderi.medya_url}" onclick="lightboxAc('${gonderi.medya_url}')" alt="Gönderi"></div>`;
        } else if (gonderi.medya_tip === 'video') {
            medyaHtml = `<div class="gonderi-medya"><video src="${gonderi.medya_url}" controls preload="metadata"></video></div>`;
        }
    }

    const begeniClass = gonderi.begenmisMi ? 'begenilmis' : '';
    const begeniIcon = gonderi.begenmisMi ? '❤️' : '🤍';

    kart.innerHTML = `
        <div class="gonderi-ust">
            <div class="gonderi-profil" onclick="profilModalAc(${gonderi.kullanici_id})">
                <div class="gonderi-avatar">
                    ${gonderi.kullanici_avatar
            ? `<img src="${gonderi.kullanici_avatar}">`
            : (gonderi.kullanici_adi ? gonderi.kullanici_adi[0].toUpperCase() : '?')}
                </div>
                <div class="gonderi-bilgi">
                    <span class="gonderi-ad">${esc(gonderi.kullanici_adi)}${rolBadge}</span>
                    <span class="gonderi-zaman">${zaman}</span>
                </div>
            </div>
            ${silBtn}
        </div>
        <div class="gonderi-icerik">
            ${gonderi.metin ? `<div class="gonderi-metin">${esc(gonderi.metin)}</div>` : ''}
            ${medyaHtml}
        </div>
        <div class="gonderi-alt">
            <div class="gonderi-etkilesim">
                <button class="etkilesim-btn ${begeniClass}" onclick="begeniDegistir(${gonderi.id}, this)">
                    <span class="etkilesim-ikon">${begeniIcon}</span>
                    <span class="begeni-sayisi">${gonderi.begeni_sayisi || 0}</span>
                </button>
                <button class="etkilesim-btn" onclick="yorumlariGoster(${gonderi.id})">
                    <span class="etkilesim-ikon">💬</span>
                    <span class="yorum-sayisi">${gonderi.yorum_sayisi || 0}</span>
                </button>
            </div>
        </div>`;
    return kart;
}

function zamanFarki(unix) {
    const fark = Math.floor(Date.now() / 1000) - unix;
    if (fark < 60) return 'Az önce';
    if (fark < 3600) return Math.floor(fark / 60) + 'd önce';
    if (fark < 86400) return Math.floor(fark / 3600) + 'sa önce';
    if (fark < 604800) return Math.floor(fark / 86400) + 'g önce';
    return new Date(unix * 1000).toLocaleDateString('tr-TR');
}

async function begeniDegistir(gonderiId, btn) {
    const token = localStorage.getItem('boom-token');
    const isBegenilmis = btn.classList.contains('begenilmis');
    const action = isBegenilmis ? 'begeniKaldir' : 'begen';

    try {
        const res = await fetch('/api/begen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ gonderiId, action })
        });
        const veri = await res.json();
        if (veri.basarili) {
            const sayiEl = btn.querySelector('.begeni-sayisi');
            const ikonEl = btn.querySelector('.etkilesim-ikon');
            const mevcut = parseInt(sayiEl.textContent) || 0;
            if (isBegenilmis) {
                btn.classList.remove('begenilmis');
                ikonEl.textContent = '🤍';
                sayiEl.textContent = Math.max(0, mevcut - 1);
            } else {
                btn.classList.add('begenilmis');
                ikonEl.textContent = '❤️';
                sayiEl.textContent = mevcut + 1;
            }
        }
    } catch (e) { toast('Beğeni hatası', 'hata'); }
}

async function gonderiSil(gonderiId) {
    if (!confirm('Bu gönderiyi silmek istediğinize emin misiniz?')) return;
    const token = localStorage.getItem('boom-token');
    try {
        const res = await fetch(`/api/gonderi/${gonderiId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Gönderi silindi');
            document.querySelector(`.gonderi-kart[data-id="${gonderiId}"]`)?.remove();
            gonderilerAna = gonderilerAna.filter(g => g.id !== gonderiId);
            gonderilerKesfet = gonderilerKesfet.filter(g => g.id !== gonderiId);
        } else { toast('Silme hatası: ' + veri.hata, 'hata'); }
    } catch (e) { toast('Silme hatası', 'hata'); }
}

function gonderiEkleModalAc() {
    document.getElementById('gonderiMetin').value = '';
    gonderiMedyaIptal();
    document.getElementById('gonderiEkleModal').style.display = 'flex';
    setTimeout(() => document.getElementById('gonderiMetin').focus(), 200);
}

async function gonderiPaylas() {
    const metin = document.getElementById('gonderiMetin').value.trim();
    const dosyaInput = document.getElementById('gonderiMedyaInput');
    const dosya = dosyaInput.files[0];
    if (!metin && !dosya) { toast('Gönderi metni veya medya eklemelisiniz!', 'hata'); return; }

    const btn = document.getElementById('gonderiPaylasBtn');
    btn.disabled = true; btn.textContent = 'Paylaşılıyor...';

    const token = localStorage.getItem('boom-token');
    const formData = new FormData();
    formData.append('metin', metin);
    if (dosya) formData.append('medya', dosya);

    try {
        const res = await fetch('/api/gonderi', {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Gönderi paylaşıldı! 🎉');
            modalKapat('gonderiEkleModal');
            // Her iki listeyi yenile
            gonderilerAna = []; sayfaAna = 0;
            gonderilerKesfet = []; sayfaKesfet = 0;
            if (aktifSayfa === 'akis') {
                document.getElementById('gonderiListesiAna').innerHTML = '<div class="yukleniyor-kart"><div class="yukleniyor-animasyon"></div><span>Yükleniyor...</span></div>';
                akisYukle('ana');
            } else if (aktifSayfa === 'kesfet') {
                document.getElementById('gonderiListesiKesfet').innerHTML = '<div class="yukleniyor-kart"><div class="yukleniyor-animasyon"></div><span>Yükleniyor...</span></div>';
                akisYukle('kesfet');
            }
        } else { toast('Paylaşım hatası: ' + (veri.hata || 'Bilinmeyen hata'), 'hata'); }
    } catch (e) { toast('Paylaşım hatası', 'hata'); } finally {
        btn.disabled = false; btn.textContent = 'Paylaş';
    }
}

async function yorumlariGoster(gonderiId) {
    aktifGonderiId = gonderiId;
    const modalIcerik = document.getElementById('yorumModalIcerik');
    if (modalIcerik) modalIcerik.innerHTML = '<div class="yukleniyor-kart"><div class="yukleniyor-animasyon"></div><span>Yükleniyor...</span></div>';
    document.getElementById('yorumMetin').value = '';
    document.getElementById('yorumModal').style.display = 'flex';

    try {
        const res = await fetch(`/api/yorumlar/${gonderiId}`);
        const veri = await res.json();
        if (veri.basarili) {
            if (!modalIcerik) return;
            if (veri.yorumlar.length === 0) {
                modalIcerik.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">Henüz yorum yok. İlk yorumu sen yap!</div>';
            } else {
                modalIcerik.innerHTML = '';
                veri.yorumlar.forEach(y => modalIcerik.appendChild(yorumItemOlustur(y)));
            }
        }
    } catch (e) {
        if (modalIcerik) modalIcerik.innerHTML = '<div style="text-align:center;padding:20px;color:var(--kirmizi)">Yorumlar yüklenemedi.</div>';
    }
}

function yorumItemOlustur(yorum) {
    const div = document.createElement('div');
    div.className = 'yorum-item';
    div.dataset.id = yorum.id;
    const silBtn = (ben && (ben.id === yorum.kullanici_id || ben.rol === 'admin'))
        ? `<button class="yorum-sil-btn" onclick="yorumSil(${yorum.id}, this)">🗑</button>` : '';
    div.innerHTML = `
        <div class="yorum-avatar" onclick="profilModalAc(${yorum.kullanici_id})">
            ${yorum.avatar_url ? `<img src="${yorum.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : (yorum.kullanici_adi?.[0]?.toUpperCase() || '?')}
        </div>
        <div class="yorum-icerik">
            <div class="yorum-ust">
                <span class="yorum-ad" onclick="profilModalAc(${yorum.kullanici_id})">${esc(yorum.kullanici_adi)}</span>
                <span class="yorum-zaman">${zamanFarki(yorum.olusturma)}</span>
                ${silBtn}
            </div>
            <div class="yorum-metin">${esc(yorum.metin)}</div>
        </div>`;
    return div;
}

async function yorumGonder() {
    const metin = document.getElementById('yorumMetin').value.trim();
    if (!metin) { toast('Yorum metni boş olamaz!', 'hata'); return; }
    const token = localStorage.getItem('boom-token');
    try {
        const res = await fetch('/api/yorum', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ gonderiId: aktifGonderiId, metin })
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Yorum eklendi');
            document.getElementById('yorumMetin').value = '';
            yorumlariGoster(aktifGonderiId);
            // Yorum sayısını güncelle
            document.querySelectorAll(`.gonderi-kart[data-id="${aktifGonderiId}"] .yorum-sayisi`).forEach(el => {
                el.textContent = parseInt(el.textContent || '0') + 1;
            });
        } else { toast('Yorum hatası: ' + veri.hata, 'hata'); }
    } catch (e) { toast('Yorum gönderilemedi', 'hata'); }
}

async function yorumSil(yorumId, btn) {
    if (!confirm('Bu yorumu silmek istiyor musunuz?')) return;
    const token = localStorage.getItem('boom-token');
    try {
        const res = await fetch(`/api/yorum/${yorumId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Yorum silindi');
            btn.closest('.yorum-item')?.remove();
            document.querySelectorAll(`.gonderi-kart[data-id="${aktifGonderiId}"] .yorum-sayisi`).forEach(el => {
                el.textContent = Math.max(0, parseInt(el.textContent || '0') - 1);
            });
        } else { toast('Silme hatası', 'hata'); }
    } catch (e) { toast('Silme hatası', 'hata'); }
}

// ==================== PROFİL MODAL ====================

async function profilModalAc(kullaniciId) {
    const token = localStorage.getItem('boom-token');
    document.getElementById('profilModal').style.display = 'flex';
    document.getElementById('profilModalIcerik').innerHTML = `
        <div style="text-align:center;padding:40px">
            <div class="yukleniyor-animasyon" style="margin:0 auto 12px;display:block"></div>
            <span style="color:var(--t3)">Profil yükleniyor...</span>
        </div>`;

    try {
        const res = await fetch(`/api/profil/${kullaniciId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (!veri.basarili) throw new Error(veri.hata);

        const profil = veri.profil;
        const benMi = ben && ben.id === profil.id;

        let takipBtn = '';
        if (!benMi) {
            takipBtn = `<button class="profil-modal-takip-btn ${profil.takipEdiyorMu ? 'takip-ediliyor' : ''}" 
                onclick="takipDegistir(${profil.id}, this)">
                ${profil.takipEdiyorMu ? '✓ Takip Ediliyor' : '+ Takip Et'}
            </button>
            <button class="profil-modal-dm-btn" onclick="modalKapat('profilModal');dmAcById(${profil.id})">
                💬 Mesaj
            </button>`;
        }

        let biyografiAlani = '';
        if (benMi) {
            biyografiAlani = `<div class="profil-bio-edit-wrap">
                <textarea rows="3" placeholder="Kendini tanıt...">${esc(profil.bio || '')}</textarea>
                <button class="modal-btn onay" style="margin-top:8px;width:100%" onclick="bioGuncelle(this)">Bio Güncelle</button>
            </div>`;
        } else if (profil.bio) {
            biyografiAlani = `<p class="profil-modal-bio-goster">${esc(profil.bio)}</p>`;
        }

        document.getElementById('profilModalIcerik').innerHTML = `
            <div class="profil-modal-wrap">
                <div class="profil-modal-kapak"></div>
                <div class="profil-modal-ust">
                    <div class="profil-modal-avatar-sarici">
                        <div class="profil-modal-avatar">
                            ${profil.avatar_url ? `<img src="${profil.avatar_url}" style="width:100%;height:100%;object-fit:cover">`
                : (profil.kullanici_adi?.[0]?.toUpperCase() || '?')}
                        </div>
                    </div>
                    <div class="profil-modal-ad">${esc(profil.kullanici_adi)}</div>
                    ${biyografiAlani}
                    <div class="profil-modal-stats">
                        <div class="stat-item"><div class="stat-sayi">${profil.takipciSayisi}</div><div class="stat-etiket">Takipçi</div></div>
                        <div class="stat-item"><div class="stat-sayi">${profil.takipEdilenSayisi}</div><div class="stat-etiket">Takip</div></div>
                    </div>
                    <div class="profil-aksiyonlar">${takipBtn}</div>
                </div>
                <div class="profil-sekme-baslik">📝 Gönderiler</div>
                <div class="profil-gonderi-listesi" id="profilGonderiListesi">
                    <div class="yukleniyor-kart"><div class="yukleniyor-animasyon"></div><span>Yükleniyor...</span></div>
                </div>
            </div>`;

        // Profil gönderilerini yükle
        profilGonderileriYukle(profil.id);

    } catch (e) {
        console.error(e);
        document.getElementById('profilModalIcerik').innerHTML = `<div style="text-align:center;padding:30px;color:var(--kirmizi)">Profil yüklenemedi.</div>`;
    }
}

async function profilGonderileriYukle(kullaniciId) {
    const token = localStorage.getItem('boom-token');
    const liste = document.getElementById('profilGonderiListesi');
    if (!liste) return;

    try {
        // Keşfet endpoint'ini kullanıp filtrele
        const res = await fetch(`/api/kesfet?sayfa=0`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (!veri.basarili) { liste.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Gönderiler yüklenemedi.</div>'; return; }

        const kisiGonderileri = veri.gonderiler.filter(g => g.kullanici_id === kullaniciId);
        if (kisiGonderileri.length === 0) {
            liste.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Henüz gönderi yok.</div>';
            return;
        }

        liste.innerHTML = '';
        kisiGonderileri.forEach(g => {
            const div = document.createElement('div');
            div.className = 'profil-gonderi-mini';
            div.onclick = () => { yorumlariGoster(g.id); };
            div.innerHTML = `
                <div class="profil-gonderi-mini-metin">${esc(g.metin || (g.medya_url ? '📷 Medya paylaşımı' : ''))}</div>
                <div class="profil-gonderi-mini-zaman">${zamanFarki(g.olusturma)} · ❤️ ${g.begeni_sayisi} · 💬 ${g.yorum_sayisi}</div>`;
            liste.appendChild(div);
        });
    } catch (e) {
        liste.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Gönderiler yüklenemedi.</div>';
    }
}

function kisiselProfilAc() {
    if (ben) profilModalAc(ben.id);
}

async function takipDegistir(kullaniciId, btn) {
    const token = localStorage.getItem('boom-token');
    const takipEdiyorMu = btn.classList.contains('takip-ediliyor');
    const action = takipEdiyorMu ? 'takipBirak' : 'takipEt';
    try {
        const res = await fetch('/api/takip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ takipEdilenId: kullaniciId, action })
        });
        const veri = await res.json();
        if (veri.basarili) {
            if (takipEdiyorMu) {
                btn.classList.remove('takip-ediliyor');
                btn.textContent = '+ Takip Et';
            } else {
                btn.classList.add('takip-ediliyor');
                btn.textContent = '✓ Takip Ediliyor';
            }
            toast(takipEdiyorMu ? 'Takip bırakıldı' : '✓ Takip ediliyor');
        } else { toast('Hata: ' + veri.hata, 'hata'); }
    } catch (e) { toast('İşlem hatası', 'hata'); }
}

async function bioGuncelle(btn) {
    const textarea = btn.previousElementSibling;
    const yeniBio = textarea.value.trim();
    const token = localStorage.getItem('boom-token');
    btn.disabled = true; btn.textContent = 'Güncelleniyor...';
    try {
        const res = await fetch('/api/profil/guncelle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ bio: yeniBio })
        });
        const veri = await res.json();
        if (veri.basarili) { toast('Bio güncellendi ✓'); if (ben) ben.bio = yeniBio; }
        else { toast('Güncelleme hatası', 'hata'); }
    } catch (e) { toast('Güncelleme hatası', 'hata'); }
    finally { btn.disabled = false; btn.textContent = 'Bio Güncelle'; }
}

function dmAcById(kullaniciId) {
    const k = kullanicilar[kullaniciId];
    if (k) { navGit('sohbet'); dmAc(k); }
    else toast('Kullanıcı çevrimiçi değil, DM açılamadı.', 'hata');
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
    if (ben.rol === 'admin') { rolEl.textContent = '⚡ Admin'; rolEl.className = 'profil-durum-rol admin'; }
    else if (ben.rol === 'operator') { rolEl.textContent = '🛡 Operatör'; rolEl.className = 'profil-durum-rol operator'; }
    else { rolEl.textContent = 'Üye'; rolEl.className = 'profil-durum-rol'; }
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
        div.onclick = () => { navGit('sohbet'); odaGir(oda.ad); sidebarKapat(); };
        div.innerHTML = `
            <span class="kanal-ikon">#</span>
            <span style="flex:1">${esc(oda.ad)}</span>
            <span class="mesaj-sayaci oda-sayac" id="oda-sayac-${oda.ad}" style="display:none"></span>
            ${(ben?.rol === 'admin') && oda.ad !== 'genel'
                ? `<button class="oda-sil-btn admin-only" onclick="event.stopPropagation();odaSil(${oda.id})">✕</button>` : ''}`;
        liste.appendChild(div);
    });
}

function gruplaRiRender() {
    const liste = document.getElementById('grupListesi');
    if (!liste) return;
    liste.innerHTML = '';
    gruplar.forEach(grup => {
        const div = document.createElement('div');
        div.className = 'dm-item' + (aktifMod === 'grup' && aktifGrup?.id === grup.id ? ' aktif-dm' : '');
        div.setAttribute('data-grup-id', grup.id);
        div.onclick = () => { navGit('sohbet'); grupAc(grup); sidebarKapat(); };
        div.innerHTML = `
            <div class="dm-avatar" style="background:var(--mavi);font-size:12px">👥</div>
            <div style="flex:1;min-width:0">
                <div class="dm-ad">${esc(grup.ad)}</div>
                <div style="font-size:10px;color:var(--t3)">${grup.uyeler?.length || 0} üye</div>
            </div>
            <span class="mesaj-sayaci dm-badge" id="grup-sayac-${grup.id}" style="display:none"></span>`;
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
        div.onclick = () => { navGit('sohbet'); dmAc(k); sidebarKapat(); };
        const rolBadge = k.rol === 'admin' ? '<span class="admin-badge">ADMİN</span>'
            : k.rol === 'operator' ? '<span class="admin-badge" style="background:var(--yesil)">OP</span>' : '';
        div.innerHTML = `
            <div class="kullanici-avatar">
                ${k.avatarUrl ? `<img src="${k.avatarUrl}" style="width:100%;height:100%;object-fit:cover">` : k.ad[0].toUpperCase()}
                <div class="online-badge"></div>
            </div>
            <span class="kullanici-ad-metin">${esc(k.ad)}</span>
            ${rolBadge}`;
        liste.appendChild(div);
    });
}

function odaBadgeGuncelle(odaAdi) {
    const el = document.getElementById('oda-sayac-' + odaAdi); if (!el) return;
    const sayi = odaOkunmamis[odaAdi] || 0;
    el.style.display = sayi === 0 ? 'none' : 'flex';
    if (sayi > 0) el.textContent = sayi > 99 ? '99+' : sayi;
}

function grupBadgeGuncelle(grupId) {
    const el = document.getElementById('grup-sayac-' + grupId); if (!el) return;
    const sayi = grupOkunmamis[grupId] || 0;
    el.style.display = sayi === 0 ? 'none' : 'flex';
    if (sayi > 0) el.textContent = sayi > 99 ? '99+' : sayi;
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

// ==================== ODA / DM / GRUP ====================

function odaGir(odaAdi) {
    if (!odaAdi) return;
    aktifMod = 'oda'; aktifOda = odaAdi; aktifKullanici = null; aktifGrup = null;
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
    if (_cachedOdaMesajlar[odaAdi]) {
        _cachedOdaMesajlar[odaAdi].forEach(m => mesajRender(m, false, 'oda'));
        kaydir();
    }
    socket.emit('oda-gir', odaAdi);
    inputAktifEt('# ' + odaAdi + ' kanalına mesaj yaz...');
    sagPanelGizle();
}

function dmAc(kullanici) {
    aktifMod = 'dm'; aktifKullanici = kullanici; aktifGrup = null;
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

function grupAc(grup) {
    aktifMod = 'grup'; aktifGrup = grup; aktifKullanici = null;
    yaziyorOda.clear(); _ayracEklendi = false;
    document.querySelectorAll('.oda-item').forEach(e => e.classList.remove('aktif-oda'));
    document.querySelectorAll('.dm-item').forEach(e => e.classList.remove('aktif-dm'));
    document.querySelector(`[data-grup-id="${grup.id}"]`)?.classList.add('aktif-dm');
    delete grupOkunmamis[grup.id];
    grupBadgeGuncelle(grup.id);
    document.getElementById('headerBaslik').innerHTML =
        `<span class="header-ikon" style="color:var(--yesil)">👥</span><span id="headerAd">${esc(grup.ad)}</span>`;
    grupHeaderAksiyonlariGuncelle();
    document.getElementById('mesajAlani').innerHTML = ''; _sonGonderenId = null;
    socket.emit('grup-gir', grup.id);
    inputAktifEt('👥 ' + grup.ad + ' grubuna mesaj yaz...');
    sagPanelGizle();
}

function grupHeaderAksiyonlariGuncelle() {
    const aksiyonlar = document.getElementById('headerAksiyonlar');
    let html = `<button class="aksiyon-btn mavi" onclick="grupUyeEkleModal()">➕ <span class="aksiyon-yazi">Üye</span></button>
                <button class="aksiyon-btn" onclick="grupAyrilOnay()">🚪 <span class="aksiyon-yazi">Ayrıl</span></button>`;
    if (ben?.rol === 'admin') {
        html += `<button class="aksiyon-btn tehlikeli" onclick="adminGrupSil(${aktifGrup?.id})">🗑 <span class="aksiyon-yazi">Sil</span></button>`;
    }
    aksiyonlar.innerHTML = html;
}

function grupUyeEkleModal() {
    if (!aktifGrup) return;
    const mevcutIdler = new Set(aktifGrup.uyeler?.map(u => u.id) || []);
    const eklenebilir = Object.values(kullanicilar).filter(k => !mevcutIdler.has(k.id));
    if (eklenebilir.length === 0) { toast('Eklenebilecek kullanıcı yok'); return; }
    let html = '<div style="max-height:300px;overflow-y:auto">';
    eklenebilir.forEach(k => {
        html += `<label style="display:flex;align-items:center;gap:8px;padding:8px;cursor:pointer;border-radius:var(--r-sm)">
            <input type="checkbox" value="${k.id}" style="width:14px;height:14px">
            <span>${esc(k.ad)}</span></label>`;
    });
    html += '</div>';
    document.getElementById('engelModalIcerik').innerHTML = html;
    document.querySelector('#engelModal .modal-baslik').textContent = 'Üye Ekle';
    document.getElementById('engelOnayBtn').textContent = 'Ekle';
    document.getElementById('engelOnayBtn').onclick = () => {
        const secili = [...document.querySelectorAll('#engelModal input:checked')].map(el => parseInt(el.value));
        secili.forEach(uid => socket.emit('grup-uye-ekle', { grupId: aktifGrup.id, uyeId: uid }));
        modalKapat('engelModal');
    };
    document.getElementById('engelModal').style.display = 'flex';
}

function grupAyrilOnay() {
    if (!aktifGrup) return;
    if (confirm('"' + aktifGrup.ad + '" grubundan ayrılmak istediğinize emin misiniz?')) {
        socket.emit('grup-ayril', aktifGrup.id);
    }
}

function adminGrupSil(grupId) {
    if (!confirm('Bu grubu silmek istediğinize emin misiniz?')) return;
    socket.emit('admin-grup-sil', grupId);
}

function dmListesineEkle(kullanici) {
    if (document.querySelector(`[data-dm-id="${kullanici.id}"]`)) return;
    const liste = document.getElementById('dmListesi');
    const div = document.createElement('div');
    div.className = 'dm-item'; div.setAttribute('data-dm-id', kullanici.id);
    div.onclick = () => { navGit('sohbet'); dmAc(kullanici); sidebarKapat(); };
    div.innerHTML = `
        <div class="dm-avatar">
            ${kullanici.avatarUrl ? `<img src="${kullanici.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : kullanici.ad[0].toUpperCase()}
        </div>
        <span class="dm-ad">${esc(kullanici.ad)}</span>`;
    liste.appendChild(div);
}

function adminHeaderGuncelle() {
    const aksiyonlar = document.getElementById('headerAksiyonlar');
    const yetkili = ben?.rol === 'admin' || ben?.rol === 'operator';
    if (!yetkili) { aksiyonlar.innerHTML = ''; return; }
    let html = '';
    if (yetkili) html += `<button class="aksiyon-btn tehlikeli" onclick="odaTemizle()">🗑 <span class="aksiyon-yazi">Temizle</span></button>`;
    if (ben?.rol === 'admin') html = `<button class="aksiyon-btn mavi" onclick="adminPanelAc()">⚡ <span class="aksiyon-yazi">Admin</span></button>` + html;
    aksiyonlar.innerHTML = html;
}

function headerAksiyonlarGuncelle() {
    if (!aktifKullanici) { document.getElementById('headerAksiyonlar').innerHTML = ''; return; }
    const engellendi = engelliIdler.has(aktifKullanici.id);
    const yetkili = ben?.rol === 'admin' || ben?.rol === 'operator';
    let html = `
        <button class="aksiyon-btn mavi" onclick="aramaBaslat('${aktifKullanici.id}','sesli')" title="Sesli Ara">📞</button>
        <button class="aksiyon-btn mavi" onclick="aramaBaslat('${aktifKullanici.id}','goruntulu')" title="Görüntülü Ara">📹</button>`;
    html += engellendi
        ? `<button class="aksiyon-btn" onclick="engelKaldir('${aktifKullanici.id}')">✅ <span class="aksiyon-yazi">Engeli Kaldır</span></button>`
        : `<button class="aksiyon-btn tehlikeli" onclick="engelleModal('${aktifKullanici.id}')">🚫 <span class="aksiyon-yazi">Engelle</span></button>`;
    if (yetkili && aktifKullanici.rol === 'uye') {
        html += `<button class="aksiyon-btn ban" onclick="banModalAc('${aktifKullanici.id}')">⛔ <span class="aksiyon-yazi">Banla</span></button>`;
    }
    document.getElementById('headerAksiyonlar').innerHTML = html;
}

function sagPanelGuncelle() {
    if (!aktifKullanici) { sagPanelGizle(); return; }
    const k = aktifKullanici; const engellendi = engelliIdler.has(k.id);
    const yetkili = ben?.rol === 'admin' || ben?.rol === 'operator';
    document.getElementById('sagPanel').style.display = 'block';
    document.getElementById('sagPanelIcerik').innerHTML = `
        <div class="sag-panel-profil">
            <div class="sag-panel-avatar" onclick="profilModalAc(${k.id})" style="cursor:pointer">
                ${k.avatarUrl ? `<img src="${k.avatarUrl}" style="width:100%;height:100%;object-fit:cover">` : k.ad[0].toUpperCase()}
            </div>
            <div class="sag-panel-ad">${esc(k.ad)}</div>
            ${k.bio ? `<div style="font-size:11px;color:var(--t2);padding:4px 8px;text-align:center">${esc(k.bio)}</div>` : ''}
            <div class="sag-panel-durum"><span class="online-nokta"></span> Çevrimiçi</div>
        </div>
        <div class="sag-panel-aksiyonlar">
            <button class="arama-baslat-btn" onclick="profilModalAc(${k.id})">👤 Profil</button>
            <button class="arama-baslat-btn" onclick="aramaBaslat('${k.id}','sesli')">📞 Sesli Ara</button>
            <button class="arama-baslat-btn goruntulu" onclick="aramaBaslat('${k.id}','goruntulu')">📹 Görüntülü</button>
            ${engellendi
            ? `<button class="aksiyon-btn" onclick="engelKaldir('${k.id}')">✅ Engeli Kaldır</button>`
            : `<button class="aksiyon-btn tehlikeli" onclick="engelleModal('${k.id}')">🚫 Engelle</button>`}
            ${yetkili && k.rol === 'uye' ? `<button class="aksiyon-btn ban" onclick="banModalAc('${k.id}')">⛔ Banla</button>` : ''}
        </div>`;
}

function sagPanelGizle() { document.getElementById('sagPanel').style.display = 'none'; }

// ==================== YENİ GRUP ====================

function yeniGrupModal() {
    document.getElementById('yeniGrupModal').style.display = 'flex';
    const liste = document.getElementById('grupUyeListesi');
    liste.innerHTML = '';
    Object.values(kullanicilar).forEach(k => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 0;cursor:pointer;border-bottom:1px solid var(--kenar)';
        label.innerHTML = `<input type="checkbox" value="${k.id}" style="width:14px;height:14px">
            <div style="display:flex;align-items:center;gap:6px">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--mavi);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;overflow:hidden">
                    ${k.avatarUrl ? `<img src="${k.avatarUrl}" style="width:100%;height:100%;object-fit:cover">` : k.ad[0].toUpperCase()}
                </div>
                <span style="font-size:13px">${esc(k.ad)}</span>
            </div>`;
        liste.appendChild(label);
    });
}

function yeniGrupOlustur() {
    const ad = document.getElementById('yeniGrupAdi').value.trim();
    if (!ad) { toast('Grup adı gerekli!', 'hata'); return; }
    const secili = [...document.querySelectorAll('#grupUyeListesi input:checked')].map(el => parseInt(el.value));
    if (secili.length === 0) { toast('En az 1 üye seçin!', 'hata'); return; }
    socket.emit('grup-olustur', { ad, uyeIdler: secili });
    modalKapat('yeniGrupModal');
    document.getElementById('yeniGrupAdi').value = '';
}

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
    let p;
    if (aktifMod === 'oda') p = { tip: 'oda', odaAdi: aktifOda };
    else if (aktifMod === 'grup') p = { tip: 'grup', grupId: aktifGrup?.id };
    else p = { tip: 'dm', aliciId: aktifKullanici?.id };
    socket.emit('yaziyor-basladi', p);
    yaziyorTimer = setTimeout(() => socket.emit('yaziyor-bitti', p), 2500);
});

async function mesajGonder() {
    // MAVİ BOT kontrolü
    if (aktifMod === 'dm' && aktifKullanici &&
        aktifKullanici.ad?.toLowerCase().replace(/\s/g, '').includes('mavibot')) {
        const input2 = document.getElementById('mesajInput');
        const metin2 = input2.value.trim();
        if (!metin2) return;
        input2.value = ''; input2.style.height = 'auto';
        const kullaniciMesaj = {
            id: 'usr-' + Date.now(), tip: 'ozel',
            gonderenId: ben.id, gonderenAd: ben.ad, gonderenAvatar: ben.avatarUrl,
            aliciId: aktifKullanici.id, metin: metin2,
            zaman: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            okundu: true
        };
        mesajRender(kullaniciMesaj, true, 'dm');
        document.getElementById('yaziyorAlan').textContent = 'Mavi Bot yazıyor...';
        socket.emit('mavi-bot-mesaj', { mesaj: metin2 });
        return;
    }

    const input = document.getElementById('mesajInput');
    const metin = input.value.trim();
    if (!metin && !bekleyenDosya) return;

    let dosyaUrl = null, dosyaBilgi = {};
    if (bekleyenDosya) {
        try {
            const fd = new FormData();
            fd.append('dosya', bekleyenDosya.file);
            const res = await fetch('/api/dosya', { method: 'POST', body: fd });
            const veri = await res.json();
            dosyaUrl = veri.url || null;
            dosyaBilgi = { tip: veri.tip, ad: veri.ad, boyut: veri.boyut };
        } catch (e) { toast('Dosya yüklenemedi!', 'hata'); return; }
        fotoyuIptalEt();
    }

    const payload = {
        metin,
        foto: dosyaBilgi.tip === 'foto' ? dosyaUrl : null,
        dosyaAd: dosyaUrl && dosyaBilgi.tip !== 'foto' ? dosyaBilgi.ad : null,
        dosyaBoyut: dosyaBilgi.boyut || null,
        mesajTip: dosyaBilgi.tip === 'video' ? 'video' : dosyaBilgi.tip === 'pdf' ? 'pdf' : dosyaBilgi.tip === 'dosya' ? 'dosya' : 'mesaj'
    };
    if (['video', 'pdf', 'dosya'].includes(dosyaBilgi.tip)) payload.foto = dosyaUrl;

    if (aktifMod === 'oda') socket.emit('oda-mesaj', { odaAdi: aktifOda, ...payload });
    else if (aktifMod === 'grup') socket.emit('grup-mesaj', { grupId: aktifGrup.id, ...payload });
    else if (aktifKullanici) socket.emit('ozel-mesaj', { aliciId: aktifKullanici.id, ...payload });

    input.value = ''; input.style.height = 'auto';
    const p = aktifMod === 'oda' ? { tip: 'oda', odaAdi: aktifOda }
        : aktifMod === 'grup' ? { tip: 'grup', grupId: aktifGrup?.id }
            : { tip: 'dm', aliciId: aktifKullanici?.id };
    socket.emit('yaziyor-bitti', p);
}

function fotoyuIptalEt() {
    bekleyenDosya = null;
    document.getElementById('fotoOnizlemeAlan').style.display = 'none';
    document.getElementById('fotoOnizlemeImg').src = '';
    document.getElementById('fotoOnizlemeImg').style.display = 'none';
    if (document.getElementById('fotoOnizlemeAd')) document.getElementById('fotoOnizlemeAd').textContent = '';
}

// ==================== MESAJ RENDER ====================

function mesajRender(mesaj, kayirYap = true, mod = 'oda') {
    const alan = document.getElementById('mesajAlani');
    if (mesaj.tip === 'sistem') {
        const d = document.createElement('div'); d.className = 'sistem-mesaj';
        d.innerHTML = `<span>${esc(mesaj.metin)} — ${mesaj.zaman}</span>`;
        alan.appendChild(d); _sonGonderenId = null;
    } else {
        alan.appendChild(mesajWrap(mesaj, mod));
    }
    if (kayirYap) kaydir();
}

function mesajWrap(mesaj, mod = 'oda') {
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

    let balonIcerik = '';
    if (mesaj.foto && mesaj.tip === 'video') {
        balonIcerik = `<video src="${mesaj.foto}" class="mesaj-foto" controls style="max-width:260px;max-height:200px;border-radius:12px"></video>`;
    } else if (mesaj.foto && mesaj.tip === 'pdf') {
        balonIcerik = `<a href="${mesaj.foto}" target="_blank" class="dosya-link pdf">
            <span class="dosya-ikon">📄</span>
            <span class="dosya-bilgi"><span class="dosya-ad">${esc(mesaj.dosyaAd || 'PDF')}</span><span class="dosya-boyut">${dosyaBoyutStr(mesaj.dosyaBoyut)}</span></span></a>`;
    } else if (mesaj.foto && mesaj.tip === 'dosya') {
        balonIcerik = `<a href="${mesaj.foto}" target="_blank" class="dosya-link">
            <span class="dosya-ikon">📎</span>
            <span class="dosya-bilgi"><span class="dosya-ad">${esc(mesaj.dosyaAd || 'Dosya')}</span><span class="dosya-boyut">${dosyaBoyutStr(mesaj.dosyaBoyut)}</span></span></a>`;
    } else if (mesaj.foto) {
        balonIcerik = `<img src="${mesaj.foto}" class="mesaj-foto" onclick="lightboxAc('${mesaj.foto}')" alt="Fotoğraf">`;
    } else {
        balonIcerik = `<div class="mesaj-balon">${esc(mesaj.metin)}</div>`;
    }

    const yetkili = ben?.rol === 'admin' || ben?.rol === 'operator';
    const silBtn = yetkili ? `<button class="mesaj-sil-btn" onclick="mesajSilIste('${mesaj.id}')" title="Sil">🗑</button>` : '';

    const okunduHTML = benim
        ? `<div class="mesaj-alt">${silBtn}<span class="mesaj-zaman-alt">${mesaj.zaman}</span><span class="okundu-ikon${mesaj.okundu ? ' goruldu' : ''}">${mesaj.okundu ? '✓✓' : '✓'}</span></div>`
        : `<div class="mesaj-alt">${silBtn}<span class="mesaj-zaman-alt">${mesaj.zaman}</span></div>`;

    wrap.innerHTML = `
        <div class="mesaj-row">
            <div class="mesaj-avatar ${yeniBlok ? '' : 'gizli'}" onclick="profilModalAc(${k.id})" style="cursor:pointer">${avatarHTML}</div>
            <div class="mesaj-icerik">
                ${yeniBlok && !benim ? `<div class="mesaj-meta"><span class="mesaj-yazar" onclick="profilModalAc(${k.id})" style="cursor:pointer">${esc(k.ad)}</span><span class="mesaj-zaman-meta">${mesaj.zaman}</span></div>` : ''}
                ${balonIcerik}
                ${okunduHTML}
            </div>
        </div>`;
    return wrap;
}

function mesajSilIste(mesajId) {
    if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
    socket.emit('mesaj-sil', {
        mesajId,
        odaAdi: aktifMod === 'oda' ? aktifOda : null,
        grupId: aktifMod === 'grup' ? aktifGrup?.id : null
    });
}

function kaydir() {
    const alan = document.getElementById('mesajAlani');
    requestAnimationFrame(() => { alan.scrollTop = alan.scrollHeight; });
}

function yaziyorGuncelle() {
    const el = document.getElementById('yaziyorAlan');
    if (aktifMod === 'oda' || aktifMod === 'grup') {
        el.textContent = yaziyorOda.size === 0 ? '' : [...yaziyorOda].map(v => v.split('|')[1]).join(', ') + ' yazıyor...';
    } else {
        el.textContent = yaziyorOzel ? yaziyorOzel + ' yazıyor...' : '';
    }
}

// ==================== ADMİN ====================

async function adminPanelAc() {
    document.getElementById('adminPanelIcerik').innerHTML = '<div style="text-align:center;padding:20px;color:var(--t2)">Yükleniyor...</div>';
    document.getElementById('adminModal').style.display = 'flex';
    try {
        const token = localStorage.getItem('boom-token');
        const res = await fetch('/api/admin/kullanicilar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const veri = await res.json();
        if (!veri.basarili) { document.getElementById('adminPanelIcerik').innerHTML = '<p style="color:var(--kirmizi)">Hata: ' + veri.hata + '</p>'; return; }
        adminPanelRender(veri.liste);
    } catch (e) {
        document.getElementById('adminPanelIcerik').innerHTML = '<p style="color:var(--kirmizi)">Bağlantı hatası</p>';
    }
}

function adminPanelRender(liste) {
    const aktifOnline = Object.values(kullanicilar);
    let html = `
    <div class="admin-sekmeler" style="display:flex;gap:0;margin-bottom:16px;background:var(--bg-input2);border-radius:var(--r-md);padding:3px;border:1px solid var(--kenar);flex-wrap:wrap">
        <button class="admin-sekme aktif" onclick="adminSekme('kullanicilar', this)" style="flex:1;min-width:80px;padding:7px;border:none;background:var(--mavi);color:white;border-radius:calc(var(--r-md) - 2px);cursor:pointer;font-size:11px;font-weight:600">👥 Kullanıcılar (${liste.length})</button>
        <button class="admin-sekme" onclick="adminSekme('online', this)" style="flex:1;min-width:80px;padding:7px;border:none;background:transparent;color:var(--t2);border-radius:calc(var(--r-md) - 2px);cursor:pointer;font-size:11px;font-weight:600">🟢 Online (${aktifOnline.length})</button>
        <button class="admin-sekme" onclick="adminSekme('banlar', this)" style="flex:1;min-width:80px;padding:7px;border:none;background:transparent;color:var(--t2);border-radius:calc(var(--r-md) - 2px);cursor:pointer;font-size:11px;font-weight:600">🚫 Banlar</button>
        <button class="admin-sekme" onclick="adminSekme('ipbanlar', this)" style="flex:1;min-width:80px;padding:7px;border:none;background:transparent;color:var(--t2);border-radius:calc(var(--r-md) - 2px);cursor:pointer;font-size:11px;font-weight:600">🌐 IP Ban</button>
        <button class="admin-sekme" onclick="adminSekme('botlar', this)" style="flex:1;min-width:80px;padding:7px;border:none;background:transparent;color:var(--t2);border-radius:calc(var(--r-md) - 2px);cursor:pointer;font-size:11px;font-weight:600">🤖 Botlar</button>
    </div>
 
    <div id="adminSekme-kullanicilar">
        <input type="text" oninput="adminAra(this.value)" placeholder="🔍 Kullanıcı ara..." class="form-input" style="margin-bottom:10px;font-size:13px">
        <div id="adminKullaniciListe" style="max-height:380px;overflow-y:auto">`;

    liste.forEach(k => {
        const onlineEl = aktifOnline.find(u => u.id === k.id);
        const rolRenk = k.rol === 'admin' ? 'var(--mavi2)' : k.rol === 'operator' ? 'var(--yesil)' : 'var(--t3)';
        html += `
        <div class="admin-kullanici-satir" data-ad="${esc(k.kullanici_adi.toLowerCase())}">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--mavi);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;overflow:hidden;flex-shrink:0;position:relative">
                    ${k.avatar_url ? `<img src="${k.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : k.kullanici_adi[0].toUpperCase()}
                    ${onlineEl ? '<div style="position:absolute;bottom:0;right:0;width:8px;height:8px;background:var(--yesil);border-radius:50%;border:1.5px solid var(--bg-panel)"></div>' : ''}
                </div>
                <div style="min-width:0">
                    <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(k.kullanici_adi)}</div>
                    <div style="font-size:10px;color:${rolRenk}">${k.rol}${k.banli ? ' · 🚫 Banlı' : ''}</div>
                </div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
                ${k.id !== ben.id ? `
                <select onchange="adminRolDegistir(${k.id}, this.value)" style="padding:4px;background:var(--bg-input2);border:1px solid var(--kenar);border-radius:var(--r-sm);color:var(--t1);font-size:11px">
                    <option value="uye" ${k.rol === 'uye' ? 'selected' : ''}>Üye</option>
                    <option value="operator" ${k.rol === 'operator' ? 'selected' : ''}>Operatör</option>
                    <option value="bot" ${k.rol === 'bot' ? 'selected' : ''}>Bot</option>
                    <option value="admin" ${k.rol === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button class="admin-btn mavi" onclick="adminKullaniciIplerGoster_modal(${k.id}, '${esc(k.kullanici_adi)}')" title="IP'leri Gör">🌐</button>
                <button class="admin-btn mavi" onclick="adminSifreSifirla(${k.id}, '${esc(k.kullanici_adi)}')">🔑</button>
                ${k.banli
                    ? `<button class="admin-btn yesil" onclick="socket.emit('admin-ban-kaldir',${k.id});adminPanelAc()">✅</button>`
                    : `<button class="admin-btn ban" onclick="banModalAc(${k.id});modalKapat('adminModal')">⛔</button>`}
                <button class="admin-btn" style="background:rgba(239,68,68,.1);color:var(--kirmizi);border:1px solid rgba(239,68,68,.2)" onclick="adminKullaniciSil(${k.id},'${esc(k.kullanici_adi)}')">🗑</button>
                ` : '<span style="font-size:11px;color:var(--t3)">Sen</span>'}
            </div>
        </div>`;
    });

    html += `</div></div>
 
    <div id="adminSekme-online" style="display:none"><div style="max-height:380px;overflow-y:auto">`;
    if (aktifOnline.length === 0) {
        html += '<p style="font-size:12px;color:var(--t3);text-align:center;padding:20px">Başka online kullanıcı yok</p>';
    } else {
        aktifOnline.forEach(k => {
            html += `<div class="admin-kullanici-satir">
                <span class="admin-kullanici-ad">${esc(k.ad)} <span style="color:var(--t3);font-size:11px">${k.rol}</span></span>
                ${k.rol === 'uye' ? `<button class="admin-btn ban" onclick="banModalAc('${k.id}');modalKapat('adminModal')">⛔ Banla</button>` : ''}
            </div>`;
        });
    }
    html += `</div></div>
 
    <div id="adminSekme-banlar" style="display:none">
        <button class="admin-btn mavi" onclick="socket.emit('admin-ban-listesi-iste')" style="margin-bottom:8px">Listeyi Yükle</button>
        <div id="adminBanListesi" style="max-height:380px;overflow-y:auto"></div>
    </div>
 
    <!-- ==================== IP BAN SEKMESİ ==================== -->
    <div id="adminSekme-ipbanlar" style="display:none;padding:4px 0">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--t1)">🌐 IP Ban Yönetimi</div>
        
        <!-- Manuel IP Ban Formu -->
        <div style="background:var(--bg-input2);border:1px solid var(--kenar);border-radius:var(--r-lg);padding:12px;margin-bottom:12px">
            <div style="font-size:12px;font-weight:600;color:var(--t2);margin-bottom:8px">Yeni IP Banla</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <input type="text" id="manuelIpAdresi" class="form-input" placeholder="IP Adresi (örn: 192.168.1.1)" style="flex:1;min-width:140px;font-size:13px">
                <input type="text" id="manuelIpSebep" class="form-input" placeholder="Sebep" style="flex:1;min-width:120px;font-size:13px">
                <input type="number" id="manuelIpSure" class="form-input" placeholder="Süre (dk, 0=kalıcı)" value="0" min="0" style="width:80px;font-size:13px">
            </div>
            <button class="modal-btn tehlikeli" onclick="manuelIpBanla()" style="margin-top:8px;width:100%">🌐 IP'yi Banla</button>
        </div>
 
        <!-- Aktif IP Banlar Listesi -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:12px;font-weight:600;color:var(--t2)">Aktif IP Banlar</span>
            <button class="admin-btn mavi" onclick="socket.emit('admin-ip-ban-listesi-iste')" style="font-size:11px">🔄 Yenile</button>
        </div>
        <div id="adminIpBanListesi" style="max-height:280px;overflow-y:auto">
            <p style="font-size:12px;color:var(--t3);text-align:center;padding:16px">"Yenile" butonuna bas listei gör</p>
        </div>
    </div>
    <!-- ==================== /IP BAN SEKMESİ ==================== -->
 
    <div id="adminSekme-botlar" style="display:none;padding:4px 0">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--t1)">📢 Sarı Bot — Reklam Mesajı</div>
        <textarea id="sariBotMesaj" class="form-input" rows="3" placeholder="Reklam mesajını yaz..." style="width:100%;resize:none;margin-bottom:8px;font-family:inherit"></textarea>
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-end">
            <div style="flex:1">
                <label class="form-etiket">ARALIK (Dakika)</label>
                <input type="number" id="sariBotSure" class="form-input" value="30" min="1" style="font-size:13px">
            </div>
        </div>
        <div style="margin-bottom:10px">
            <label class="form-etiket">ODALAR</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:var(--bg-input2);border:1px solid var(--kenar);border-radius:var(--r-md)">
                ${odalar.map(o => `
                    <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:4px 8px;background:var(--bg-hover);border-radius:var(--r-sm)">
                        <input type="checkbox" value="${esc(o.ad)}" style="width:13px;height:13px"> #${esc(o.ad)}
                    </label>`).join('')}
            </div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="modal-btn onay" onclick="sariBotBaslat()" style="flex:1">▶ Başlat</button>
            <button class="modal-btn tehlikeli" onclick="sariBotDurdur()" style="flex:1">⏹ Durdur</button>
        </div>
    </div>`;

    document.getElementById('adminPanelIcerik').innerHTML = html;

    // IP ban olaylarını dinle
    socket.off('admin-ip-ban-listesi');
    socket.on('admin-ip-ban-listesi', (liste) => adminIpBanListesiGoster(liste));
    socket.off('admin-kullanici-ipler');
    socket.on('admin-kullanici-ipler', ({ kullaniciId, ipler }) => {
        // Bu event geldiğinde toast ile göster
        adminKullaniciIplerToast(kullaniciId, ipler);
    });
}

// IP Ban liste render
function adminIpBanListesiGoster(liste) {
    const el = document.getElementById('adminIpBanListesi');
    if (!el) return;
    if (!liste || liste.length === 0) {
        el.innerHTML = '<p style="font-size:12px;color:var(--t3);text-align:center;padding:16px">Aktif IP ban yok 🎉</p>';
        return;
    }
    el.innerHTML = liste.map(b => {
        const kalan = b.bitis_zaman
            ? Math.ceil((b.bitis_zaman - Math.floor(Date.now() / 1000)) / 60) + ' dk kaldı'
            : 'Kalıcı';
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--kenar);flex-wrap:wrap">
            <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;font-family:monospace;color:var(--kirmizi)">${esc(b.ip_adresi)}</div>
                <div style="font-size:10px;color:var(--t3)">${esc(b.sebep || 'Sebepsiz')} · ${kalan} · Admin: ${esc(b.admin_adi)}</div>
            </div>
            <button class="admin-btn yesil" onclick="socket.emit('admin-ip-ban-kaldir', ${b.id}); this.closest('div').remove();">✅ Kaldır</button>
        </div>`;
    }).join('');
}

// Manuel IP ban
function manuelIpBanla() {
    const ip = document.getElementById('manuelIpAdresi')?.value.trim();
    const sebep = document.getElementById('manuelIpSebep')?.value.trim();
    const sure = parseInt(document.getElementById('manuelIpSure')?.value) || 0;
    if (!ip) { toast('IP adresi girin!', 'hata'); return; }
    socket.emit('admin-ip-banla', { ipAdresi: ip, sebep, sureDk: sure });
    toast(`🌐 ${ip} banlanıyor...`);
    document.getElementById('manuelIpAdresi').value = '';
    document.getElementById('manuelIpSebep').value = '';
    // Listeyi güncelle
    setTimeout(() => socket.emit('admin-ip-ban-listesi-iste'), 500);
}

// Kullanıcı IP'lerini modal ile göster
function adminKullaniciIplerGoster_modal(kullaniciId, kullaniciAdi) {
    socket.emit('admin-kullanici-ipler-iste', kullaniciId);
    toast(`🌐 ${kullaniciAdi}'nın IP'leri yükleniyor...`);
}

// IP'leri toast/overlay olarak göster
function adminKullaniciIplerToast(kullaniciId, ipler) {
    if (!ipler || ipler.length === 0) {
        toast('Bu kullanıcı için IP kaydı yok.', 'bilgi');
        return;
    }

    // Basit bir overlay/modal ile göster
    const mevcutOverlay = document.getElementById('iplerOverlay');
    if (mevcutOverlay) mevcutOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'iplerOverlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2000;
        display:flex;align-items:center;justify-content:center;padding:16px
    `;

    overlay.innerHTML = `
        <div style="background:var(--bg-panel);border:1px solid var(--kenar2);border-radius:var(--r-xl);padding:20px;max-width:400px;width:100%;max-height:80vh;overflow-y:auto">
            <div style="font-size:15px;font-weight:700;margin-bottom:12px">🌐 Kullanıcı IP Adresleri</div>
            ${ipler.map(ip => `
                <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--kenar)">
                    <code style="flex:1;font-size:13px;color:var(--mavi2)">${esc(ip.ip_adresi)}</code>
                    <span style="font-size:10px;color:var(--t3)">${new Date(ip.son_baglanti * 1000).toLocaleDateString('tr-TR')}</span>
                    <button class="admin-btn ban" onclick="hizliIpBanla('${esc(ip.ip_adresi)}')" style="font-size:10px">⛔ Ban</button>
                </div>
            `).join('')}
            <button class="modal-btn iptal" onclick="this.closest('#iplerOverlay').remove()" style="width:100%;margin-top:12px">Kapat</button>
        </div>`;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

// Hızlı IP ban (overlay içinden)
function hizliIpBanla(ipAdresi) {
    if (!confirm(`"${ipAdresi}" IP'sini kalıcı olarak banlamak istiyor musunuz?`)) return;
    socket.emit('admin-ip-banla', { ipAdresi, sebep: 'Admin tarafından banlandı', sureDk: 0 });
    toast(`🌐 ${ipAdresi} banlandı!`);
    document.getElementById('iplerOverlay')?.remove();
}

// adminSekme fonksiyonunu güncelle (ipbanlar sekmesini destekle)
function adminSekme(id, btn) {
    document.querySelectorAll('.admin-sekme').forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--t2)'; });
    btn.style.background = 'var(--mavi)'; btn.style.color = 'white';
    ['kullanicilar', 'online', 'banlar', 'ipbanlar', 'botlar'].forEach(s => {
        const el = document.getElementById('adminSekme-' + s);
        if (el) el.style.display = s === id ? 'block' : 'none';
    });

    // IP ban sekmesi açıldığında otomatik yükle
    if (id === 'ipbanlar') {
        setTimeout(() => socket.emit('admin-ip-ban-listesi-iste'), 100);
    }
}

function adminSekme(id, btn) {
    document.querySelectorAll('.admin-sekme').forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--t2)'; });
    btn.style.background = 'var(--mavi)'; btn.style.color = 'white';
    ['kullanicilar', 'online', 'banlar', 'botlar'].forEach(s => {
        const el = document.getElementById('adminSekme-' + s);
        if (el) el.style.display = s === id ? 'block' : 'none';
    });
}

function adminAra(aranan) {
    document.querySelectorAll('#adminKullaniciListe .admin-kullanici-satir').forEach(s => {
        s.style.display = s.getAttribute('data-ad')?.includes(aranan.toLowerCase()) ? 'flex' : 'none';
    });
}

async function adminRolDegistir(hedefId, yeniRol) {
    const token = localStorage.getItem('boom-token');
    const res = await fetch('/api/admin/rol-degistir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, hedefId, yeniRol })
    });
    const veri = await res.json();
    if (veri.basarili) { toast('✅ Rol güncellendi!'); socket.emit('admin-rol-ata', { hedefId, rol: yeniRol }); }
    else toast('❌ ' + veri.hata, 'hata');
}

async function adminSifreSifirla(hedefId, ad) {
    const yeniSifre = prompt(ad + ' için yeni şifre girin (en az 4 karakter):');
    if (!yeniSifre || yeniSifre.length < 4) { toast('Geçersiz şifre', 'hata'); return; }
    const token = localStorage.getItem('boom-token');
    const res = await fetch('/api/admin/sifre-sifirla', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, hedefId, yeniSifre })
    });
    const veri = await res.json();
    if (veri.basarili) toast('✅ Şifre sıfırlandı!');
    else toast('❌ ' + veri.hata, 'hata');
}

async function adminKullaniciSil(hedefId, ad) {
    if (!confirm('"' + ad + '" kullanıcısını kalıcı olarak silmek istediğinize emin misiniz?')) return;
    const token = localStorage.getItem('boom-token');
    const res = await fetch('/api/admin/kullanici-sil', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, hedefId })
    });
    const veri = await res.json();
    if (veri.basarili) { toast('✅ Kullanıcı silindi!'); adminPanelAc(); }
    else toast('❌ ' + veri.hata, 'hata');
}

function adminBanListesiGoster(liste) {
    const el = document.getElementById('adminBanListesi'); if (!el) return;
    if (liste.length === 0) { el.innerHTML = '<p style="font-size:12px;color:var(--t3);text-align:center;padding:20px">Aktif ban yok</p>'; return; }
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
    document.querySelector('#engelModal .modal-baslik').textContent = 'Kullanıcıyı Engelle';
    document.getElementById('engelOnayBtn').textContent = 'Engelle';
    document.getElementById('engelOnayBtn').onclick = () => { socket.emit('engelle', hedefId); modalKapat('engelModal'); };
    document.getElementById('engelModal').style.display = 'flex';
}

function engelKaldir(hedefId) { socket.emit('engel-kaldir', hedefId); }

function banModalAc(hedefId) {
    document.getElementById('banSebep').value = '';
    document.getElementById('banSure').value = '0';

    // IP ban checkbox'ı ekle
    const modalEl = document.getElementById('banModal');
    const mevcut = modalEl.querySelector('.ip-ban-secim');
    if (!mevcut) {
        const ipBanDiv = document.createElement('div');
        ipBanDiv.className = 'form-alan ip-ban-secim';
        ipBanDiv.innerHTML = `
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 0">
                <input type="checkbox" id="ipBanDaCheckbox" style="width:16px;height:16px;cursor:pointer">
                <span style="font-size:13px;color:var(--t1)">🌐 IP adresini de banla <span style="color:var(--kirmizi);font-size:11px">(Farklı hesapla da giremez)</span></span>
            </label>`;
        const aksiyonlar = modalEl.querySelector('.modal-aksiyonlar');
        modalEl.querySelector('.modal').insertBefore(ipBanDiv, aksiyonlar);
    } else {
        document.getElementById('ipBanDaCheckbox').checked = false;
    }

    document.getElementById('banOnayBtn').onclick = () => {
        const sebep = document.getElementById('banSebep').value.trim();
        const sure = parseInt(document.getElementById('banSure').value) || 0;
        const ipBanDa = document.getElementById('ipBanDaCheckbox')?.checked || false;
        socket.emit('admin-banla', { hedefId: parseInt(hedefId), sebep, sureDk: sure, ipBanDa });
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
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `<span class="toast-ikon">${tip === 'hata' ? '⚠️' : 'ℹ️'}</span><span>${esc(mesaj)}</span>`;
    kap.appendChild(div);
    setTimeout(() => { div.classList.add('cikis'); setTimeout(() => div.remove(), 250); }, 3500);
}

// ==================== GÜVENLİK ====================

function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ==================== WebRTC ====================

let pcBaglanti = null;
let yerelStream = null;
let aramaHedefId = null;
let aramaKabul = false;
let videoAcik = true;
let sesAcik = true;

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

async function aramaBaslat(hedefId, tip = 'goruntulu') {
    aramaHedefId = hedefId; aramaKabul = false;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        toast('⚠️ Sesli/görüntülü için HTTPS gerekli!', 'hata'); return;
    }
    if (!navigator.mediaDevices?.getUserMedia) { toast('⚠️ Tarayıcınız desteklemiyor!', 'hata'); return; }
    try {
        yerelStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: tip === 'goruntulu' ? { facingMode: 'user' } : false });
    } catch (e) {
        if (e.name === 'NotAllowedError') toast('❌ Kamera/mikrofon izni verilmedi!', 'hata');
        else if (e.name === 'NotFoundError') toast('❌ Kamera/mikrofon bulunamadı!', 'hata');
        else toast('❌ Hata: ' + e.message, 'hata');
        return;
    }
    aramaPenceresiniAc('arayan', tip);
    const yerelVideoEl = document.getElementById('yerelVideo');
    if (yerelVideoEl) yerelVideoEl.srcObject = yerelStream;
    socket.emit('arama-baslat', { hedefId: parseInt(hedefId), tip });
    toast('📞 Bağlanıyor...');
}

function webrtcOlaylariKur() {
    if (window._webrtcOlaylarKuruldu) return;
    window._webrtcOlaylarKuruldu = true;

    socket.on('gelen-arama', ({ arayanId, arayanAd, arayanAvatar, tip }) => {
        aramaHedefId = arayanId;
        gelenAramaPenceresiniAc(arayanId, arayanAd, arayanAvatar, tip);
    });

    socket.on('arama-kabul-edildi', async ({ kabulEdenId }) => {
        aramaKabul = true; toast('✅ Arama kabul edildi!');
        await webrtcBaslat(kabulEdenId, true);
    });

    socket.on('arama-reddedildi', () => { toast('❌ Arama reddedildi.', 'hata'); aramayiKapat(); });
    socket.on('arama-kapandi', () => { toast('📵 Arama sonlandırıldı.'); aramayiKapat(); });
    socket.on('arama-hata', (mesaj) => { toast('⚠️ ' + mesaj, 'hata'); aramayiKapat(); });

    socket.on('webrtc-offer', async ({ gonderenId, offer }) => { await webrtcCevapVer(gonderenId, offer); });
    socket.on('webrtc-answer', async ({ answer }) => {
        if (pcBaglanti) await pcBaglanti.setRemoteDescription(new RTCSessionDescription(answer));
    });
    socket.on('ice-candidate', async ({ candidate }) => {
        try { if (pcBaglanti && candidate) await pcBaglanti.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { }
    });
}

async function webrtcBaslat(hedefId, arayan = true) {
    pcBaglanti = new RTCPeerConnection(RTC_CONFIG);
    if (yerelStream) yerelStream.getTracks().forEach(track => pcBaglanti.addTrack(track, yerelStream));
    pcBaglanti.ontrack = (e) => { const v = document.getElementById('uzakVideo'); if (v && e.streams[0]) v.srcObject = e.streams[0]; };
    pcBaglanti.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', { hedefId, candidate: e.candidate }); };
    pcBaglanti.onconnectionstatechange = () => {
        const d = document.getElementById('aramaDurum'); if (!d) return;
        if (pcBaglanti.connectionState === 'connected') d.textContent = '🟢 Bağlandı';
        else if (pcBaglanti.connectionState === 'disconnected') { d.textContent = '🔴 Bağlantı kesildi'; setTimeout(aramayiKapat, 2000); }
    };
    if (arayan) {
        const offer = await pcBaglanti.createOffer();
        await pcBaglanti.setLocalDescription(offer);
        socket.emit('webrtc-offer', { hedefId, offer });
    }
}

async function webrtcCevapVer(gonderenId, offer) {
    pcBaglanti = new RTCPeerConnection(RTC_CONFIG);
    if (yerelStream) yerelStream.getTracks().forEach(track => pcBaglanti.addTrack(track, yerelStream));
    pcBaglanti.ontrack = (e) => { const v = document.getElementById('uzakVideo'); if (v && e.streams[0]) v.srcObject = e.streams[0]; };
    pcBaglanti.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', { hedefId: gonderenId, candidate: e.candidate }); };
    pcBaglanti.onconnectionstatechange = () => {
        const d = document.getElementById('aramaDurum'); if (!d) return;
        if (pcBaglanti.connectionState === 'connected') d.textContent = '🟢 Bağlandı';
        else if (pcBaglanti.connectionState === 'disconnected') { d.textContent = '🔴 Bağlantı kesildi'; setTimeout(aramayiKapat, 2000); }
    };
    await pcBaglanti.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pcBaglanti.createAnswer();
    await pcBaglanti.setLocalDescription(answer);
    socket.emit('webrtc-answer', { hedefId: gonderenId, answer });
}

function aramayiKapat() {
    if (pcBaglanti) { pcBaglanti.close(); pcBaglanti = null; }
    if (yerelStream) { yerelStream.getTracks().forEach(t => t.stop()); yerelStream = null; }
    aramaHedefId = null; aramaKabul = false; videoAcik = true; sesAcik = true;
    document.getElementById('aramaPenceresi')?.remove();
    document.getElementById('gelenAramaPenceresi')?.remove();
}

function aramaKapat() {
    if (aramaHedefId) socket.emit('arama-kapat', { hedefId: aramaHedefId });
    aramayiKapat();
}

async function aramaKabulEt(arayanId, tip) {
    aramaKabul = true;
    document.getElementById('gelenAramaPenceresi')?.remove();
    if (!navigator.mediaDevices?.getUserMedia) { toast('⚠️ Tarayıcınız desteklemiyor!', 'hata'); socket.emit('arama-reddet', { arayanId }); return; }
    try {
        yerelStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: tip === 'goruntulu' ? { facingMode: 'user' } : false });
    } catch (e) { toast('❌ Kamera/mikrofon hatası', 'hata'); socket.emit('arama-reddet', { arayanId }); return; }
    aramaPenceresiniAc('alan', tip);
    document.getElementById('yerelVideo').srcObject = yerelStream;
    socket.emit('arama-kabul', { arayanId });
    await webrtcBaslat(arayanId, false);
}

function aramaReddet(arayanId) {
    socket.emit('arama-reddet', { arayanId });
    document.getElementById('gelenAramaPenceresi')?.remove();
}

function videoToggle() {
    if (!yerelStream) return;
    const track = yerelStream.getVideoTracks()[0]; if (!track) return;
    videoAcik = !videoAcik; track.enabled = videoAcik;
    const btn = document.getElementById('videoBtn');
    if (btn) btn.textContent = videoAcik ? '📹' : '📵';
}

function sesToggle() {
    if (!yerelStream) return;
    const track = yerelStream.getAudioTracks()[0]; if (!track) return;
    sesAcik = !sesAcik; track.enabled = sesAcik;
    const btn = document.getElementById('sesBtn');
    if (btn) btn.textContent = sesAcik ? '🎤' : '🔇';
}

function aramaPenceresiniAc(mod, tip) {
    document.getElementById('aramaPenceresi')?.remove();
    const div = document.createElement('div');
    div.id = 'aramaPenceresi';
    div.className = 'arama-penceresi';
    div.innerHTML = `
        <div class="arama-ust" id="aramaUst">
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

    const ust = div.querySelector('#aramaUst');
    let baslangicX, baslangicY, baslangicLeft, baslangicTop;
    ust.style.cursor = 'move';
    ust.addEventListener('mousedown', (e) => {
        baslangicX = e.clientX; baslangicY = e.clientY;
        const rect = div.getBoundingClientRect();
        baslangicLeft = rect.left; baslangicTop = rect.top;
        div.style.right = 'auto'; div.style.bottom = 'auto';
        div.style.left = baslangicLeft + 'px'; div.style.top = baslangicTop + 'px';
        function onMove(e) {
            div.style.left = (baslangicLeft + e.clientX - baslangicX) + 'px';
            div.style.top = (baslangicTop + e.clientY - baslangicY) + 'px';
        }
        function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

function gelenAramaPenceresiniAc(arayanId, arayanAd, arayanAvatar, tip) {
    document.getElementById('gelenAramaPenceresi')?.remove();
    const div = document.createElement('div');
    div.id = 'gelenAramaPenceresi';
    div.className = 'gelen-arama-penceresi';
    div.innerHTML = `
        <div class="gelen-arama-icerik">
            <div class="gelen-arama-avatar">${arayanAvatar ? `<img src="${arayanAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : arayanAd[0].toUpperCase()}</div>
            <div class="gelen-arama-ad">${esc(arayanAd)}</div>
            <div class="gelen-arama-tip">${tip === 'goruntulu' ? '📹 Görüntülü arama' : '📞 Sesli arama'}</div>
            <div class="gelen-arama-butonlar">
                <button class="arama-btn kabul-btn" onclick="aramaKabulEt('${arayanId}','${tip}')">✅</button>
                <button class="arama-btn ret-btn" onclick="aramaReddet('${arayanId}')">❌</button>
            </div>
        </div>`;
    document.body.appendChild(div);
}


// ==================== STORY SİSTEMİ - script.js'e EKLENECEK KODLAR ====================
// Bu kodları mevcut script.js dosyanızın SONUNA ekleyin (console.log satırından önce)

// ==================== STORY STATE ====================
let storyKullanicilar = [];
let aktifStoryKullaniciIndex = 0;
let aktifStoryIndex = 0;
let aktifKullaniciStoryleri = [];
let storyTimer = null;
let storyYorumlarGoster = false;
const STORY_SURE_MS = 5000; // Her story 5 saniye

// ==================== STORY ÇUBUGU YÜKLE ====================
async function storyCubuguYukle() {
    const token = localStorage.getItem('boom-token');
    if (!token) return;

    // Kendi avatarını ekle
    const kisiselAvatar = document.getElementById('kisiselStoryAvatar');
    if (kisiselAvatar && ben) {
        kisiselAvatar.innerHTML = ben.avatarUrl
            ? `<img src="${ben.avatarUrl}" style="width:100%;height:100%;object-fit:cover">`
            : (ben.ad?.[0]?.toUpperCase() || '?');
    }

    try {
        const res = await fetch('/api/story/kullanicilar', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (!veri.basarili) return;

        storyKullanicilar = veri.kullanicilar;
        const icerik = document.getElementById('storyCubuguIcerik');
        if (!icerik) return;

        // Sadece story olan kullanıcıları temizle (ilk item "Story Ekle" butonu - onu koru)
        const mevcutItems = icerik.querySelectorAll('.story-item');
        mevcutItems.forEach(el => el.remove());

        storyKullanicilar.forEach((k, idx) => {
            const div = document.createElement('div');
            div.className = 'story-item';
            div.setAttribute('data-idx', idx);
            div.onclick = () => storyAc(idx);

            const gorulmemis = k.goruulmemis > 0;
            const benim = ben && k.kullanici_id === ben.id;

            const avHTML = k.avatar_url
                ? `<img src="${k.avatar_url}" style="width:100%;height:100%;object-fit:cover">`
                : (k.kullanici_adi?.[0]?.toUpperCase() || '?');

            div.innerHTML = `
                <div class="story-halka ${gorulmemis ? '' : 'goruldu'} ${benim ? 'benim' : ''}" style="position:relative">
                    <div class="story-avatar-wrap">
                        <div class="story-avatar">${avHTML}</div>
                    </div>
                    ${gorulmemis ? `<div class="story-gorulmemis-badge">${k.goruulmemis}</div>` : ''}
                </div>
                <span class="story-ad">${esc(benim ? 'Senin' : k.kullanici_adi)}</span>`;
            icerik.appendChild(div);
        });
    } catch (e) {
        console.error('Story çubuğu yükleme hatası:', e);
    }
}

// ==================== STORY AÇ ====================
async function storyAc(kullaniciIdx) {
    if (kullaniciIdx < 0 || kullaniciIdx >= storyKullanicilar.length) return;

    aktifStoryKullaniciIndex = kullaniciIdx;
    aktifStoryIndex = 0;

    const kullanici = storyKullanicilar[kullaniciIdx];
    const token = localStorage.getItem('boom-token');

    try {
        const res = await fetch(`/api/story/kullanici/${kullanici.kullanici_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (!veri.basarili || veri.storyler.length === 0) {
            toast('Bu kullanıcının aktif storyleri yok', 'bilgi');
            return;
        }

        aktifKullaniciStoryleri = veri.storyler;
        storyGoster();
        document.getElementById('storyViewer').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } catch (e) {
        toast('Story yüklenemedi', 'hata');
    }
}

// ==================== STORY GÖSTER ====================
function storyGoster() {
    clearTimeout(storyTimer);

    if (aktifStoryIndex >= aktifKullaniciStoryleri.length) {
        // Bu kullanıcının storyleri bitti, sonraki kullanıcıya geç
        const sonrakiIdx = aktifStoryKullaniciIndex + 1;
        if (sonrakiIdx < storyKullanicilar.length) {
            aktifStoryKullaniciIndex = sonrakiIdx;
            aktifStoryIndex = 0;
            storyAc(aktifStoryKullaniciIndex);
        } else {
            storyViewerKapat();
        }
        return;
    }

    const story = aktifKullaniciStoryleri[aktifStoryIndex];
    const kullanici = storyKullanicilar[aktifStoryKullaniciIndex];

    // Görüntüleme kaydı
    storyGoruntuleKaydet(story.id);

    // Header
    const avHTML = kullanici.avatar_url
        ? `<img src="${kullanici.avatar_url}" style="width:100%;height:100%;object-fit:cover">`
        : (kullanici.kullanici_adi?.[0]?.toUpperCase() || '?');
    document.getElementById('storyViewerAvatar').innerHTML = avHTML;
    document.getElementById('storyViewerAd').textContent = kullanici.kullanici_adi;

    const bitisSn = story.bitis;
    const now = Math.floor(Date.now() / 1000);
    const kalanSn = bitisSn - now;
    document.getElementById('storyViewerZaman').textContent = storyZamanYazi(kalanSn);

    // Silme butonu (kendi storyi veya admin)
    const silBtn = document.getElementById('storyViewerSilBtn');
    if (silBtn) {
        silBtn.style.display = (ben && (ben.id === story.kullanici_id || ben.rol === 'admin')) ? 'flex' : 'none';
    }

    // Medya
    const medyaDiv = document.getElementById('storyViewerMedya');
    if (story.medya_tip === 'video') {
        medyaDiv.innerHTML = `<video src="${story.medya_url}" autoplay muted loop playsinline style="max-width:100%;max-height:100%;object-fit:contain"></video>`;
    } else {
        medyaDiv.innerHTML = `<img src="${story.medya_url}" alt="Story">`;
    }

    // Metin
    const metinDiv = document.getElementById('storyViewerMetin');
    metinDiv.textContent = story.metin || '';
    metinDiv.style.display = story.metin ? 'block' : 'none';

    // Beğeni
    const begenBtn = document.getElementById('storyBegenBtn');
    const begenIkon = document.getElementById('storyBegenIkon');
    const begenSayi = document.getElementById('storyBegenSayi');
    if (story.begenildi) {
        begenBtn.classList.add('begenildi');
        begenIkon.textContent = '❤️';
    } else {
        begenBtn.classList.remove('begenildi');
        begenIkon.textContent = '🤍';
    }
    begenSayi.textContent = story.begeni_sayisi || 0;

    // Progress barlar
    const container = document.getElementById('storyProgressContainer');
    container.innerHTML = '';
    aktifKullaniciStoryleri.forEach((_, idx) => {
        const barWrap = document.createElement('div');
        barWrap.className = 'story-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'story-progress-fill';
        if (idx < aktifStoryIndex) fill.classList.add('tamamlandi');
        barWrap.appendChild(fill);
        container.appendChild(barWrap);
    });

    // Mevcut progress bar animasyonu
    const mevcutBar = container.children[aktifStoryIndex]?.querySelector('.story-progress-fill');
    if (mevcutBar) {
        setTimeout(() => {
            mevcutBar.style.transition = `width ${STORY_SURE_MS}ms linear`;
            mevcutBar.style.width = '100%';
        }, 50);
    }

    // Yorumları yükle
    storyYorumlariYukle(story.id);

    // Otomatik geçiş
    storyTimer = setTimeout(() => {
        aktifStoryIndex++;
        storyGoster();
    }, STORY_SURE_MS);
}

function storyZamanYazi(kalanSn) {
    if (kalanSn <= 0) return 'Süresi doldu';
    if (kalanSn < 3600) return Math.ceil(kalanSn / 60) + ' dk kaldı';
    if (kalanSn < 86400) return Math.ceil(kalanSn / 3600) + ' saat kaldı';
    return Math.ceil(kalanSn / 86400) + ' gün kaldı';
}

// ==================== STORY GEZİNME ====================
function storySonraki() {
    clearTimeout(storyTimer);
    aktifStoryIndex++;
    storyGoster();
}

function storyOnceki() {
    clearTimeout(storyTimer);
    if (aktifStoryIndex > 0) {
        aktifStoryIndex--;
        storyGoster();
    } else if (aktifStoryKullaniciIndex > 0) {
        // Önceki kullanıcıya git
        aktifStoryKullaniciIndex--;
        aktifStoryIndex = 0;
        storyAc(aktifStoryKullaniciIndex);
    }
}

// ==================== STORY VIEWER KAPAT ====================
function storyViewerKapat() {
    clearTimeout(storyTimer);
    document.getElementById('storyViewer').style.display = 'none';
    document.body.style.overflow = '';
    aktifKullaniciStoryleri = [];
    aktifStoryIndex = 0;
    // Story çubuğunu yenile
    storyCubuguYukle();
}

// ==================== STORY GÖRÜNTÜLEME KAYDET ====================
async function storyGoruntuleKaydet(storyId) {
    const token = localStorage.getItem('boom-token');
    try {
        await fetch(`/api/story/${storyId}/goruntule`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (e) { }
}

// ==================== STORY BEĞENİ ====================
async function storyBegenDegistir() {
    const story = aktifKullaniciStoryleri[aktifStoryIndex];
    if (!story) return;

    const token = localStorage.getItem('boom-token');
    const begenildi = story.begenildi;
    const action = begenildi ? 'begeniKaldir' : 'begen';

    try {
        const res = await fetch(`/api/story/${story.id}/begen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action })
        });
        const veri = await res.json();
        if (veri.basarili) {
            story.begenildi = !begenildi;
            story.begeni_sayisi = (story.begeni_sayisi || 0) + (begenildi ? -1 : 1);
            const begenBtn = document.getElementById('storyBegenBtn');
            const begenIkon = document.getElementById('storyBegenIkon');
            const begenSayi = document.getElementById('storyBegenSayi');
            if (story.begenildi) {
                begenBtn.classList.add('begenildi');
                begenIkon.textContent = '❤️';
            } else {
                begenBtn.classList.remove('begenildi');
                begenIkon.textContent = '🤍';
            }
            begenSayi.textContent = story.begeni_sayisi;
        }
    } catch (e) { toast('Beğeni hatası', 'hata'); }
}

// ==================== STORY YORUM ====================
async function storyYorumlariYukle(storyId) {
    const yorumDiv = document.getElementById('storyYorumlar');
    if (!yorumDiv) return;
    try {
        const res = await fetch(`/api/story/${storyId}/yorumlar`);
        const veri = await res.json();
        if (!veri.basarili) return;
        yorumDiv.innerHTML = '';
        veri.yorumlar.slice(-5).forEach(y => {
            const div = document.createElement('div');
            div.className = 'story-yorum-item';
            div.innerHTML = `<span class="story-yorum-ad">${esc(y.kullanici_adi)}</span><span class="story-yorum-metin">${esc(y.metin)}</span>`;
            yorumDiv.appendChild(div);
        });
        yorumDiv.scrollTop = yorumDiv.scrollHeight;
    } catch (e) { }
}

async function storyYorumGonder() {
    const input = document.getElementById('storyYorumInput');
    const metin = input?.value?.trim();
    if (!metin) return;

    const story = aktifKullaniciStoryleri[aktifStoryIndex];
    if (!story) return;

    const token = localStorage.getItem('boom-token');
    try {
        const res = await fetch(`/api/story/${story.id}/yorum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ metin })
        });
        const veri = await res.json();
        if (veri.basarili) {
            input.value = '';
            const yorumDiv = document.getElementById('storyYorumlar');
            const div = document.createElement('div');
            div.className = 'story-yorum-item';
            div.innerHTML = `<span class="story-yorum-ad">${esc(ben.ad)}</span><span class="story-yorum-metin">${esc(metin)}</span>`;
            yorumDiv.appendChild(div);
            yorumDiv.scrollTop = yorumDiv.scrollHeight;
        }
    } catch (e) { toast('Yorum gönderilemedi', 'hata'); }
}

// ==================== AKTİF STORYİ SİL ====================
async function aktifStoryiSil() {
    const story = aktifKullaniciStoryleri[aktifStoryIndex];
    if (!story) return;
    if (!confirm('Bu story silinsin mi?')) return;

    const token = localStorage.getItem('boom-token');
    try {
        const res = await fetch(`/api/story/${story.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Story silindi');
            aktifKullaniciStoryleri.splice(aktifStoryIndex, 1);
            if (aktifKullaniciStoryleri.length === 0) {
                storyViewerKapat();
            } else {
                if (aktifStoryIndex >= aktifKullaniciStoryleri.length) aktifStoryIndex--;
                storyGoster();
            }
        }
    } catch (e) { toast('Silme hatası', 'hata'); }
}

// ==================== STORY PAYLAŞ MODAL ====================
function storyEkleModalAc() {
    document.getElementById('storyMedyaInput').value = '';
    document.getElementById('storyOnizleme').innerHTML = `
        <span class="story-yukle-ikon">📷</span>
        <span class="story-yukle-yazi">Fotoğraf veya Video Seç</span>`;
    document.getElementById('storyOnizleme').className = 'story-onizleme-bos';
    document.getElementById('storyMetin').value = '';
    document.getElementById('storySure').value = '86400';
    document.getElementById('storyEkleModal').style.display = 'flex';

    // Medya input listener
    const medyaInput = document.getElementById('storyMedyaInput');
    medyaInput.onchange = function () {
        const dosya = this.files[0];
        if (!dosya) return;
        const reader = new FileReader();
        reader.onload = e => {
            const onizleme = document.getElementById('storyOnizleme');
            onizleme.className = 'story-onizleme-medya';
            if (dosya.type.startsWith('video/')) {
                onizleme.innerHTML = `<video src="${e.target.result}" autoplay muted loop style="width:100%;max-height:260px;object-fit:cover"></video>`;
            } else {
                onizleme.innerHTML = `<img src="${e.target.result}" style="width:100%;max-height:260px;object-fit:cover">`;
            }
        };
        reader.readAsDataURL(dosya);
    };
}

async function storyPaylas() {
    const medyaInput = document.getElementById('storyMedyaInput');
    const dosya = medyaInput?.files[0];
    if (!dosya) { toast('Lütfen bir fotoğraf veya video seçin!', 'hata'); return; }

    const btn = document.getElementById('storyPaylasBtn');
    btn.disabled = true; btn.textContent = 'Yükleniyor...';

    const token = localStorage.getItem('boom-token');
    const formData = new FormData();
    formData.append('medya', dosya);
    formData.append('metin', document.getElementById('storyMetin').value.trim());
    formData.append('sureSn', document.getElementById('storySure').value);

    try {
        const res = await fetch('/api/story', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Story paylaşıldı! 🎉');
            modalKapat('storyEkleModal');
            storyCubuguYukle();
        } else {
            toast('Paylaşım hatası: ' + (veri.hata || 'Bilinmeyen hata'), 'hata');
        }
    } catch (e) {
        toast('Paylaşım hatası', 'hata');
    } finally {
        btn.disabled = false; btn.textContent = 'Paylaş';
    }
}

// ==================== KLAVYE İLE STORY GEZİNME ====================
document.addEventListener('keydown', e => {
    const viewer = document.getElementById('storyViewer');
    if (!viewer || viewer.style.display === 'none') return;
    if (e.key === 'ArrowRight') storySonraki();
    else if (e.key === 'ArrowLeft') storyOnceki();
    else if (e.key === 'Escape') storyViewerKapat();
});

// ==================== STORY YORUM INPUT ENTER ====================
document.addEventListener('DOMContentLoaded', () => {
    const storyYorumInput = document.getElementById('storyYorumInput');
    if (storyYorumInput) {
        storyYorumInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); storyYorumGonder(); }
        });
        // Story açıkken timer duraksın
        storyYorumInput.addEventListener('focus', () => { clearTimeout(storyTimer); });
        storyYorumInput.addEventListener('blur', () => {
            if (aktifKullaniciStoryleri.length > 0) {
                storyTimer = setTimeout(() => { aktifStoryIndex++; storyGoster(); }, 2000);
            }
        });
    }
});
// ==================== REELS SİSTEMİ ====================

let reelsListesi = [];
let reelsYukleniyor = false;
let reelsSayfa = 0;
let aktifReelIndex = 0;
let aktifReelsYorumGonderiId = null;

// ---- Reels Yükle ----
async function reelsYukle(sifirla = false) {
    if (reelsYukleniyor) return;
    if (sifirla) { reelsSayfa = 0; reelsListesi = []; }
    reelsYukleniyor = true;

    const token = localStorage.getItem('boom-token');
    const container = document.getElementById('reelsContainer');

    try {
        const res = await fetch(`/api/reels?sayfa=${reelsSayfa}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (!veri.basarili) throw new Error(veri.hata);

        if (sifirla) container.innerHTML = '';

        if (veri.reels.length === 0 && reelsSayfa === 0) {
            container.innerHTML = `
                <div class="reel-item">
                    <div class="reels-bos">
                        <div class="reels-bos-ikon">🎬</div>
                        <p style="font-size:16px;font-weight:600">Henüz Reels yok</p>
                        <p style="font-size:13px">İlk Reels'i sen paylaş!</p>
                    </div>
                </div>`;
            return;
        }

        veri.reels.forEach(r => {
            reelsListesi.push(r);
            container.appendChild(reelItemOlustur(r));
        });

        if (veri.reels.length > 0) reelsSayfa++;

    } catch (e) {
        console.error('Reels yükleme hatası:', e);
        if (reelsSayfa === 0) {
            container.innerHTML = `<div class="reel-item"><div class="reels-bos"><div class="reels-bos-ikon">⚠️</div><p>Reels yüklenemedi</p></div></div>`;
        }
    } finally {
        reelsYukleniyor = false;
    }
}

// ---- Reel Item HTML Oluştur ----
function reelItemOlustur(reel) {
    const div = document.createElement('div');
    div.className = 'reel-item';
    div.dataset.id = reel.id;

    const avHTML = reel.kullanici_avatar
        ? `<img src="${reel.kullanici_avatar}" alt="">`
        : (reel.kullanici_adi?.[0]?.toUpperCase() || '?');

    const silBtn = (ben && (ben.id === reel.kullanici_id || ben.rol === 'admin'))
        ? `<button class="reel-sil-btn" onclick="reelSil(${reel.id}, this)" title="Sil">🗑</button>` : '';

    const begeniClass = reel.begenildi ? 'begenildi' : '';
    const begeniIkon = reel.begenildi ? '❤️' : '🤍';

    div.innerHTML = `
        ${silBtn}
        <video class="reel-video" src="${reel.video_url}" loop playsinline preload="metadata"></video>

        <div class="reel-play-overlay">
            <div class="reel-play-ikon" id="reelPlay-${reel.id}">▶</div>
        </div>

        <div class="reel-aksiyonlar">
            <div class="reel-avatar-btn" onclick="profilModalAc(${reel.kullanici_id})">${avHTML}</div>

            <button class="reel-aksiyon-btn ${begeniClass}" onclick="reelBegen(${reel.id}, this)">
                <div class="reel-aksiyon-ikon">${begeniIkon}</div>
                <span class="reel-aksiyon-sayi reel-begeni-sayi">${reel.begeni_sayisi || 0}</span>
            </button>

            <button class="reel-aksiyon-btn" onclick="reelYorumlariGoster(${reel.id})">
                <div class="reel-aksiyon-ikon">💬</div>
                <span class="reel-aksiyon-sayi reel-yorum-sayi">${reel.yorum_sayisi || 0}</span>
            </button>
        </div>

        <div class="reel-bilgi">
            <div class="reel-kullanici" onclick="profilModalAc(${reel.kullanici_id})">
                <span class="reel-kullanici-ad">@${esc(reel.kullanici_adi)}</span>
            </div>
            ${reel.aciklama ? `<div class="reel-aciklama">${esc(reel.aciklama)}</div>` : ''}
        </div>`;

    // Video tıklama: oynat/duraklat
    const video = div.querySelector('.reel-video');
    const playOverlay = div.querySelector('.reel-play-ikon');
    video.addEventListener('click', () => {
        if (video.paused) {
            video.play();
            playOverlay.textContent = '▶';
            playOverlay.classList.remove('goster');
        } else {
            video.pause();
            playOverlay.textContent = '▶';
            playOverlay.classList.add('goster');
        }
    });

    return div;
}

// ---- Intersection Observer: görünen reeli otomatik oynat ----
function reelsObserverKur() {
    const container = document.getElementById('reelsContainer');
    if (!container) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('.reel-video');
            const playIcon = entry.target.querySelector('.reel-play-ikon');
            if (!video) return;

            if (entry.isIntersecting) {
                // Diğer tüm videoları durdur
                document.querySelectorAll('.reel-video').forEach(v => {
                    if (v !== video) { v.pause(); v.currentTime = 0; }
                });
                video.play().catch(() => { });
                if (playIcon) playIcon.classList.remove('goster');

                // Sonsuz scroll: son 2 reel görünüyorsa daha yükle
                const allItems = container.querySelectorAll('.reel-item');
                const idx = Array.from(allItems).indexOf(entry.target);
                if (idx >= allItems.length - 2) reelsYukle();

            } else {
                video.pause();
            }
        });
    }, { threshold: 0.7, root: container });

    // Mevcut itemları observe et
    container.querySelectorAll('.reel-item').forEach(item => observer.observe(item));

    // Yeni eklenenler için MutationObserver
    const mutObs = new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.classList?.contains('reel-item')) observer.observe(node);
            });
        });
    });
    mutObs.observe(container, { childList: true });
}

// ---- Reels Beğen ----
async function reelBegen(reelId, btn) {
    const token = localStorage.getItem('boom-token');
    const isBegenilmis = btn.classList.contains('begenildi');
    const action = isBegenilmis ? 'begeniKaldir' : 'begen';

    try {
        const res = await fetch('/api/reels/begen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ reelId, action })
        });
        const veri = await res.json();
        if (veri.basarili) {
            const sayiEl = btn.querySelector('.reel-begeni-sayi');
            const ikonEl = btn.querySelector('.reel-aksiyon-ikon');
            const mevcut = parseInt(sayiEl.textContent) || 0;
            if (isBegenilmis) {
                btn.classList.remove('begenildi');
                ikonEl.textContent = '🤍';
                sayiEl.textContent = Math.max(0, mevcut - 1);
            } else {
                btn.classList.add('begenildi');
                ikonEl.textContent = '❤️';
                sayiEl.textContent = mevcut + 1;
            }
        }
    } catch (e) { toast('Beğeni hatası', 'hata'); }
}

// ---- Reels Yorumları ----
async function reelYorumlariGoster(reelId) {
    aktifReelsYorumGonderiId = reelId;

    // Mevcut yorum modalını reels için kullan
    const modalIcerik = document.getElementById('yorumModalIcerik');
    if (modalIcerik) modalIcerik.innerHTML = '<div class="yukleniyor-kart"><div class="yukleniyor-animasyon"></div><span>Yükleniyor...</span></div>';
    document.getElementById('yorumMetin').value = '';
    document.querySelector('#yorumModal .modal-baslik').textContent = '💬 Reels Yorumları';

    // Yorum gönder butonunu reels için yönlendir
    document.querySelector('#yorumModal .modal-btn.onay').onclick = reelYorumGonder;

    document.getElementById('yorumModal').style.display = 'flex';

    try {
        const res = await fetch(`/api/reels/${reelId}/yorumlar`);
        const veri = await res.json();
        if (veri.basarili && modalIcerik) {
            if (veri.yorumlar.length === 0) {
                modalIcerik.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">Henüz yorum yok!</div>';
            } else {
                modalIcerik.innerHTML = '';
                veri.yorumlar.forEach(y => modalIcerik.appendChild(reelYorumItemOlustur(y)));
            }
        }
    } catch (e) {
        if (modalIcerik) modalIcerik.innerHTML = '<div style="text-align:center;padding:20px;color:var(--kirmizi)">Yorumlar yüklenemedi.</div>';
    }
}

function reelYorumItemOlustur(yorum) {
    const div = document.createElement('div');
    div.className = 'yorum-item';
    div.dataset.id = yorum.id;
    const silBtn = (ben && (ben.id === yorum.kullanici_id || ben.rol === 'admin'))
        ? `<button class="yorum-sil-btn" onclick="reelYorumSil(${yorum.id}, this)">🗑</button>` : '';
    div.innerHTML = `
        <div class="yorum-avatar" onclick="profilModalAc(${yorum.kullanici_id})">
            ${yorum.avatar_url ? `<img src="${yorum.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : (yorum.kullanici_adi?.[0]?.toUpperCase() || '?')}
        </div>
        <div class="yorum-icerik">
            <div class="yorum-ust">
                <span class="yorum-ad" onclick="profilModalAc(${yorum.kullanici_id})">${esc(yorum.kullanici_adi)}</span>
                <span class="yorum-zaman">${zamanFarki(yorum.olusturma)}</span>
                ${silBtn}
            </div>
            <div class="yorum-metin">${esc(yorum.metin)}</div>
        </div>`;
    return div;
}

async function reelYorumGonder() {
    const metin = document.getElementById('yorumMetin').value.trim();
    if (!metin) { toast('Yorum metni boş olamaz!', 'hata'); return; }
    const token = localStorage.getItem('boom-token');
    try {
        const res = await fetch(`/api/reels/${aktifReelsYorumGonderiId}/yorum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ metin })
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Yorum eklendi');
            document.getElementById('yorumMetin').value = '';
            reelYorumlariGoster(aktifReelsYorumGonderiId);
            // Sayacı güncelle
            document.querySelectorAll(`.reel-item[data-id="${aktifReelsYorumGonderiId}"] .reel-yorum-sayi`).forEach(el => {
                el.textContent = parseInt(el.textContent || '0') + 1;
            });
        } else { toast('Yorum hatası: ' + veri.hata, 'hata'); }
    } catch (e) { toast('Yorum gönderilemedi', 'hata'); }
}

async function reelYorumSil(yorumId, btn) {
    if (!confirm('Bu yorumu silmek istediğinize emin misiniz?')) return;
    const token = localStorage.getItem('boom-token');
    try {
        const res = await fetch(`/api/reels/yorum/${yorumId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Yorum silindi');
            btn.closest('.yorum-item')?.remove();
            document.querySelectorAll(`.reel-item[data-id="${aktifReelsYorumGonderiId}"] .reel-yorum-sayi`).forEach(el => {
                el.textContent = Math.max(0, parseInt(el.textContent || '0') - 1);
            });
        } else { toast('Silme hatası', 'hata'); }
    } catch (e) { toast('Silme hatası', 'hata'); }
}

// ---- Reel Sil ----
async function reelSil(reelId, btn) {
    if (!confirm('Bu Reels\'i silmek istediğinize emin misiniz?')) return;
    const token = localStorage.getItem('boom-token');
    try {
        const res = await fetch(`/api/reels/${reelId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Reels silindi');
            btn.closest('.reel-item')?.remove();
            reelsListesi = reelsListesi.filter(r => r.id !== reelId);
            // Eğer liste boşaldı, yeniden yükle
            if (document.querySelectorAll('.reel-item').length === 0) reelsYukle(true);
        } else { toast('Silme hatası: ' + veri.hata, 'hata'); }
    } catch (e) { toast('Silme hatası', 'hata'); }
}

// ---- Reels Ekle Modal ----
function reelsEkleModalAc() {
    document.getElementById('reelsMedyaInput').value = '';
    document.getElementById('reelsAciklama').value = '';
    document.getElementById('reelsOnizleme').innerHTML = `
        <span style="font-size:48px;opacity:0.5">🎬</span>
        <span style="font-size:13px;color:var(--t3)">Video Seç (Dikey video önerilir)</span>`;
    document.getElementById('reelsOnizleme').className = 'reels-onizleme-bos';
    document.getElementById('reelsEkleModal').style.display = 'flex';

    document.getElementById('reelsMedyaInput').onchange = function () {
        const dosya = this.files[0];
        if (!dosya) return;
        if (!dosya.type.startsWith('video/')) { toast('Sadece video yükleyebilirsiniz!', 'hata'); return; }
        const url = URL.createObjectURL(dosya);
        const onizleme = document.getElementById('reelsOnizleme');
        onizleme.className = '';
        onizleme.innerHTML = `<video src="${url}" class="reels-onizleme-video" muted autoplay loop playsinline></video>`;
    };
}

async function reelsPaylas() {
    const dosyaInput = document.getElementById('reelsMedyaInput');
    const dosya = dosyaInput?.files[0];
    if (!dosya) { toast('Lütfen bir video seçin!', 'hata'); return; }
    if (!dosya.type.startsWith('video/')) { toast('Sadece video yükleyebilirsiniz!', 'hata'); return; }

    const btn = document.getElementById('reelsPaylasBtn');
    btn.disabled = true; btn.textContent = 'Yükleniyor...';

    const token = localStorage.getItem('boom-token');
    const formData = new FormData();
    formData.append('video', dosya);
    formData.append('aciklama', document.getElementById('reelsAciklama').value.trim());

    try {
        const res = await fetch('/api/reels', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const veri = await res.json();
        if (veri.basarili) {
            toast('Reels paylaşıldı! 🎬');
            modalKapat('reelsEkleModal');
            reelsYukle(true);
        } else {
            toast('Paylaşım hatası: ' + (veri.hata || 'Bilinmeyen hata'), 'hata');
        }
    } catch (e) {
        toast('Paylaşım hatası', 'hata');
    } finally {
        btn.disabled = false; btn.textContent = 'Paylaş';
    }
}

// ==================== REELS BİTİŞ ====================
console.log('✅ BOOM Chat v4 Yenilendi - 3 sekmeli navigasyon aktif');
function sariBotBaslat() {
    const mesaj = document.getElementById('sariBotMesaj')?.value.trim();
    const sure = parseInt(document.getElementById('sariBotSure')?.value) || 30;
    const seciliOdalar = [...document.querySelectorAll('#adminSekme-botlar input[type=checkbox]:checked')].map(el => el.value);
    if (!mesaj) { toast('Mesaj boş olamaz!', 'hata'); return; }
    if (seciliOdalar.length === 0) { toast('En az bir oda seç!', 'hata'); return; }
    socket.emit('sari-bot-ayarla', { mesaj, sureDk: sure, odaListesi: seciliOdalar });
}

function sariBotDurdur() {
    socket.emit('sari-bot-durdur');
}

// ==================== BOOM CHAT — SAAT DÜZELTMESİ (script.js'e entegre edilecek) ====================
// 
// script.js dosyanızda aşağıdaki değişiklikleri yapın:
//
// 1) "zamanFarki" fonksiyonu aynı kalabilir (Unix timestamp farkı — doğru çalışıyor)
//
// 2) Mesaj gönderiminde "zaman" alanını sunucu tarafında üretiyoruz (server.js'deki zamanStr)
//    Bu sayede Türkiye saati otomatik uygulanıyor.
//
// 3) Script.js'deki mesaj gönderi kısmında client-side zaman üretimi varsa kaldırın.
//    Zaman artık server.js'den geliyor — Türkiye saatiyle (UTC+3).
//
// 4) @mavibot mention desteği: Kullanıcılar oda/grup chat'te "@mavibot [soru]" yazabilir.
//    Bu özellik server.js'de aktif — script.js'de ekstra değişiklik gerekmez.
//
// ====================================================================================
// 
// KURULUM NOTU — ANTHROPIC_API_KEY:
// 
// Claude AI ile gerçek yapay zeka için:
// 1. https://console.anthropic.com adresine gidin
// 2. API key alın (ücretsiz $5 kredi veriliyor)
// 3. Sunucunuzda:
//    Linux/Mac: export ANTHROPIC_API_KEY="sk-ant-xxxxx"
//    Windows:   set ANTHROPIC_API_KEY=sk-ant-xxxxx
//    .env dosyası: ANTHROPIC_API_KEY=sk-ant-xxxxx
// 
// API key olmadan da çalışır — gelişmiş kural tabanlı yedek sistem devreye girer.
// 
// ====================================================================================

// Bu dosyayı script.js'inizin mevcut zamanFarki fonksiyonuyla değiştirin:
// (Zaten doğru çalışıyor, sunucu saati Türkiye saatiyle gönderilecek)

// Aşağıdaki fonksiyonu script.js'inizin "botlariListeyeEkle" fonksiyonuyla değiştirin:
function botlariListeyeEkle() {
    const botlar = [
        { id: -1, ad: 'mavibot', avatarUrl: null, rol: 'bot' },
        { id: -2, ad: 'saribot', avatarUrl: null, rol: 'bot' },
        { id: -3, ad: 'kirmizibot', avatarUrl: null, rol: 'bot' },
        { id: -4, ad: 'yesilbot', avatarUrl: null, rol: 'bot' }
    ];

    botlar.forEach(bot => {
        if (!document.querySelector(`[data-dm-id="${bot.id}"]`)) {
            dmListesineEkle(bot);
        }
    });
}

// Mesaj input'una @mavibot otomatik tamamlama ipucu ekle (opsiyonel):
// input.placeholder yerine hint göstermek istiyorsanız aşağıdaki kodu kullanabilirsiniz:
function maviботHintEkle() {
    const input = document.getElementById('mesajInput');
    if (!input) return;

    input.addEventListener('input', function () {
        const val = this.value;
        if (val === '@m' || val === '@ma' || val === '@mav') {
            // Küçük bir hint tooltip göster
            const hint = document.getElementById('mavibot-hint') || (() => {
                const h = document.createElement('div');
                h.id = 'mavibot-hint';
                h.style.cssText = `
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    background: var(--bg-panel);
                    border: 1px solid var(--mavi-brd);
                    border-radius: var(--r-md);
                    padding: 8px 12px;
                    font-size: 12px;
                    color: var(--mavi2);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    z-index: 100;
                    cursor: pointer;
                    white-space: nowrap;
                `;
                h.innerHTML = '🔵 <strong>@mavibot</strong> — AI asistan';
                h.onclick = () => { input.value = '@mavibot '; input.focus(); h.remove(); };
                input.parentElement.style.position = 'relative';
                input.parentElement.appendChild(h);
                return h;
            })();
        } else {
            document.getElementById('mavibot-hint')?.remove();
        }
    });

    // Input odak kaybedince hint kaldır
    input.addEventListener('blur', () => {
        setTimeout(() => document.getElementById('mavibot-hint')?.remove(), 200);
    });
}

// Sayfa yüklenince çalıştır
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(botlariListeyeEkle, 3000);
    // Uncomment aşağıdaki satırı @mavibot hint için:
    // maviботHintEkle();
});
// Sayfa yüklendikten sonra çalıştır
setTimeout(botlariListeyeEkle, 3000);
