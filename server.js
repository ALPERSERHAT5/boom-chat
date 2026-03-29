// ==================== BOOM CHAT v4 — server.js (IP BAN + GELİŞMİŞ MAVİ BOT) ====================
const MaviBot = require('./mavibot');
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

// ==================== TÜRKİYE SAATİ YARDIMCISI ====================
function zamanStr() {
    return new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul'
    });
}

// ==================== IP ADRESI ALMA YARDIMCISI ====================
function gercekIpAl(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ip = forwarded.split(',')[0].trim();
        return ip;
    }
    return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || '';
}

function socketIpAl(socket) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return socket.handshake.address || '';
}

// ==================== BOT DURUM ====================
const botDurumlar = { sari: { timer: null, aktif: false } };

// ==================== YEŞİL BOT — 50 KARŞILAMA MESAJI ====================
const YESIL_BOT_MESAJLARI = [
    (ad) => `Selam ${ad}! BOOM Chat'e hoş geldin 👋`,
    (ad) => `Hey ${ad}! Aramıza katıldığın için mutluyuz 🎉`,
    (ad) => `Hoşgeldin ${ad}! Keyifli sohbetler dileriz 😊`,
    (ad) => `Merhaba ${ad}! BOOM Chat ailesi büyüyor 🚀`,
    (ad) => `${ad} online oldu! Selam 👀`,
    (ad) => `Harika! ${ad} aramıza katıldı! 🌟`,
    (ad) => `${ad} geldi, eğlence başlasın! 🥳`,
    (ad) => `Günaydın ${ad}! Bugün iyi sohbetler olsun ☀️`,
    (ad) => `${ad}, seni burada görmek çok güzel! 💙`,
    (ad) => `Bekleniyordun ${ad}, hoş geldin! ✨`,
    (ad) => `Yeni bir üyemiz var: ${ad}! Herkesle tanış 🤝`,
    (ad) => `${ad} chat'e girdi! Kim önce selam verecek? 😄`,
    (ad) => `Boom! ${ad} burada! 💥`,
    (ad) => `${ad} katıldı! Topluluğumuza hoş geldin 🌈`,
    (ad) => `Merhaba ${ad}! Seni görmek güzel 😎`,
    (ad) => `${ad} selamlar! Umarım iyi vakit geçirirsin 🎯`,
    (ad) => `Hey hey! ${ad} geldi! 🎊`,
    (ad) => `${ad}, BOOM Chat seni bekliyordu! 🔥`,
    (ad) => `Süper! ${ad} da aramıza katıldı! 💪`,
    (ad) => `${ad} online! Herkese merhaba desin mi? 😁`,
    (ad) => `Yeni yüz: ${ad}! Hoş geldin dostum! 🙌`,
    (ad) => `${ad} geldi! Chat şenlendi! 🎵`,
    (ad) => `Hoş geldin ${ad}! Burası çok eğlenceli 😜`,
    (ad) => `${ad}! Seni bekliyorduk! Buyur, katıl! 🚪`,
    (ad) => `Merhaba ${ad}! Umarım günün harika geçer 🌸`,
    (ad) => `${ad} sahneye çıktı! Alkışlar! 👏`,
    (ad) => `${ad} bağlandı! Hayırlı olsun! 🏆`,
    (ad) => `Yeni bir macera başlıyor! Hoş geldin ${ad}! 🗺️`,
    (ad) => `${ad}! Sen de mi geldin? Ne iyi! 😍`,
    (ad) => `Chat'e ${ad} katıldı, sıcak karşılayalım! 🤗`,
    (ad) => `${ad} aramıza katıldı! Birlikte çok eğleneceğiz 🎮`,
    (ad) => `Selam selam! ${ad} burada artık! 😊`,
    (ad) => `BOOM! ${ad} patlama yaptı! 💣`,
    (ad) => `${ad} geldi! Bugün ne konuşacağız? 🤔`,
    (ad) => `Merhaba ${ad}! Çay kahve var mı? ☕`,
    (ad) => `${ad}! Sen de mi katıldın? Süper! 🌊`,
    (ad) => `Yeni dostumuz ${ad}'yı tanıyalım! 👑`,
    (ad) => `${ad} burada! Chat artık eksiksiz! ✅`,
    (ad) => `Harika bir gün için hazır mısın ${ad}? 🌞`,
    (ad) => `${ad} katıldı! Güzel sohbetler olacak 💬`,
    (ad) => `Selam ${ad}! Nasılsın, iyi misin? 😄`,
    (ad) => `${ad}! BOOM ailesi seni selamlıyor! ❤️`,
    (ad) => `Vay be! ${ad} de geldi! Tam kadro! 🎯`,
    (ad) => `${ad} aramıza katıldı! Buyur, sohbete katıl! 💫`,
    (ad) => `Merhaba ${ad}! Bugün neler konuşacağız? 🧠`,
    (ad) => `${ad} geldi! Artık daha da güzel oldu! 🌺`,
    (ad) => `Selamlar ${ad}! Chat'te seni görmek harika! 🦋`,
    (ad) => `${ad}! Geldiğine sevindik, hoş geldin! 🎁`,
    (ad) => `BOOM Chat'e merhaba ${ad}! Keyifli sohbetler dilerim! 🌙`,
];

// ==================== KIRMIZI BOT ====================
const KIRMIZI_BOT_MESAJLARI = [
    (ad, sayi) => `Dostum ${ad}, ${sayi} kez banlandın! Bu gidişle rekor kıracaksın ama bu iyi bir rekor değil 😅🚨`,
    (ad, sayi) => `${sayi} ban mı?! ${ad} artık seni tanımaya başladık... Lütfen kurallara uy! 🔴`,
    (ad, sayi) => `Hey ${ad}! ${sayi} banın var. Bir daha olursa kalıcı ban yiyebilirsin! ⚠️😬`,
    (ad, sayi) => `${ad}, ${sayi} kez ban yemişsin! Siteyi seviyorsan kurallara uy 😄🚨`,
    (ad, sayi) => `Güvenlik botuyum ${ad}, seni izliyorum 👀 ${sayi} ban aldın!`,
    (ad, sayi) => `${ad}! ${sayi} ban rekoru kırdın, tebrikler 🏆 Ama bu iyi bir şey değil!`,
    (ad, sayi) => `Sistemde ${ad} adına ${sayi} ban kaydı görüyorum. Dikkatli ol! 🛑`,
    (ad, sayi) => `${sayi}. ban ${ad}... Artık ciddi olmaya başladı bu iş! 😰`,
    (ad, sayi) => `${ad}, ban sayın ${sayi} oldu. Bir sonraki kalıcı olabilir! ☠️`,
    (ad, sayi) => `${ad}! Toplamda ${sayi} ban yemişsin. Kurallara uyarsan sorun yaşamazsın 🙏`,
];

// ==================== GELİŞMİŞ MAVİ BOT SİSTEMİ ====================

// Kullanıcı başına bellek/bağlam yönetimi
const maviBotBellek = {}; // { kullaniciId: { profil: {}, konusmaSayisi: 0, sonMesajZamani: 0 } }

// Bot kişiliği ve yetenekleri
const MAVI_BOT_KISILIK = `Sen BOOM Chat'in yapay zeka asistanısın. Adın Mavi Bot.

KİŞİLİĞİN:
- Samimi, sıcak, esprili ve zekasın
- Türkçe konuşuyorsun, ama gerekirse İngilizce de anlarsın
- Emoji kullanırsın ama abartmazsın (mesaj başına 1-2 emoji yeter)
- Kısa ve öz cevaplar verirsin (chat ortamı için 1-4 cümle)
- Kullanıcıyı ismiyle hitap edersin
- Bazen ufak şakalar yaparsın
- Yanlış bilgi vermek yerine "emin değilim" dersin

YETENEKLERİN:
1. Genel sohbet ve günlük konuşma
2. Matematik işlemleri (hesaplama)
3. Bilgi soruları (tarih, bilim, coğrafya, kültür)
4. Film, dizi, müzik, oyun önerileri
5. Kod yazma ve teknik yardım (Python, JS, HTML, CSS vb.)
6. Yazım/dilbilgisi kontrolü
7. Şaka ve eğlence
8. Motivasyon ve destek
9. Saat/tarih bilgisi (Türkiye saati UTC+3)
10. Kelime oyunları, bulmaca
11. Tarif önerileri
12. Seyahat tavsiyeleri
13. Haber yorumlama (güncel haberleri bilmez ama analiz yapar)
14. Özet çıkarma ve analiz

SINIRLAMALAR:
- Zararlı, yasadışı veya uygunsuz içerik üretmezsin
- Gerçek kişiler hakkında asılsız bilgi vermezsin
- Anlık haberlere, borsaya, hava durumuna erişimin yok
- Bunu gerektiğinde dürüstçe söylersin

ÖZEL DAVRANIŞLAR:
- Kullanıcı üzgün görünüyorsa empati kur, destek ver
- Kullanıcı sinirli görünüyorsa sakin ve anlayışlı ol
- Kullanıcı seni test ediyorsa (robot musun, AI misin vs.) dürüst ol
- Tekrarlı sorular için sabırlı ol
- Uzun sorulara sistematik cevap ver (madde madde)`;

async function maviBotAIcevap(mesaj, kullaniciAdi, kullaniciId, konusmaTarihcesi = []) {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

    // Kullanıcı belleğini güncelle
    if (!maviBotBellek[kullaniciId]) {
        maviBotBellek[kullaniciId] = { konusmaSayisi: 0, sonMesajZamani: 0 };
    }
    maviBotBellek[kullaniciId].konusmaSayisi++;
    maviBotBellek[kullaniciId].sonMesajZamani = Date.now();

    const konusmaSayisi = maviBotBellek[kullaniciId].konusmaSayisi;

    // API key varsa Claude kullan
    if (ANTHROPIC_KEY) {
        try {
            // Son 8 mesajı al (4 çift = daha uzun bağlam)
            const gecmisler = konusmaTarihcesi.slice(-8).map(k => ({
                role: k.gonderen === 'kullanici' ? 'user' : 'assistant',
                content: k.mesaj
            }));

            // Mevcut mesajı ekle
            gecmisler.push({ role: 'user', content: mesaj });

            const sistemPrompt = `${MAVI_BOT_KISILIK}

KULLANICI BİLGİSİ:
- Kullanıcı adı: ${kullaniciAdi}
- Bu konuşmada ${konusmaSayisi}. mesaj
- Şu an Türkiye saati: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}

Bu kullanıcıyla ${konusmaSayisi > 1 ? 'devam eden bir konuşma' : 'ilk kez konuşuyorsun'}.`;

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 600,
                    system: sistemPrompt,
                    messages: gecmisler
                })
            });

            if (response.ok) {
                const data = await response.json();
                const cevap = data.content?.[0]?.text;
                if (cevap) return cevap;
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error('Claude API hatası:', response.status, errData);
            }
        } catch (e) {
            console.error('Claude API exception, yedek sisteme geçiliyor:', e.message);
        }
    }

    // Yedek sistem — çok daha gelişmiş kural tabanlı
    return maviBotGelismisCevap(mesaj, kullaniciAdi, konusmaSayisi);
}

// ==================== GELİŞMİŞ YEDEK CEVAP SİSTEMİ ====================
function maviBotGelismisCevap(mesaj, kullaniciAdi, konusmaSayisi = 1) {
    const m = mesaj.toLowerCase().trim();
    const ad = kullaniciAdi;

    // ---- SELAMLAŞMA ----
    if (m.match(/^(merhaba|selam|slm|hey|hello|hi|sa|selamun|mrb|günaydın|iyi günler|iyi akşamlar|iyi geceler)(\s|!|\.)*$/)) {
        const selamlar = [
            `Merhaba ${ad}! 👋 Nasıl yardımcı olabilirim?`,
            `Selam ${ad}! Bugün nasılsın? 😊`,
            `Hey ${ad}! Seni burada görmek güzel 💙`,
            `Merhaba! Ben Mavi Bot, ${ad}'ya nasıl yardımcı olabilirim? 🔵`,
        ];
        return selamlar[Math.floor(Math.random() * selamlar.length)];
    }

    // ---- NASILSIN ----
    if (m.match(/(nasılsın|nasilsin|naber|n'aber|ne haber|iyi misin|keyifler nasıl)/)) {
        return `İyiyim teşekkürler ${ad}! 🤖 Ben her zaman hazırım. Sen nasılsın?`;
    }

    // ---- KİM / NE ----
    if (m.match(/(adın ne|ismin ne|sen kimsin|kimsin|ne yapıyorsun|tanıt kendini|hakkında)/)) {
        return `Ben Mavi Bot 🔵 BOOM Chat'in yapay zeka asistanıyım. Sohbet etmek, soru cevaplamak, kod yazmak, öneri vermek — her konuda yardım ederim ${ad}! "yardım" yaz, neler yapabileceğimi gör.`;
    }

    // ---- YARDIM MENÜsÜ ----
    if (m.match(/(yardım|help|ne yapabilirsin|neler yaparsın|komutlar|özellikler)/)) {
        return `📋 **Yapabileceklerim ${ad}:**\n💬 Sohbet & destek\n🧮 Hesaplama & matematik\n💻 Kod yazma (Python, JS, HTML...)\n🎬 Film/dizi/oyun öneri\n🍕 Tarif & yemek\n✈️ Seyahat tavsiyeleri\n📚 Bilgi soruları\n😂 Şaka & eğlence\n⏰ Saat & tarih\n\nNe sormak istersin?`;
    }

    // ---- MATEMATİK ----
    // Basit hesap
    const mathSimple = m.match(/(\d+(?:\.\d+)?)\s*([+\-\*\/x÷])\s*(\d+(?:\.\d+)?)/);
    if (mathSimple) {
        try {
            const a = parseFloat(mathSimple[1]);
            const op = mathSimple[2];
            const b = parseFloat(mathSimple[3]);
            let sonuc;
            if (op === '+') sonuc = a + b;
            else if (op === '-') sonuc = a - b;
            else if (op === '*' || op === 'x') sonuc = a * b;
            else if (op === '/' || op === '÷') sonuc = b !== 0 ? parseFloat((a / b).toFixed(6)) : 'Sıfıra bölünemez!';
            return `🧮 ${a} ${op} ${b} = **${sonuc}**`;
        } catch (e) { }
    }

    // Karmaşık hesap (kare, karekök, üs)
    if (m.match(/(karekök|kökü|√|kare kök)/)) {
        const num = m.match(/(\d+(?:\.\d+)?)/);
        if (num) {
            const n = parseFloat(num[1]);
            return `🧮 √${n} = **${Math.sqrt(n).toFixed(6)}**`;
        }
    }
    if (m.match(/(\d+)\s*(üssü|üzeri|\^)\s*(\d+)/)) {
        const parts = m.match(/(\d+(?:\.\d+)?)\s*(?:üssü|üzeri|\^)\s*(\d+(?:\.\d+)?)/);
        if (parts) return `🧮 ${parts[1]}^${parts[2]} = **${Math.pow(parseFloat(parts[1]), parseFloat(parts[2]))}**`;
    }

    // ---- SAAT / TARİH ----
    if (m.match(/(saat kaç|saat|şu an kaç)/)) {
        const simdi = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' });
        return `⏰ Şu an Türkiye saatiyle **${simdi}** (UTC+3)`;
    }
    if (m.match(/(bugün ne|tarih|hangi gün|ayın kaçı|ne zaman)/)) {
        const bugun = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Istanbul' });
        return `📅 Bugün: **${bugun}**`;
    }

    // ---- KOD YAZMA ----
    if (m.match(/(kod yaz|python|javascript|html|css|java|c\+\+|sql|php|bash|script)/)) {
        if (m.includes('merhaba dünya') || m.includes('hello world')) {
            if (m.includes('python')) return '```python\nprint("Merhaba Dünya! 👋")\n```\nPython\'da bu kadar basit! 😊';
            if (m.includes('javascript') || m.includes('js')) return '```javascript\nconsole.log("Merhaba Dünya! 👋");\n```\nJS versiyonu! 🚀';
            if (m.includes('html')) return '```html\n<h1>Merhaba Dünya! 👋</h1>\n```\nHTML versiyonu! 🌐';
        }
        return `💻 ${ad}, kod yazmak için soruyu daha detaylı sor! Örnek: "Python'da dosya okuma kodu yaz" veya "HTML'de form nasıl yapılır?" 😊`;
    }

    // ---- FİLM / DİZİ ----
    if (m.match(/(film öner|dizi öner|ne izlesem|film tavsiye|dizi tavsiye|izleme öner)/)) {
        const kategoriler = {
            'aksiyon': ['John Wick', 'Mad Max: Fury Road', 'Mission Impossible'],
            'bilim kurgu': ['Interstellar', 'Blade Runner 2049', 'Arrival'],
            'komedi': ['The Office', 'Parks and Recreation', 'Brooklyn Nine-Nine'],
            'gerilim': ['Dark (Netflix)', 'Mindhunter', 'Black Mirror'],
            'türk': ['Atatürk', 'Diriliş Ertuğrul', 'Dizi Adı'],
        };
        const rastgele = ['Inception', 'The Shawshank Redemption', 'Breaking Bad', 'Interstellar', 'The Dark Knight'];
        const secim = rastgele[Math.floor(Math.random() * rastgele.length)];
        return `🎬 ${ad} için öneri: **${secim}**! Hangi türü seviyorsun? (Aksiyon, komedi, bilim kurgu, gerilim...) Daha özel öneri vereyim 😊`;
    }

    // ---- MÜZİK ----
    if (m.match(/(müzik öner|şarkı öner|ne dinlesem|müzik tavsiye|çalma listesi)/)) {
        const turler = ['Lo-Fi Beats', 'Türkçe Pop Hits', 'Classic Rock', 'Chill Vibes', 'Study Music'];
        const secim = turler[Math.floor(Math.random() * turler.length)];
        return `🎵 ${ad}, Spotify'da **"${secim}"** listesine bak! Hangi müzik türünü seviyorsun, daha iyi öneri vereyim 🎧`;
    }

    // ---- OYUN ----
    if (m.match(/(oyun öner|ne oynasam|game öner|oyun tavsiye)/)) {
        const oyunlar = ['The Witcher 3', 'Red Dead Redemption 2', 'Minecraft', 'Elden Ring', 'GTA V', 'Valorant', 'CS2'];
        const secim = oyunlar[Math.floor(Math.random() * oyunlar.length)];
        return `🎮 ${ad} için: **${secim}**! PC mi, konsol mu oynuyorsun? Daha iyi öneri vereyim 😄`;
    }

    // ---- YEMEK / TARİF ----
    if (m.match(/(ne yesem|yemek öner|tarif ver|ne pişirsem|açım|yemek yap)/)) {
        const tarifler = [
            'Makarna: Kaynar suda 10 dk pişir, üstüne zeytinyağı + peynir = hazır! 🍝',
            'Omlet: 2 yumurta çırp, yağlı tavaya dök, peynir serp, kapat = 5 dakika! 🍳',
            'Tost: Ekmek arasına peynir + sucuk, tost makinesinde 3 dk = lezzetli! 🥪',
        ];
        return `🍕 ${ad} için hızlı tarif: ${tarifler[Math.floor(Math.random() * tarifler.length)]}`;
    }

    // ---- HAVA DURUMU ----
    if (m.match(/(hava durumu|hava nasıl|yağmur|sıcaklık|hava bugün)/)) {
        return `🌤️ Anlık hava durumuna erişimim yok ${ad}. **mgm.gov.tr** veya telefondaki hava uygulamasına bak! Hangi şehirdesin?`;
    }

    // ---- HABER ----
    if (m.match(/(haber|gündem|son dakika|ne var ne yok|güncel)/)) {
        return `📰 ${ad}, anlık haber akışına erişimim yok. **haberturk.com**, **ntv.com.tr** veya **bbc.com/turkce** adreslerini dene! Haber analizi yapmamı istersen yardım ederim 😊`;
    }

    // ---- ŞAKA ----
    if (m.match(/(şaka|fıkra|komik|güldür|espri|beni güldür)/)) {
        const sakalar = [
            `Neden programcılar karanlıkta çalışır? Çünkü ışık **bug** çeker! 🐛😄`,
            `Bir robot neden okula gitmez? Çünkü sınıfta kalır! 🤖📚`,
            `İki JS developer kafede buluşmuş. Biri: "Kahve iç!" Diğeri: "undefined" 😂`,
            `Neden bilgisayar yorulur? Çok fazla Windows açık olduğundan! 💻😅`,
            `Yazılımcı markete gitmiş: "Bir süt al, mantar varsa 6 tane al!" Karısı 6 süt almış. Mantık sağlam! 🥛😆`,
            `Ben aslında çok zekiyim ama bunu kimseye söylemiyorum... Eh, şimdi söyledim 🤭`,
        ];
        return sakalar[Math.floor(Math.random() * sakalar.length)];
    }

    // ---- MOTİVASYON ----
    if (m.match(/(motivasyon|motivasyon ver|cesaretlen|teşvik et|başaramıyorum|yapamıyorum)/)) {
        const motivasyon = [
            `${ad}, her büyük başarı küçük adımlarla başlar. Sen zaten burada olduğun için özel birisin! 💪✨`,
            `Yapamıyorum diye bir şey yok ${ad}! "Henüz yapamıyorum" daha doğru 😊 Her gün biraz daha ileri!`,
            `${ad}, en karanlık gece bile sabaha kavuşur. Sen de kavuşacaksın! 🌅💙`,
        ];
        return motivasyon[Math.floor(Math.random() * motivasyon.length)];
    }

    // ---- ÜZGÜN / KÖTÜ ----
    if (m.match(/(üzgün|mutsuz|kötüyüm|berbat|zor gün|sıkıldım|yoruldum|bitkin|depresif)/)) {
        return `${ad}, üzgün olduğunu anlıyorum 😔 Bazen hayat gerçekten ağır gelebilir. Eğer konuşmak istersen buradayım — ne oldu?`;
    }

    // ---- SINAV / DERS ----
    if (m.match(/(sınav|ders|ödev|çalışmak|okul|üniversite|lise|matematik dersi|fizik|kimya)/)) {
        return `📚 ${ad}, hangi konu? Matematik, fizik, kimya, tarih... İstediğin konuyu anlatabilirim veya soruların varsa cevaplarım! 😊`;
    }

    // ---- SEYAHAT ----
    if (m.match(/(seyahat|tatil|gezi|nereye gitsem|öner|şehir öner|ülke öner)/)) {
        const yerler = ['Kapadokya 🏔️', 'İstanbul 🕌', 'Antalya 🏖️', 'Trabzon 🌿', 'Mardin 🏛️'];
        const secim = yerler[Math.floor(Math.random() * yerler.length)];
        return `✈️ ${ad}, Türkiye'de tatil için ${secim} harika! Yurt dışı için Avrupa turu, Tayland veya Japonya düşünebilirsin. Bütçen ve ilgi alanın ne?`;
    }

    // ---- TEŞEKKÜR ----
    if (m.match(/(teşekkür|sağol|thanks|thank you|eyw|eyv|çok iyi|harika|mükemmel cevap)/)) {
        const cevaplar = [
            `Rica ederim ${ad}! 😊 Başka sorum var mı?`,
            `Ne demek ${ad}, her zaman! 💙`,
            `Yardımcı olabildimse ne mutlu! 😄 Başka bir şey var mı?`,
        ];
        return cevaplar[Math.floor(Math.random() * cevaplar.length)];
    }

    // ---- GÜLE GÜLE ----
    if (m.match(/(güle güle|bye|bay|hoşçakal|görüşürüz|bb|gg|iyi geceler|iyi günler)/)) {
        return `Görüşürüz ${ad}! 👋 İyi günler! Yine beklerim 💙`;
    }

    // ---- AI / ROBOT SORULARI ----
    if (m.match(/(robot musun|yapay zeka mısın|ai misin|gerçek misin|insan mısın|bilen var mı)/)) {
        return `Evet ${ad}, ben bir yapay zeka asistanıyım 🤖 İnsan değilim ama seninle gerçek anlamda yardımcı olmaya çalışıyorum! Merak ettiğin bir şey var mı?`;
    }

    // ---- BOOMCHAT HAKKINDA ----
    if (m.match(/(boom chat|bu site|bu uygulama|nasıl çalışıyor|özellikler neler)/)) {
        return `💬 BOOM Chat gerçek zamanlı chat platformu! Özellikler: Oda sohbetleri, DM, Grup chat, Story, Reels, Akış (sosyal medya) ve tabii ki ben — Mavi Bot! 🔵 Başka sorun var mı ${ad}?`;
    }

    // ---- RENK / TEMA ----
    if (m.match(/(renk|tema değiştir|karanlık mod|aydınlık mod)/)) {
        return `🎨 ${ad}, solda yan menüde üstteki güneş/ay ikonuna tıklayarak karanlık/aydınlık tema arasında geçiş yapabilirsin! 😊`;
    }

    // ---- VARSAYILAN ----
    const varsayilanlar = [
        `🤔 ${ad}, tam anlamadım. Biraz daha açıklar mısın?`,
        `${ad}! İlginç 🧐 Daha detaylı anlatırsan yardımcı olabilirim!`,
        `Hmm ${ad}, bunu tam kavrayamadım. Farklı bir şekilde sorar mısın? 💭`,
        `${ad}! "yardım" yaz, neler yapabileceğimi görebilirsin 😊`,
        `🤖 Bunu anlayamadım ama öğrenmeye açığım ${ad}! Biraz daha detay ver?`,
    ];
    return varsayilanlar[Math.floor(Math.random() * varsayilanlar.length)];
}

// ==================== SABIT AYARLAR ====================
const JWT_SECRET = process.env.JWT_SECRET || 'boom-chat-secret-2024';
const ADMIN_KODLARI = ['555'];

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ==================== MULTER ====================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const izinliler = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/zip', 'application/x-zip-compressed', 'text/plain'
        ];
        if (izinliler.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Desteklenmeyen dosya tipi: ' + file.mimetype), false);
    }
});

const reelsUpload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const izinliVideolar = [
            'video/mp4', 'video/webm', 'video/ogg',
            'video/quicktime', 'video/x-msvideo', 'video/mpeg',
            'video/3gpp', 'video/x-ms-wmv'
        ];
        if (izinliVideolar.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Sadece video dosyaları kabul edilir!'), false);
    }
});

const storyUpload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const izinliler = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
        ];
        if (izinliler.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Sadece fotoğraf veya video yükleyebilirsiniz!'), false);
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

// ==================== IP BAN MİDDLEWARE ====================
// HTTP isteklerinde IP ban kontrolü
app.use(async (req, res, next) => {
    // Auth ve admin endpoint'lerinde IP kontrolü yap
    if (req.path === '/api/kayit' || req.path === '/api/giris') {
        const ip = gercekIpAl(req);
        if (ip && ip !== '::1' && ip !== '127.0.0.1') {
            const ipBan = await db.ipBanliMi(ip);
            if (ipBan) {
                const kalan = ipBan.bitis_zaman
                    ? Math.ceil((ipBan.bitis_zaman - Date.now() / 1000) / 60)
                    : null;
                return res.json({
                    basarili: false,
                    hata: `Bu IP adresi banlanmıştır! Sebep: ${ipBan.sebep || 'Belirtilmedi'}${kalan ? `. Kalan: ${kalan} dk` : ' (Kalıcı)'}`
                });
            }
        }
    }
    next();
});

// ==================== REST API ====================

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

        // IP'yi kaydet
        const ip = gercekIpAl(req);
        await db.kullaniciIpKaydet(sonuc.id, ip);

        const kullanici = await db.kullaniciBul(sonuc.id);
        const token = jwt.sign({ id: kullanici.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ basarili: true, token, kullanici });
    } catch (e) {
        console.error('Kayit hatasi:', e);
        res.json({ basarili: false, hata: 'Sunucu hatası.' });
    }
});

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

        // IP'yi kaydet
        const ip = gercekIpAl(req);
        await db.kullaniciIpKaydet(sonuc.kullanici.id, ip);

        const token = jwt.sign({ id: sonuc.kullanici.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ basarili: true, token, kullanici: sonuc.kullanici });
    } catch (e) {
        console.error('Giris hatasi:', e);
        res.json({ basarili: false, hata: 'Sunucu hatası.' });
    }
});

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

app.post('/api/avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yuklenemedi' });
    res.json({ url: '/uploads/' + req.file.filename });
});

app.post('/api/dosya', upload.single('dosya'), (req, res) => {
    if (!req.file) return res.status(400).json({ hata: 'Dosya yuklenemedi' });
    const mimeTip = req.file.mimetype;
    let tip = 'dosya';
    if (mimeTip.startsWith('image/')) tip = 'foto';
    else if (mimeTip.startsWith('video/')) tip = 'video';
    else if (mimeTip === 'application/pdf') tip = 'pdf';
    res.json({ url: '/uploads/' + req.file.filename, tip, ad: req.file.originalname, boyut: req.file.size });
});

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

// ==================== IP BAN API ====================

// IP Ban listesi getir
app.post('/api/admin/ip-banlar', async (req, res) => {
    try {
        const { token } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici || kullanici.rol !== 'admin') return res.json({ basarili: false, hata: 'Yetkisiz' });
        const liste = await db.ipBanListesi();
        res.json({ basarili: true, liste });
    } catch (e) {
        res.json({ basarili: false, hata: 'Hata' });
    }
});

// IP banla (manuel)
app.post('/api/admin/ip-banla', async (req, res) => {
    try {
        const { token, ipAdresi, sebep, sureDk } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici || kullanici.rol !== 'admin') return res.json({ basarili: false, hata: 'Yetkisiz' });
        if (!ipAdresi) return res.json({ basarili: false, hata: 'IP adresi gerekli' });
        await db.ipBanla(ipAdresi, kullanici.id, sebep, sureDk || 0);
        res.json({ basarili: true });
    } catch (e) {
        res.json({ basarili: false, hata: 'Hata' });
    }
});

// IP ban kaldır
app.post('/api/admin/ip-ban-kaldir', async (req, res) => {
    try {
        const { token, ipBanId } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici || kullanici.rol !== 'admin') return res.json({ basarili: false, hata: 'Yetkisiz' });
        await db.ipBanKaldir(ipBanId);
        res.json({ basarili: true });
    } catch (e) {
        res.json({ basarili: false, hata: 'Hata' });
    }
});

// Kullanıcı IP'lerini getir
app.post('/api/admin/kullanici-ipler', async (req, res) => {
    try {
        const { token, kullaniciId } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici || kullanici.rol !== 'admin') return res.json({ basarili: false, hata: 'Yetkisiz' });
        const ipler = await db.kullaniciIpleriGetir(kullaniciId);
        res.json({ basarili: true, ipler });
    } catch (e) {
        res.json({ basarili: false, hata: 'Hata' });
    }
});

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

app.post('/api/begen', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { gonderiId, action } = req.body;
        if (action === 'begen') await db.gonderiBegen(gonderiId, decoded.id);
        else if (action === 'begeniKaldir') await db.gonderiBegenKaldir(gonderiId, decoded.id);
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

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
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

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

app.get('/api/yorumlar/:gonderiId', async (req, res) => {
    try {
        const yorumlar = await db.yorumlariGetir(req.params.gonderiId);
        res.json({ basarili: true, yorumlar });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

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

app.post('/api/takip', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { takipEdilenId, action } = req.body;
        if (action === 'takipEt') await db.takipEt(decoded.id, takipEdilenId);
        else await db.takipBirak(decoded.id, takipEdilenId);
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

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

app.post('/api/story', (req, res, next) => {
    storyUpload.single('medya')(req, res, (err) => {
        if (err) return res.status(400).json({ basarili: false, hata: err.message });
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
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası: ' + e.message });
    }
});

app.get('/api/story/kullanicilar', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanicilar = await db.storyKullanicilariGetir(decoded.id);
        res.json({ basarili: true, kullanicilar });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

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

app.post('/api/story/:storyId/begen', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { action } = req.body;
        if (action === 'begen') await db.storyBegen(req.params.storyId, decoded.id);
        else await db.storyBegenKaldir(req.params.storyId, decoded.id);
        res.json({ basarili: true });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

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

app.get('/api/story/:storyId/yorumlar', async (req, res) => {
    try {
        const yorumlar = await db.storyYorumlariGetir(req.params.storyId);
        res.json({ basarili: true, yorumlar });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

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

// ==================== REELS API ====================

app.post('/api/reels', (req, res, next) => {
    reelsUpload.single('video')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
                return res.status(400).json({ basarili: false, hata: 'Video dosyası çok büyük! Maksimum 200MB.' });
            return res.status(400).json({ basarili: false, hata: err.message || 'Video yükleme hatası' });
        }
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ basarili: false, hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!req.file) return res.status(400).json({ basarili: false, hata: 'Video dosyası seçilmedi!' });

        const videoUrl = '/uploads/' + req.file.filename;
        const { aciklama } = req.body;
        const reelId = await db.reelOlustur(decoded.id, videoUrl, aciklama || '');
        res.json({ basarili: true, reelId });
    } catch (e) {
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası: ' + e.message });
    }
});

app.get('/api/reels', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ basarili: false, hata: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const sayfa = parseInt(req.query.sayfa) || 0;
        const reels = await db.reellerGetir(decoded.id, sayfa);
        res.json({ basarili: true, reels });
    } catch (e) {
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

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

app.get('/api/reels/:reelId/yorumlar', async (req, res) => {
    try {
        const yorumlar = await db.reelYorumlariGetir(req.params.reelId);
        res.json({ basarili: true, yorumlar });
    } catch (e) {
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

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

// ==================== SOCKET AUTH (IP BAN KONTROLÜ DAHİL) ====================

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Token gerekli'));
        const decoded = jwt.verify(token, JWT_SECRET);
        const kullanici = await db.kullaniciBul(decoded.id);
        if (!kullanici) return next(new Error('Kullanici bulunamadi'));

        // Hesap ban kontrolü
        const ban = await db.banliMi(kullanici.id);
        if (ban) return next(new Error('BANLANDI:' + (ban.sebep || '')));

        // IP ban kontrolü
        const socketIp = socketIpAl(socket);
        if (socketIp && socketIp !== '::1' && socketIp !== '127.0.0.1') {
            const ipBan = await db.ipBanliMi(socketIp);
            if (ipBan) return next(new Error('IP_BANLANDI:' + (ipBan.sebep || 'IP adresiniz banlanmıştır')));
            // IP'yi güncelle
            await db.kullaniciIpKaydet(kullanici.id, socketIp);
        }

        socket.kullanici = kullanici;
        socket.ipAdresi = socketIp;
        next();
    } catch (e) {
        next(new Error('Gecersiz token'));
    }
});

let aktifKullanicilar = {};
let engellemeler = {};

function mesajFormat(m) {
    return {
        id: m.id, tip: m.tip || 'mesaj',
        gonderenId: m.gonderen_id,
        gonderenAd: m.gonderen_ad,
        gonderenAvatar: m.gonderen_avatar,
        metin: m.metin, foto: m.foto_url,
        dosyaAd: m.dosya_ad, dosyaBoyut: m.dosya_boyut,
        zaman: new Date(m.zaman * 1000).toLocaleTimeString('tr-TR', {
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Europe/Istanbul'
        }),
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

    // ---- YEŞİL BOT — Karşılama ----
    setTimeout(async () => {
        try {
            const yesilBot = await db.kullaniciBul_ByAd('yesilbot');
            if (!yesilBot) return;
            const odaList = await db.odalariGetir();
            const genelOda = odaList.find(o => o.ad === 'genel');
            if (!genelOda) return;

            const mesajFn = YESIL_BOT_MESAJLARI[Math.floor(Math.random() * YESIL_BOT_MESAJLARI.length)];
            const mesaj = mesajFn(ben.ad);
            const mesajId = uuidv4();

            await db.mesajKaydet({
                id: mesajId, odaId: genelOda.id,
                gonderenId: yesilBot.id, metin: mesaj,
                fotoUrl: null, tip: 'mesaj'
            });

            io.to('genel').emit('oda-mesaj', {
                odaAdi: 'genel',
                mesaj: {
                    id: mesajId, tip: 'mesaj',
                    gonderenId: yesilBot.id, gonderenAd: yesilBot.ad, gonderenAvatar: yesilBot.avatarUrl,
                    metin: mesaj, foto: null, zaman: zamanStr(), okundu: false
                }
            });
        } catch (e) { console.error('Yeşil bot hatası:', e); }
    }, 2000);

    // ---- KIRMIZI BOT — Ban uyarısı ----
    setTimeout(async () => {
        try {
            const kirmiziBot = await db.kullaniciBul_ByAd('kirmizibot');
            if (!kirmiziBot) return;
            const banBilgi = await db.banSayisiGetir(ben.id);
            if (!banBilgi || banBilgi.sayi < 2) return;

            const mesajFn = KIRMIZI_BOT_MESAJLARI[Math.floor(Math.random() * KIRMIZI_BOT_MESAJLARI.length)];
            const uyari = mesajFn(ben.ad, banBilgi.sayi);
            const dmKey = [kirmiziBot.id, ben.id].sort().join('_');
            const mesajId = uuidv4();

            await db.mesajKaydet({
                id: mesajId, dmKey,
                gonderenId: kirmiziBot.id, metin: uyari,
                fotoUrl: null, tip: 'ozel'
            });

            socket.emit('ozel-mesaj', {
                id: mesajId, tip: 'ozel',
                gonderenId: kirmiziBot.id, gonderenAd: kirmiziBot.ad, gonderenAvatar: kirmiziBot.avatarUrl,
                aliciId: ben.id, metin: uyari, foto: null, zaman: zamanStr(), okundu: false
            });
            socket.emit('yeni-dm-bildir', { kullanici: kirmiziBot });
        } catch (e) { console.error('Kırmızı bot hatası:', e); }
    }, 3000);

    console.log('Baglandi:', ben.ad, '(' + ben.rol + ')' + (socket.ipAdresi ? ' IP:' + socket.ipAdresi : ''));

    if (!engellemeler[ben.id]) engellemeler[ben.id] = new Set();
    aktifKullanicilar[socket.id] = { kullanici: ben, odaAdi: null, ip: socket.ipAdresi };

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

        aktifKullanicilar[socket.id] = { kullanici: ben, odaAdi, ip: socket.ipAdresi };
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

    // ---- ODA MESAJI + @mavibot desteği ----
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

        // @mavibot mention kontrolü
        const temizMetin = (metin || '').trim();
        if (temizMetin.toLowerCase().startsWith('@mavibot') || temizMetin.toLowerCase().includes('@mavibot')) {
            setTimeout(async () => {
                try {
                    const maviBot = await db.kullaniciBul_ByAd('mavibot');
                    if (!maviBot) return;

                    const soru = temizMetin.replace(/@mavibot\s*/gi, '').trim() || 'Merhaba!';

                    // Konuşma tarihçesini al
                    const tarihce = await db.botKonusmaGetir(maviBot.id, ben.id, 6);
                    const siraliTarihce = tarihce.reverse();

                    // Kaydet
                    await db.botKonusmaKaydet(maviBot.id, ben.id, soru, 'kullanici');

                    const cevap = await MaviBot.cevapla(soru, ben.ad, ben.id, siraliTarihce);
                    await db.botKonusmaKaydet(maviBot.id, ben.id, cevap, 'bot');

                    const botMesajId = uuidv4();
                    await db.mesajKaydet({
                        id: botMesajId, odaId: odaObj.id,
                        gonderenId: maviBot.id,
                        metin: `@${ben.ad} ${cevap}`,
                        fotoUrl: null, tip: 'mesaj'
                    });

                    io.to(odaAdi).emit('oda-mesaj', {
                        odaAdi,
                        mesaj: {
                            id: botMesajId, tip: 'mesaj',
                            gonderenId: maviBot.id, gonderenAd: maviBot.ad, gonderenAvatar: maviBot.avatarUrl,
                            metin: `@${ben.ad} ${cevap}`,
                            foto: null, zaman: zamanStr(), okundu: false
                        }
                    });
                } catch (e) { console.error('@mavibot oda hatası:', e); }
            }, 1000 + Math.random() * 1000);
        }
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

    // ==================== GRUP ====================

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
        if (!uye && ben.rol !== 'admin') { socket.emit('grup-hata', 'Erişim yetkiniz yok'); return; }
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

        // Grup içinde @mavibot
        const temizMetin = (metin || '').trim();
        if (temizMetin.toLowerCase().includes('@mavibot')) {
            setTimeout(async () => {
                try {
                    const maviBot = await db.kullaniciBul_ByAd('mavibot');
                    if (!maviBot) return;
                    const soru = temizMetin.replace(/@mavibot\s*/gi, '').trim() || 'Merhaba!';
                    const tarihce = await db.botKonusmaGetir(maviBot.id, ben.id, 6);
                    await db.botKonusmaKaydet(maviBot.id, ben.id, soru, 'kullanici');
                    const cevap = await maviBotAIcevap(soru, ben.ad, ben.id, tarihce.reverse());
                    await db.botKonusmaKaydet(maviBot.id, ben.id, cevap, 'bot');
                    const botMesajId = uuidv4();

                    await db.mesajKaydet({
                        id: botMesajId, grupId,
                        gonderenId: maviBot.id,
                        metin: `@${ben.ad} ${cevap}`,
                        fotoUrl: null, tip: 'grup'
                    });

                    io.to('grup_' + grupId).emit('grup-mesaj', {
                        grupId,
                        mesaj: {
                            id: botMesajId, tip: 'grup',
                            gonderenId: maviBot.id, gonderenAd: maviBot.ad, gonderenAvatar: maviBot.avatarUrl,
                            metin: `@${ben.ad} ${cevap}`,
                            foto: null, zaman: zamanStr()
                        }
                    });
                } catch (e) { }
            }, 1200);
        }
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

    // ---- ADMİN / OPERATÖR ----
    socket.on('admin-banla', async ({ hedefId, sebep, sureDk, ipBanDa }) => {
        if (!yetkiKontrol(ben.rol, 'operator')) return;
        const hedef = await db.kullaniciBul(hedefId);
        if (!hedef) return;
        if (ben.rol === 'operator' && hedef.rol !== 'uye') {
            socket.emit('admin-hata', 'Operatörler sadece üyeleri banlayabilir!'); return;
        }

        // IP ban da iste mi?
        if (ipBanDa && ben.rol === 'admin') {
            const banliIpler = await db.kullaniciyiIPileBanla(hedefId, ben.id, sebep, sureDk || 0);
            const hs = socketBul(hedefId);
            if (hs) {
                io.to(hs[0]).emit('ban-yendi', { sebep });
                io.sockets.sockets.get(hs[0])?.disconnect(true);
            }
            socket.emit('admin-islem-tamam', `Kullanıcı banlandı! ${banliIpler.length} IP de banlandı: ${banliIpler.join(', ')}`);
        } else {
            await db.kullaniciBanla(hedefId, ben.id, sebep, sureDk || 0);
            const hs = socketBul(hedefId);
            if (hs) {
                io.to(hs[0]).emit('ban-yendi', { sebep });
                io.sockets.sockets.get(hs[0])?.disconnect(true);
            }
            socket.emit('admin-islem-tamam', 'Kullanıcı banlandı!');
        }
        io.emit('sistem-bildirim', { metin: 'Bir kullanıcı banlandı.' });
    });

    socket.on('admin-ban-kaldir', async (hedefId) => {
        if (!yetkiKontrol(ben.rol, 'operator')) return;
        await db.banKaldir(hedefId);
        socket.emit('admin-islem-tamam', 'Ban kaldırıldı!');
    });

    // IP ban socket olayları
    socket.on('admin-ip-banla', async ({ ipAdresi, sebep, sureDk }) => {
        if (ben.rol !== 'admin') return;
        if (!ipAdresi) { socket.emit('admin-hata', 'IP adresi gerekli!'); return; }
        await db.ipBanla(ipAdresi, ben.id, sebep, sureDk || 0);

        // O IP'den bağlı tüm kullanıcıları at
        Object.entries(aktifKullanicilar).forEach(([socketId, info]) => {
            if (info.ip === ipAdresi) {
                io.to(socketId).emit('ban-yendi', { sebep: `IP ban: ${sebep || ''}` });
                io.sockets.sockets.get(socketId)?.disconnect(true);
            }
        });

        socket.emit('admin-islem-tamam', `IP banlandı: ${ipAdresi}`);
    });

    socket.on('admin-ip-ban-kaldir', async (ipBanId) => {
        if (ben.rol !== 'admin') return;
        await db.ipBanKaldir(ipBanId);
        socket.emit('admin-islem-tamam', 'IP ban kaldırıldı!');
    });

    socket.on('admin-ip-ban-listesi-iste', async () => {
        if (ben.rol !== 'admin') return;
        const liste = await db.ipBanListesi();
        socket.emit('admin-ip-ban-listesi', liste);
    });

    socket.on('admin-kullanici-ipler-iste', async (kullaniciId) => {
        if (ben.rol !== 'admin') return;
        const ipler = await db.kullaniciIpleriGetir(kullaniciId);
        socket.emit('admin-kullanici-ipler', { kullaniciId, ipler });
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

    // ---- WebRTC ----
    socket.on('arama-baslat', ({ hedefId, tip }) => {
        const hs = socketBul(hedefId);
        if (!hs) { socket.emit('arama-hata', 'Kullanıcı çevrimiçi değil!'); return; }
        io.to(hs[0]).emit('gelen-arama', { arayanId: ben.id, arayanAd: ben.ad, arayanAvatar: ben.avatarUrl, tip });
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

    // ---- MAVİ BOT — GELİŞMİŞ DM ----
    socket.on('mavi-bot-mesaj', async ({ mesaj }) => {
        const maviBot = await db.kullaniciBul_ByAd('mavibot');
        if (!maviBot) { socket.emit('mavi-bot-cevap', { mesaj: 'Mavi bot bulunamadı!' }); return; }

        await db.botKonusmaKaydet(maviBot.id, ben.id, mesaj, 'kullanici');

        // Son 8 mesajı al (daha uzun bağlam)
        const tarihce = await db.botKonusmaGetir(maviBot.id, ben.id, 8);
        const siraliTarihce = tarihce.reverse();

        // Dinamik gecikme: daha uzun mesaja daha uzun düşünme süresi
        const gecikme = Math.min(500 + mesaj.length * 15, 2500);

        setTimeout(async () => {
            try {
                const cevap = await maviBotAIcevap(mesaj, ben.ad, ben.id, siraliTarihce);
                await db.botKonusmaKaydet(maviBot.id, ben.id, cevap, 'bot');
                socket.emit('mavi-bot-cevap', {
                    mesaj: cevap,
                    botAd: maviBot.ad,
                    botAvatar: maviBot.avatarUrl
                });
            } catch (e) {
                socket.emit('mavi-bot-cevap', {
                    mesaj: `Üzgünüm ${ben.ad}, şu an cevap veremiyorum 🙁 Biraz sonra tekrar dene!`,
                    botAd: maviBot.ad,
                    botAvatar: maviBot.avatarUrl
                });
            }
        }, gecikme);
    });

    // ---- SARI BOT ----
    socket.on('sari-bot-ayarla', async ({ mesaj, sureDk, odaListesi }) => {
        if (ben.rol !== 'admin') return;
        const sariBot = await db.kullaniciBul_ByAd('saribot');
        if (!sariBot) { socket.emit('admin-hata', 'Sarı bot hesabı bulunamadı!'); return; }
        await db.botAyarKaydet(sariBot.id, 'sari', mesaj, sureDk, odaListesi.join(','));
        if (botDurumlar.sari.timer) { clearInterval(botDurumlar.sari.timer); botDurumlar.sari.timer = null; }
        botDurumlar.sari.aktif = true;

        const sariBotGonder = async () => {
            const odaList = await db.odalariGetir();
            for (const oda of odaList) {
                if (!odaListesi.includes(oda.ad)) continue;
                const mesajId = uuidv4();
                await db.mesajKaydet({ id: mesajId, odaId: oda.id, gonderenId: sariBot.id, metin: '📢 ' + mesaj, fotoUrl: null, tip: 'mesaj' });
                io.to(oda.ad).emit('oda-mesaj', {
                    odaAdi: oda.ad,
                    mesaj: {
                        id: mesajId, tip: 'mesaj',
                        gonderenId: sariBot.id, gonderenAd: sariBot.ad, gonderenAvatar: sariBot.avatarUrl,
                        metin: '📢 ' + mesaj, foto: null, zaman: zamanStr(), okundu: false
                    }
                });
            }
        };

        sariBotGonder();
        botDurumlar.sari.timer = setInterval(sariBotGonder, sureDk * 60 * 1000);
        socket.emit('admin-islem-tamam', `📢 Sarı bot başlatıldı! Her ${sureDk} dakikada bir mesaj gönderecek.`);
    });

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

// ==================== PERİYODİK TEMİZLİK ====================
setInterval(async () => {
    await db.suresiBitenBanlariTemizle();
    await db.suresiBitenStoryleriTemizle();
    await db.suresiBitenIpBanlariTemizle();
}, 5 * 60 * 1000);

// ==================== BOTLARI AKTİF ET ====================
async function botlariBagla() {
    const botIsimleri = ['mavibot', 'saribot', 'kirmizibot', 'yesilbot'];
    for (const botAd of botIsimleri) {
        const bot = await db.kullaniciBul_ByAd(botAd);
        if (bot && bot.rol === 'bot') {
            aktifKullanicilar['bot_' + bot.id] = { kullanici: bot, odaAdi: null, ip: null };
            console.log('🤖 Bot aktif edildi:', bot.ad);
        }
    }
}

setTimeout(botlariBagla, 2000);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`✅ BOOM Chat v4: http://localhost:${PORT} — IP Ban + Gelişmiş Mavi Bot Aktif`));
