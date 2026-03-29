// ==================== GELİŞMİŞ MAVİ BOT v2 — mavibot.js ====================
// Bu dosyayı server.js'in yanına koy, sonra server.js'e şunu ekle:
// const MaviBot = require('./mavibot');
// Sonra tüm eski maviBotAIcevap ve maviBotGelismisCevap fonksiyonlarını sil,
// yerine MaviBot.cevapla(mesaj, kullaniciAdi, kullaniciId, tarihce) kullan.

'use strict';

// ==================== GEOMETRİ / MATEMATİK MOTORU ====================

function matematikCoz(ifade) {
    try {
        // Türkçe operatörleri standartlaştır
        let s = ifade
            .replace(/[×x]/g, '*')
            .replace(/[÷]/g, '/')
            .replace(/\bmod\b/gi, '%')
            .replace(/\bve\b/gi, '&&')
            .replace(/kare kök[ü]?\s*(\d+(?:\.\d+)?)/gi, (_, n) => Math.sqrt(parseFloat(n)))
            .replace(/√(\d+(?:\.\d+)?)/g, (_, n) => Math.sqrt(parseFloat(n)))
            .replace(/(\d+(?:\.\d+)?)\s*\^\s*(\d+(?:\.\d+)?)/g, (_, a, b) => Math.pow(parseFloat(a), parseFloat(b)))
            .replace(/(\d+(?:\.\d+)?)\s*üssü\s*(\d+(?:\.\d+)?)/gi, (_, a, b) => Math.pow(parseFloat(a), parseFloat(b)))
            .replace(/sin\s*\(([^)]+)\)/gi, (_, v) => Math.sin(parseFloat(v) * Math.PI / 180))
            .replace(/cos\s*\(([^)]+)\)/gi, (_, v) => Math.cos(parseFloat(v) * Math.PI / 180))
            .replace(/tan\s*\(([^)]+)\)/gi, (_, v) => Math.tan(parseFloat(v) * Math.PI / 180))
            .replace(/log\s*\(([^)]+)\)/gi, (_, v) => Math.log10(parseFloat(v)))
            .replace(/ln\s*\(([^)]+)\)/gi, (_, v) => Math.log(parseFloat(v)))
            .replace(/\bpi\b/gi, Math.PI)
            .replace(/\be\b/g, Math.E);

        // Güvenli eval (sadece sayı ve operatörler)
        if (!/[^0-9+\-*/.()%\s]/.test(s)) {
            // eslint-disable-next-line no-new-func
            const sonuc = Function('"use strict"; return (' + s + ')')();
            if (typeof sonuc === 'number' && isFinite(sonuc)) {
                return parseFloat(sonuc.toFixed(10)).toString().replace(/\.?0+$/, '');
            }
        }
    } catch (e) { }
    return null;
}

function birimi(deger, kaynakBirim, hedefBirim) {
    const donusumler = {
        // Uzunluk
        km_m: v => v * 1000, m_km: v => v / 1000,
        m_cm: v => v * 100, cm_m: v => v / 100,
        m_mm: v => v * 1000, mm_m: v => v / 1000,
        km_mil: v => v * 0.621371, mil_km: v => v / 0.621371,
        m_ft: v => v * 3.28084, ft_m: v => v / 3.28084,
        m_inç: v => v * 39.3701, inç_m: v => v / 39.3701,
        // Ağırlık
        kg_g: v => v * 1000, g_kg: v => v / 1000,
        kg_lb: v => v * 2.20462, lb_kg: v => v / 2.20462,
        t_kg: v => v * 1000, kg_t: v => v / 1000,
        // Sıcaklık (özel)
        c_f: v => v * 9 / 5 + 32, f_c: v => (v - 32) * 5 / 9,
        c_k: v => v + 273.15, k_c: v => v - 273.15,
        // Alan
        m2_cm2: v => v * 10000, cm2_m2: v => v / 10000,
        km2_m2: v => v * 1e6, m2_km2: v => v / 1e6,
        dönüm_m2: v => v * 1000, m2_dönüm: v => v / 1000,
        hektar_m2: v => v * 10000, m2_hektar: v => v / 10000,
        // Hacim
        lt_ml: v => v * 1000, ml_lt: v => v / 1000,
        m3_lt: v => v * 1000, lt_m3: v => v / 1000,
        galon_lt: v => v * 3.78541, lt_galon: v => v / 3.78541,
        // Hız
        'km/s_m/s': v => v / 3.6, 'm/s_km/s': v => v * 3.6,
        knot_kmh: v => v * 1.852, kmh_knot: v => v / 1.852,
        // Dijital
        gb_mb: v => v * 1024, mb_gb: v => v / 1024,
        tb_gb: v => v * 1024, gb_tb: v => v / 1024,
        mb_kb: v => v * 1024, kb_mb: v => v / 1024,
    };
    const anahtar = (kaynakBirim + '_' + hedefBirim).toLowerCase();
    const fn = donusumler[anahtar];
    if (!fn) return null;
    return parseFloat(fn(deger).toFixed(8)).toString().replace(/\.?0+$/, '');
}

// ==================== BİLGİ TABANI ====================

const bilgiTabani = {

    // ---- TARİH ----
    tarih: {
        'atatürk doğum': 'Mustafa Kemal Atatürk 19 Mayıs 1881\'de Selanik\'te doğdu. 10 Kasım 1938\'de Dolmabahçe Sarayı\'nda hayatını kaybetti.',
        'türkiye bağımsızlık': 'Türkiye Cumhuriyeti 29 Ekim 1923\'te ilan edildi. Kurtuluş Savaşı 1919-1922 yılları arasında verildi.',
        'osmanlı': 'Osmanlı İmparatorluğu 1299\'da kuruldu, 1922\'de sona erdi. 600 yılı aşkın süre 3 kıtada hüküm sürdü.',
        'fransız devrimi': 'Fransız Devrimi 1789\'da başladı. "Özgürlük, Eşitlik, Kardeşlik" sloganıyla tarihe geçti.',
        'birinci dünya savaşı': 'I. Dünya Savaşı 1914-1918 yılları arasında yaşandı. Osmanlı İmparatorluğu İttifak Devletleri safında savaştı.',
        'ikinci dünya savaşı': 'II. Dünya Savaşı 1939-1945 yılları arasında sürdü. 70-85 milyon kişi hayatını kaybetti.',
        'soğuk savaş': 'Soğuk Savaş 1947-1991 yılları arasında ABD ve SSCB arasında yaşandı. Nükleer tehdit gölgesinde geçti.',
        'ay yolculuğu': 'Apollo 11 ile Neil Armstrong 21 Temmuz 1969\'da Ay\'a ilk adımını attı.',
        'selçuklu': 'Büyük Selçuklu İmparatorluğu 1037\'de kuruldu, 1194\'de yıkıldı. Malazgirt Savaşı 1071\'de Anadolu\'nun kapılarını açtı.',
        'çanakkale': 'Çanakkale Savaşları 1915-1916 yıllarında yaşandı. Türk zaferiyle sonuçlandı. "Dur yolcu..." destanı bu savaştan doğdu.',
        'roma imparatorluğu': 'Roma Cumhuriyeti MÖ 509\'da kuruldu. İmparatorluk dönemi MÖ 27\'de başladı. Batı Roma MS 476\'da yıkıldı.',
        'asr-ı saadet': 'Hz. Muhammed (s.a.v.) MS 570\'de Mekke\'de doğdu, 632\'de Medine\'de vefat etti. İslam dini bu dönemde yayıldı.',
    },

    // ---- COĞRAFİ ----
    cografya: {
        'türkiye başkent': 'Türkiye\'nin başkenti Ankara\'dır. Nüfusu yaklaşık 5,7 milyon olup 1923\'te başkent olmuştur.',
        'türkiye nüfus': 'Türkiye\'nin nüfusu yaklaşık 85 milyon (2023). En kalabalık şehir İstanbul\'dur (15+ milyon).',
        'dünya en yüksek dağ': 'Dünyanın en yüksek dağı Everest\'tir (8.849 m). Himalaya dağ silsilesindedir, Nepal-Çin sınırında.',
        'türkiye yüzölçümü': 'Türkiye\'nin yüzölçümü 783.562 km²\'dir. Dünyada 37. büyük ülkedir.',
        'amazon nehri': 'Amazon Nehri güney Amerika\'nın en uzun nehridir (6.400 km). Dünya\'nın en fazla su taşıyan nehridir.',
        'nil nehri': 'Nil Nehri Afrika\'nın en uzun nehridir (6.650 km). Mısır uygarlığının beşiğidir.',
        'okyanus': 'Dünyanın 5 okyanusu: Pasifik (en büyük), Atlantik, Hint, Arktik, Antarktika. Pasifik tüm karalar kadar büyüktür.',
        'kıta': 'Dünyanın 7 kıtası: Asya (en büyük), Afrika, Kuzey Amerika, Güney Amerika, Antarktika, Avrupa, Avustralya.',
        'istanbul boğaz': 'İstanbul Boğazı (Boğaziçi) Avrupa ile Asya\'yı ayırır. Uzunluğu 31 km, genişliği 700m-3,5 km arasındadır.',
        'ağrı dağı': 'Ağrı Dağı Türkiye\'nin en yüksek noktasıdır (5.137 m). Doğu Anadolu\'da, İran sınırı yakınındadır.',
        'japonya': 'Japonya 6.852 adadan oluşan bir ada ülkesidir. Başkenti Tokyo\'dur. Nüfusu yaklaşık 125 milyon.',
        'çin nüfus': 'Çin dünyanın en kalabalık ikinci ülkesidir (yaklaşık 1,4 milyar). Hindistan birincidir (yaklaşık 1,44 milyar).',
    },

    // ---- BİLİM ----
    bilim: {
        'ışık hızı': 'Işık hızı yaklaşık 299.792.458 m/s (≈ 300.000 km/s). Evrendeki en hızlı şeydir.',
        'atom': 'Atom; proton ve nötronlardan oluşan çekirdek ile etrafındaki elektronlardan oluşur. Maddenin temel yapı taşıdır.',
        'dna': 'DNA (Deoksiribonükleik Asit) canlıların genetik şifresini taşır. İkili sarmal yapısındadır. 1953\'te Watson ve Crick tarafından keşfedildi.',
        'yerçekimi': 'Yerçekimi ivmesi Dünya yüzeyinde 9,81 m/s²\'dir. Newton\'un evrensel çekim yasasına göre kütleler birbirini çeker.',
        'evren yaşı': 'Evrenin yaşı yaklaşık 13,8 milyar yıldır. Büyük Patlama (Big Bang) ile başladığı kabul edilir.',
        'güneş sistemi': 'Güneş Sistemi\'nde 8 gezegen vardır: Merkür, Venüs, Dünya, Mars, Jüpiter, Satürn, Uranüs, Neptün.',
        'su kimyası': 'Su H₂O formülüne sahiptir: 2 hidrojen + 1 oksijen atomu. Kaynama noktası 100°C (deniz seviyesi), donma noktası 0°C.',
        'fotosentez': 'Fotosentez: CO₂ + H₂O + güneş ışığı → C₆H₁₂O₆ (glikoz) + O₂. Klorofilli canlılar bu süreci gerçekleştirir.',
        'evrim': 'Darwin\'in evrim teorisine göre canlılar doğal seçilim yoluyla milyonlarca yılda değişir. "Türlerin Kökeni" 1859\'da yayımlandı.',
        'einstein': 'E=mc² formülü Albert Einstein\'ın özel görelilik teorisinden gelir. E=enerji, m=kütle, c=ışık hızıdır.',
        'periyodik tablo': 'Periyodik tabloda 118 element vardır. Mendeleev 1869\'da ilk versiyonunu oluşturdu.',
        'kara delik': 'Kara delik, yerçekiminin o kadar güçlü olduğu bölgedir ki ışık bile kaçamaz. Olay ufkunu geçen hiçbir şey geri dönemez.',
        'kuantum': 'Kuantum mekaniği atomaltı parçacıkların davranışını açıklar. Parçacıklar aynı anda birden fazla durumda olabilir (süperpozisyon).',
    },

    // ---- TEKNOLOJİ / BİLGİSAYAR ----
    teknoloji: {
        'yapay zeka': 'Yapay Zeka (AI), insan zekasını taklit eden sistemlerdir. Makine öğrenmesi, derin öğrenme, doğal dil işleme alt alanlarını kapsar.',
        'internet nasıl': 'İnternet, TCP/IP protokolü kullanan küresel bir bilgisayar ağıdır. İstekler DNS, yönlendirici, sunucu zinciriyle çözülür.',
        'blockchain': 'Blockchain merkezi olmayan, şifreli, değiştirilemez bir dağıtık defter teknolojisidir. Bitcoin\'in altyapısıdır.',
        'cpu gpu': 'CPU (merkezi işlemci) az ama karmaşık görevi sıralı yapar. GPU (grafik işlemci) binlerce basit görevi paralel işler. AI için GPU tercih edilir.',
        'python': 'Python 1991\'de Guido van Rossum tarafından yaratıldı. Öğrenmesi kolay, okunabilir sözdizimli genel amaçlı bir dildir.',
        'javascript': 'JavaScript 1995\'te Brendan Eich tarafından 10 günde yazıldı. Tarayıcılarda çalışan tek programlama dilidir.',
        'linux': 'Linux 1991\'de Linus Torvalds tarafından geliştirildi. Açık kaynaklı, Unix benzeri bir işletim sistemi çekirdeğidir.',
        'bulut bilişim': 'Bulut bilişim, bilişim kaynaklarını internet üzerinden kiralama modelidir. AWS, Azure, Google Cloud başlıca sağlayıcılardır.',
        'api': 'API (Uygulama Programlama Arayüzü), yazılımların birbiriyle konuşmasını sağlar. REST API en yaygın türdür.',
        'html css': 'HTML web sayfasının iskeletidir, CSS görünümünü belirler, JavaScript davranışını sağlar. Web\'in 3 temel teknolojisidir.',
        'otonom araç': 'Otonom araçlar LIDAR, radar, kamera ve AI kullanır. Tesla, Waymo bu alanda öncüdür. SAE seviye 0-5 arası sınıflandırılır.',
    },

    // ---- SAĞLIK ----
    saglik: {
        'kalp nasıl çalışır': 'Kalp günde 100.000 kez atar, 7.000 litre kan pompalar. Dört odacıklıdır: sol/sağ atrium ve sol/sağ ventrikül.',
        'uyku kaç saat': 'Yetişkinler için 7-9 saat, gençler için 8-10 saat, bebekler için 14-17 saat uyku önerilir.',
        'bağışıklık sistemi': 'Bağışıklık sistemi T ve B lenfositleri, antikorlar, fagositler ile patojenlere karşı savaşır. Aşılar bağışıklığı güçlendirir.',
        'protein': 'Proteinler amino asitlerden oluşur. Kas yapımı, enzim üretimi, bağışıklık için gereklidir. Et, yumurta, baklagiller iyi kaynaklardır.',
        'stres': 'Kronik stres kortizol hormonu salgılar. Kalp hastalığı, depresyon riskini artırır. Egzersiz, meditasyon, nefes teknikleri yardımcı olur.',
        'su içmek': 'Günde 2-3 litre su içilmesi önerilir. Vücut ağırlığının %60\'ı sudur. Böbrek sağlığı ve metabolizma için kritiktir.',
        'bmi': 'BMI (Vücut Kitle İndeksi) = kilo(kg) / boy(m)². 18,5 altı zayıf, 18,5-24,9 normal, 25-29,9 kilolu, 30+ obez.',
    },

    // ---- EKONOMİ ----
    ekonomi: {
        'enflasyon': 'Enflasyon, genel fiyat düzeyinin zamanla artmasıdır. Merkez bankaları faiz oranlarıyla kontrol eder. %2 civarı "sağlıklı" kabul edilir.',
        'gdp': 'GSYH (GDP), bir ülkenin belirli dönemde ürettiği mal ve hizmetlerin toplam değeridir. Ekonomik büyüklüğün temel göstergesidir.',
        'kripto para': 'Kripto para, merkezi olmayan dijital para birimidir. Bitcoin ilk ve en büyüğüdür (2009, Satoshi Nakamoto). Ethereum, Solana diğer büyük kriptolardır.',
        'faiz': 'Faiz, borç verilen paranın kullanım bedelidir. Merkez bankası faiz artırırsa enflasyon düşer, ekonomi yavaşlar. Düşürürse tersi olur.',
        'borsa': 'Borsa, şirket hisselerinin alınıp satıldığı organize pazardır. Türkiye\'de BIST, ABD\'de NYSE ve NASDAQ başlıca borsalardır.',
    },

    // ---- FELSEFE / DİN ----
    felsefe: {
        'sokrates': 'Sokrates (MÖ 470-399) Antik Yunan filozofudur. "Bildiğim tek şey, hiçbir şey bilmediğimdir" sözüyle tanınır. Sokratik yöntem diyalog yoluyla sorgulamadır.',
        'platon': 'Platon (MÖ 428-348) idealar teorisiyle tanınır. "Devlet" adlı eseri idealüte toplumun felsefi tasviridir.',
        'aristoteles': 'Aristoteles (MÖ 384-322) mantık, etik, fizik, biyoloji alanlarında çalıştı. Mantığın kurucusu sayılır.',
        'nietzsche': 'Friedrich Nietzsche (1844-1900) "Tanrı öldü" ifadesiyle tanınır. Üst-insan (Übermensch) kavramını geliştirdi.',
        'islam': 'İslam, Hz. Muhammed\'e vahyedilen monoteist bir dindir. Beş şartı vardır: Kelime-i Şehadet, namaz, zekat, oruç, hac.',
        'budizm': 'Budizm MÖ 5. yüzyılda Siddhartha Gautama (Buda) tarafından kuruldu. Acıdan kurtuluşu (nirvana) hedefler.',
        'stoacılık': 'Stoacılık; değiştiremediğinlere üzülmeme, değiştirebileceklere odaklanma felsefesidir. Marcus Aurelius, Epiktetos önemli stoacılardır.',
    },

    // ---- SPOR ----
    spor: {
        'futbol kuralları': 'Futbolda 11 kişilik iki takım 90 dakika oynar (2×45 dk). Skor eşitse uzatma veya penaltı atışları olur. En fazla gol atan kazanır.',
        'olimpiyatlar': 'Modern Olimpiyatlar 1896\'da Atina\'da başladı. Her 4 yılda bir yapılır. Yaz ve Kış Olimpiyatları ayrıdır.',
        'formula 1': 'F1\'de 20 pilot 10 takım adına yarışır. Her yarışta en hızlı tur, puan sistemi ve pit stratejisi belirleyicidir. Motor hacmi 1,6 litre hibrid.',
        'basketbol': 'Basketbol 1891\'de James Naismith tarafından icat edildi. NBA dünyada en büyük basketbol ligidir. Sahada 5\'e 5 oynanır.',
        'tenis': 'Teniste 4 Grand Slam turnuvası vardır: Wimbledon, Roland Garros, US Open, Avustralya Açık. Maçlar setlerle belirlenir.',
    },

    // ---- SANAT / MÜZİK / EDEBİYAT ----
    sanat: {
        'mona lisa': 'Mona Lisa, Leonardo da Vinci\'nin 1503-1519 arasında yaptığı tablodir. Paris\'teki Louvre Müzesi\'nde sergilenmektedir.',
        'shakespeare': 'William Shakespeare (1564-1616) İngiliz şair ve oyun yazarıdır. Hamlet, Othello, Romeo ve Juliet en ünlü eserleridir.',
        'beethoven': 'Ludwig van Beethoven (1770-1827) Alman bestecisidir. 9. Senfoni\'yi tamamen sağır olduğu dönemde besteledi.',
        'türk edebiyat': 'Türk edebiyatının önemli isimleri: Nazım Hikmet, Orhan Pamuk (Nobel 2006), Yaşar Kemal, Aziz Nesin, Sabahattin Ali.',
        'rock müzik': 'Rock müzik 1950\'lerde ABD\'de doğdu. Elvis Presley, Beatles, Led Zeppelin, Pink Floyd öncü isimler arasındadır.',
        'hip hop': 'Hip Hop 1970\'lerde Bronx\'ta doğdu. DJ Kool Herc öncüsüdür. Rap, breakdance, graffiti kültürünü kapsar.',
    },

};

// ==================== NİYET TESPİT ====================

function niyetBelirle(m) {
    const t = m.toLowerCase().trim();

    // Matematiksel ifade kontrolü
    const mathPattern = /[\d]+.*[+\-*\/^%].*[\d]+|karekök|√|sin |cos |tan |log |ln /i;
    if (mathPattern.test(t)) return 'matematik';

    // Birim dönüşüm
    if (/\b(\d[\d,.]*)\s*(km|m|cm|mm|kg|g|lt|ml|gb|mb|kb|tb|°?c|°?f|k|mil|ft|inç|lb|galon|knot|dönüm|hektar|m²|cm²)\s*(kaç|ne kadar|=|to\s|to$|in\s)?\s*(km|m|cm|mm|kg|g|lt|ml|gb|mb|kb|tb|°?c|°?f|k|mil|ft|inç|lb|galon|knot|dönüm|hektar|m²|cm²)/i.test(t)) return 'birim';

    // Saat ve tarih
    if (/saat kaç|kaç oldu|tarih|bugün ne|hangi gün|ayın kaçı/.test(t)) return 'zamanbilgi';

    // Selamlama
    if (/^(merhaba|selam|slm|hey|hi|hello|sa|selamun|mrb|günaydın|iyi günler|iyi akşam|iyi gece|naber|nasılsın|nasilsin|ne haber|keyif)(\s|!|,|\?|\.)*$/.test(t)) return 'selamlama';

    // Veda
    if (/^(güle güle|bye|hoşçakal|görüşürüz|bb|iyi geceler|iyi günler|iyi akşamlar)(\s|!)*$/.test(t)) return 'veda';

    // Teşekkür
    if (/^(teşekkür|sağol|eyw|eyv|thanks|thank|çok iyi|harika|süper|mükemmel|bravo)/.test(t)) return 'tesekkur';

    // Kim/ne sorusu
    if (/^(kimsin|adın ne|sen kimsin|hakkında|ne yaparsın|yardım|help|neler yapabilirsin)/i.test(t)) return 'kimsin';

    // Bilgi sorusu — bilgi tabanını tara
    for (const kategori of Object.values(bilgiTabani)) {
        for (const [anahtar, _] of Object.entries(kategori)) {
            const kelimeler = anahtar.split(' ');
            if (kelimeler.every(k => t.includes(k))) return 'bilgi_bulundu_' + anahtar;
        }
    }

    // Genel bilgi sorusu
    if (/nedir|ne demek|nasıl çalışır|nasıl yapılır|anlat|açıkla|hakkında bilgi|kaç|kim|nerede|ne zaman|nasıl|neden|niçin/.test(t)) return 'acikla';

    // Yorum/öneri
    if (/film öner|dizi öner|kitap öner|oyun öner|müzik öner|ne izlesem|ne oynasam|ne dinlesem|ne okusam/.test(t)) return 'oneri';

    // Kod
    if (/kod yaz|python|javascript|js |html |css |c\+\+|java |php |bash |sql |script|fonksiyon|class |döngü|loop|array|liste|algoritma/.test(t)) return 'kod';

    // Şaka
    if (/şaka|fıkra|komik|güldür|espri|bir fıkra anlat/.test(t)) return 'saka';

    // Motivasyon
    if (/motivasyon|hüzün|üzgün|mutsuz|cesaretlen|başaramıyorum|yapamıyorum|zor gün|yalnız|depresif|sıkıldım/.test(t)) return 'motivasyon';

    // Tarif
    if (/tarif|yemek|pişir|nasıl yapılır|malzeme|ne yesem|ne pişirsem/.test(t)) return 'tarif';

    // Dil bilgisi/çeviri
    if (/türkçesi|ingilizce|çevir|nasıl yazılır|ne anlam|anlamı ne/.test(t)) return 'ceviri';

    return 'genel';
}

// ==================== YARATICI CEVAP ÜRETİCİ ====================

function selamlaCevap(ad, sayi) {
    const secenekler = [
        `Merhaba ${ad}! 👋 Ne öğrenmek istersin bugün?`,
        `Selam ${ad}! Nasılsın? Sana nasıl yardımcı olabilirim?`,
        `Hey ${ad}! Buradayım. Soru, hesaplama, bilgi — ne istersen 😊`,
        `Merhaba! Ben Mavi Bot 🔵 ${ad}, bugün hangi konuyu merak ediyorsun?`,
        `${ad}, hoş geldin! Matematik mi, tarih mi, teknoloji mi — seç başlayalım!`,
    ];
    return secenekler[sayi % secenekler.length];
}

function vedaCevap(ad, sayi) {
    const secenekler = [
        `Görüşürüz ${ad}! 👋 Dilediğin zaman dön.`,
        `Hoşça kal ${ad}! İyi günler dilerim 🌟`,
        `Bay bay ${ad}! Her zaman buradayım 💙`,
    ];
    return secenekler[sayi % secenekler.length];
}

function tesekkurCevap(ad, sayi) {
    const secenekler = [
        `Rica ederim ${ad}! 😊 Başka sorun var mı?`,
        `Ne demek ${ad}, her zaman! 💙`,
        `Yardımcı olabildimse çok iyi! Başka bir şey istersen söyle 😄`,
    ];
    return secenekler[sayi % secenekler.length];
}

function kimsinCevap(ad) {
    return `Ben Mavi Bot 🔵 — BOOM Chat'in yapay zeka asistanıyım!

**Yapabileceklerim:**
🧮 Matematik & birim çevirisi (karmaşık hesaplar dahil)
📚 Bilgi soruları (tarih, bilim, coğrafya, teknoloji...)
💻 Kod yazma (Python, JS, HTML, CSS...)
🎬 Film, dizi, oyun, müzik önerisi
🍕 Yemek tarifleri
⏰ Saat & tarih bilgisi
😂 Şaka & eğlence
💪 Motivasyon & destek
🌍 Dil bilgisi & çeviri yardımı

"${ad}, nasıl başlayalım?" 😊`;
}

function matematikCevap(m, ad) {
    // Önce ham ifadeyi bulmaya çalış
    const temiz = m.replace(/kaç(tır|tir|tur|tur)?(\s*(eder|yapar|olur))?/gi, '').trim();
    const sonuc = matematikCoz(temiz);
    if (sonuc !== null) {
        return `🧮 **Sonuç:** \`${sonuc}\`\n\n_İfade: ${temiz}_`;
    }

    // Özel formüller
    const karekokMatch = m.match(/karekök[ü]?\s+(\d+(?:\.\d+)?)|√\s*(\d+(?:\.\d+)?)/i);
    if (karekokMatch) {
        const n = parseFloat(karekokMatch[1] || karekokMatch[2]);
        return `🧮 √${n} = **${Math.sqrt(n).toFixed(8).replace(/\.?0+$/, '')}**`;
    }

    // Pi
    if (/\bpi\b|\bπ\b/i.test(m) && /çevre|alan|r=/i.test(m)) {
        const rMatch = m.match(/r\s*=\s*(\d+(?:\.\d+)?)|yarıçap\s*(\d+(?:\.\d+)?)/i);
        if (rMatch) {
            const r = parseFloat(rMatch[1] || rMatch[2]);
            return `🧮 Daire (r=${r}): Alan = π×r² = **${(Math.PI * r * r).toFixed(4)}** | Çevre = 2πr = **${(2 * Math.PI * r).toFixed(4)}**`;
        }
    }

    return `🧮 "${m}" ifadesini çözemedim ${ad}. Lütfen matematiksel işlemi net yaz, örnek: "125 * 37 + 44" veya "karekök 144"`;
}

function birimCevap(m, ad) {
    const pattern = /(\d+(?:[.,]\d+)?)\s*(km|m|cm|mm|kg|g|lt|litre|ml|gb|mb|kb|tb|°?c|celsius|°?f|fahrenheit|k|kelvin|mil|ft|feet|foot|inç|inch|lb|pound|galon|gallon|knot|dönüm|hektar|m2|m²|cm2|cm²)\s*(=|kaç|ne kadar|in|to)?\s*(km|m|cm|mm|kg|g|lt|litre|ml|gb|mb|kb|tb|°?c|celsius|°?f|fahrenheit|k|kelvin|mil|ft|feet|foot|inç|inch|lb|pound|galon|gallon|knot|dönüm|hektar|m2|m²|cm2|cm²)/i;
    const eslesme = m.match(pattern);
    if (!eslesme) return null;

    const deger = parseFloat(eslesme[1].replace(',', '.'));
    let kaynak = eslesme[2].toLowerCase().replace('°', '').replace('litre', 'lt').replace('feet', 'ft').replace('foot', 'ft').replace('inch', 'inç').replace('pound', 'lb').replace('gallon', 'galon').replace('celsius', 'c').replace('fahrenheit', 'f').replace('kelvin', 'k').replace('m2', 'm²').replace('cm2', 'cm²');
    let hedef = eslesme[4].toLowerCase().replace('°', '').replace('litre', 'lt').replace('feet', 'ft').replace('foot', 'ft').replace('inch', 'inç').replace('pound', 'lb').replace('gallon', 'galon').replace('celsius', 'c').replace('fahrenheit', 'f').replace('kelvin', 'k').replace('m2', 'm²').replace('cm2', 'cm²');

    const sonuc = birimi(deger, kaynak, hedef);
    if (sonuc !== null) {
        return `🔄 **${deger} ${kaynak} = ${sonuc} ${hedef}**`;
    }
    return `🔄 "${kaynak}" → "${hedef}" dönüşümünü yapamadım ${ad}. Desteklenen birimler: km, m, cm, kg, g, lt, ml, GB, MB, °C, °F, K, mil, ft, inç, lb, galon...`;
}

function kodCevap(m, ad) {
    const dil = m.match(/python|javascript|js|html|css|c\+\+|java\b|php|bash|sql|typescript|ts\b/i)?.[0]?.toLowerCase() || 'python';

    if (/merhaba dünya|hello world/i.test(m)) {
        const ornekler = {
            python: '```python\nprint("Merhaba Dünya! 👋")\n```',
            javascript: '```javascript\nconsole.log("Merhaba Dünya! 👋");\n```',
            js: '```javascript\nconsole.log("Merhaba Dünya! 👋");\n```',
            html: '```html\n<!DOCTYPE html>\n<html>\n<body>\n  <h1>Merhaba Dünya! 👋</h1>\n</body>\n</html>\n```',
            css: '```css\nbody {\n  font-family: sans-serif;\n  color: #333;\n}\nh1::after {\n  content: " 👋";\n}\n```',
            php: '```php\n<?php echo "Merhaba Dünya! 👋"; ?>\n```',
            java: '```java\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println("Merhaba Dünya! 👋");\n  }\n}\n```',
            sql: '```sql\nSELECT "Merhaba Dünya! 👋" AS mesaj;\n```',
            bash: '```bash\necho "Merhaba Dünya! 👋"\n```',
        };
        return `💻 ${dil.toUpperCase()} - Merhaba Dünya:\n\n${ornekler[dil] || ornekler.python}`;
    }

    if (/for döngü|for loop/i.test(m)) {
        if (dil === 'python') return '```python\nfor i in range(10):\n    print(f"Sayı: {i}")\n```\nPython\'da `range(10)` 0\'dan 9\'a kadar sayar.';
        if (/js|javascript/.test(dil)) return '```javascript\nfor (let i = 0; i < 10; i++) {\n    console.log(`Sayı: ${i}`);\n}\n```';
    }

    if (/liste|array/i.test(m)) {
        if (dil === 'python') return '```python\nliste = [1, 2, 3, 4, 5]\nprint(liste[0])       # İlk eleman: 1\nliste.append(6)       # Eleman ekle\nprint(len(liste))     # Uzunluk: 6\n```';
        if (/js|javascript/.test(dil)) return '```javascript\nconst liste = [1, 2, 3, 4, 5];\nconsole.log(liste[0]);        // İlk eleman: 1\nliste.push(6);                // Eleman ekle\nconsole.log(liste.length);    // Uzunluk: 6\n```';
    }

    if (/fonksiyon|function/i.test(m)) {
        if (dil === 'python') return '```python\ndef topla(a, b):\n    return a + b\n\nsonuc = topla(3, 5)\nprint(sonuc)  # 8\n```';
        if (/js|javascript/.test(dil)) return '```javascript\nfunction topla(a, b) {\n    return a + b;\n}\n\nconst sonuc = topla(3, 5);\nconsole.log(sonuc);  // 8\n```';
    }

    if (/sözlük|dict|object|nesne/i.test(m)) {
        if (dil === 'python') return '```python\nkisi = {\n    "ad": "Ahmet",\n    "yas": 25,\n    "sehir": "İstanbul"\n}\nprint(kisi["ad"])       # Ahmet\nkisi["meslek"] = "Yazılımcı"  # Ekle\n```';
        if (/js|javascript/.test(dil)) return '```javascript\nconst kisi = {\n    ad: "Ahmet",\n    yas: 25,\n    sehir: "İstanbul"\n};\nconsole.log(kisi.ad);         // Ahmet\nkisi.meslek = "Yazılımcı";    // Ekle\n```';
    }

    return `💻 ${ad}, **${dil}** kodunu daha detaylı açıklar mısın? Örneğin:\n- "Python'da liste sıralama kodu yaz"\n- "JavaScript'te fetch API nasıl kullanılır"\n- "HTML'de form nasıl yapılır"\n\nNe istediğini netleştir, tam kodu yazayım! 🚀`;
}

function sakaAt(sayi) {
    const sakalar = [
        'Neden programcılar karanlıkta çalışır? Çünkü ışık **bug** çeker! 🐛',
        'Bir SQL komutu bara girmiş: "SELECT bira FROM içecekler WHERE fiyat < 20" 🍺',
        'İki JS developer kafede buluşmuş. Biri: "Kahve iç!" Diğeri: `undefined` 😂',
        'Python neden iyi bir terapi dili? Çünkü indentation zorunlu, her şey hizalı olunca hayat daha güzel 😄',
        'Yazılımcı: "Bug yok!" Kullanıcı: *bir şey tıklar* Yazılımcı: "Bu bir özellik!" 🤡',
        'Bilgisayar neden yorulur? Çok fazla Windows açık! 💻',
        'Bir mühendis asansörde sıkışmış. Asistan: "Çözüm buldunuz mu?" Müh: "Kodu debug ediyorum..." 🛗',
        'Hava tahmin programı neden işe yaramıyor? Çünkü `try { havaYağıyor } catch (e) { güneş }` 🌦️',
        'Git commit mesajları: "Düzelttim" / "Tekrar düzelttim" / "Artık çalışıyor neden bilmiyorum" / "Lütfen çalış" 😭',
        'Bir veritabanı barda ne içer? Şifreli bira 🔐',
        'Sonsuz döngüye girsem ne olur? Baksana zaten girdin, çıkamıyorsun 🔄',
        'Junior dev: "Benim kodumda hata yok!" Senior dev: "Gözlerinde hata var o zaman" 👁️',
    ];
    return '😂 ' + sakalar[sayi % sakalar.length];
}

function motivasyonVer(m, ad) {
    if (/üzgün|mutsuz|kötüyüm|berbat|ağlıyorum/.test(m)) {
        return `${ad}, üzgün olduğunu anlıyorum 💙 Bazen hayat gerçekten ağır gelebilir ve bu tamamen normal. Duygularını yaşamak güçlü olmak demek.\n\nEğer paylaşmak istersen buradayım. Ne yaşıyorsun?`;
    }
    if (/yapamıyorum|başaramıyorum|zor|imkansız/.test(m)) {
        return `${ad}, "yapamıyorum" aslında "henüz yapamıyorum" demek! 💪\n\nHer usta bir zamanlar acemiydi. Zorlandığın şey nedir? Belki birlikte çözebiliriz!`;
    }
    if (/sıkıldım|bıktım|bezgin/.test(m)) {
        return `Anlıyorum ${ad}, bazen her şeyden bıkmak mümkün. 🌊\n\n5 dakika tamamen farklı bir şey yap: müzik dinle, yürüyüşe çık, bir bardak su iç. Küçük mola büyük fark yaratır!`;
    }
    const genel = [
        `${ad}, büyük başarılar küçük adımlarla başlar. Bugün bir adım attın — bu yeterli! ⭐`,
        `Kendine inan ${ad}! En karanlık gece bile sabaha kavuşur. 🌅`,
        `${ad}, zorlandığın şeyler seni büyütüyor. Devam et! 🚀`,
    ];
    return genel[Math.floor(Math.random() * genel.length)];
}

function oneriVer(m, ad, sayi) {
    if (/film/.test(m)) {
        const filmler = [
            ['Interstellar', '2014, Nolan. Uzay ve zaman üzerine zihin açıcı.'],
            ['The Shawshank Redemption', '1994. Umudu anlatan en iyi filmlerden biri.'],
            ['Inception', '2010, Nolan. Rüya içinde rüya, akıl oyunu.'],
            ['12 Angry Men', '1957. 12 kişi, 1 oda, mükemmel diyalog.'],
            ['Parasite', '2019, Bong Joon-ho. Oscar\'lı Güney Kore başyapıtı.'],
            ['The Dark Knight', '2008. Süper kahraman filminin ötesinde, suç drami.'],
        ];
        const film = filmler[sayi % filmler.length];
        return `🎬 Öneri: **${film[0]}** — ${film[1]}\n\nTür tercihin var mı? (Aksiyon, bilim kurgu, drama, komedi, gerilim...)`;
    }
    if (/dizi/.test(m)) {
        const diziler = [
            ['Breaking Bad', 'İyi adamın dönüşümü. Tüm zamanların en iyilerinden.'],
            ['Dark (Netflix)', 'Zaman yolculuğu, Almanca, gizemli. 3 sezon.'],
            ['Chernobyl (HBO)', '5 bölüm. Tarihin en iyi mini dizilerinden.'],
            ['Diriliş Ertuğrul', 'Türk yapımı, tarihi. 448 bölüm, uzun soluk.'],
            ['Squid Game', '2021, Güney Kore. Aksiyon ve dram, geniş izleyici kitlesi.'],
        ];
        const dizi = diziler[sayi % diziler.length];
        return `📺 Öneri: **${dizi[0]}** — ${dizi[1]}\n\nHangi türü seversin? Daha iyi öneri vereyim!`;
    }
    if (/oyun/.test(m)) {
        const oyunlar = [
            ['The Witcher 3', 'Açık dünya RPG. 100+ saat içerik, muhteşem hikaye.'],
            ['Red Dead Redemption 2', 'Batı vahşi batı simülasyonu. Görsel şölen.'],
            ['Elden Ring', 'Zor ama tatmin edici. FromSoftware başyapıtı.'],
            ['Minecraft', 'Yaratıcılık sınırsız. Her yaşa uygun.'],
            ['Hollow Knight', 'Bağımsız oyun şaheseri. Ucuz, derin.'],
        ];
        const oyun = oyunlar[sayi % oyunlar.length];
        return `🎮 Öneri: **${oyun[0]}** — ${oyun[1]}\n\nPC mi konsol mu? Favori türün ne?`;
    }
    if (/kitap/.test(m)) {
        const kitaplar = [
            ['Suç ve Ceza — Dostoyevski', 'Psikolojik derinlik, klasik Rus edebiyatı.'],
            ['Simyacı — Paulo Coelho', 'Kısa, ilham verici, evrensel mesaj.'],
            ['1984 — George Orwell', 'Distopya. Günümüzde hâlâ çarpıcı.'],
            ['Sapiens — Yuval Noah Harari', 'İnsanlık tarihinin özeti. Çok satanlar.'],
            ['İnce Memed — Yaşar Kemal', 'Türk edebiyatının başyapıtı.'],
        ];
        const kitap = kitaplar[sayi % kitaplar.length];
        return `📚 Öneri: **${kitap[0]}** — ${kitap[1]}\n\nHangi türü tercih edersin? (Roman, bilim, tarih, kişisel gelişim...)`;
    }
    if (/müzik/.test(m)) {
        const muzik = [
            ['Lo-Fi Hip Hop', 'Çalışırken veya dinlenirken. Stres azaltır.'],
            ['Klasik Müzik', 'Mozart, Beethoven, Chopin. Konsantrasyon için ideal.'],
            ['Turkish Pop', 'Sezen Aksu, Tarkan, Müslüm Gürses. Türkçe pop klasikleri.'],
            ['Jazz', 'Miles Davis, Coltrane. Rahatlamak için mükemmel.'],
        ];
        const m2 = muzik[sayi % muzik.length];
        return `🎵 Öneri: **${m2[0]}** — ${m2[1]}\n\nSpotify'da "Daily Mix" veya "Discover Weekly" da sana özel öneri sunar!`;
    }
    return `🤔 ${ad}, öneri için neyi arıyorsun? Film, dizi, kitap, oyun, müzik — hangisi? Daha iyi önerim olsun!`;
}

function bilgiBulCevap(m) {
    const t = m.toLowerCase();
    for (const kategori of Object.values(bilgiTabani)) {
        let enIyiEslesme = null;
        let enIyiSkor = 0;

        for (const [anahtar, bilgi] of Object.entries(kategori)) {
            const kelimeler = anahtar.split(' ');
            const eslesen = kelimeler.filter(k => t.includes(k)).length;
            const skor = eslesen / kelimeler.length;
            if (skor > enIyiSkor && eslesen > 0) {
                enIyiSkor = skor;
                enIyiEslesme = bilgi;
            }
        }

        if (enIyiEslesme && enIyiSkor >= 0.5) {
            return '📖 ' + enIyiEslesme;
        }
    }
    return null;
}

function aciklaGiris(m, ad) {
    // Sayı bilgileri
    const sayiMatch = m.match(/(\d+(?:\.\d+)?)\s+(?:üssü|kare(?:si)?|küpü|çarpi|bölü)\s+(\d+(?:\.\d+)?)/i);
    if (sayiMatch) return matematikCevap(m, ad);

    // Temel cevap
    const bilgiSonuc = bilgiBulCevap(m);
    if (bilgiSonuc) return bilgiSonuc;

    return null;
}

// ==================== ANA CEVAP FONKSİYONU ====================

function yerelCevapUret(mesaj, kullaniciAdi, konusmaSayisi = 1) {
    const ad = kullaniciAdi;
    const m = mesaj.trim();
    const mt = m.toLowerCase();
    const sayi = konusmaSayisi;

    const niyet = niyetBelirle(m);

    // Selamlama
    if (niyet === 'selamlama') return selamlaCevap(ad, sayi);
    if (niyet === 'veda') return vedaCevap(ad, sayi);
    if (niyet === 'tesekkur') return tesekkurCevap(ad, sayi);
    if (niyet === 'kimsin') return kimsinCevap(ad);

    // Zaman bilgisi
    if (niyet === 'zamanbilgi') {
        if (/saat kaç|kaç oldu/i.test(m)) {
            const simdi = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' });
            return `⏰ Türkiye saati: **${simdi}** (UTC+3)`;
        }
        const bugun = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Istanbul' });
        return `📅 Bugün: **${bugun}**`;
    }

    // Matematik
    if (niyet === 'matematik') return matematikCevap(m, ad);

    // Birim çevirisi
    const birimSonuc = birimCevap(m, ad);
    if (birimSonuc) return birimSonuc;

    // Şaka
    if (niyet === 'saka') return sakaAt(sayi);

    // Motivasyon
    if (niyet === 'motivasyon') return motivasyonVer(mt, ad);

    // Öneri
    if (niyet === 'oneri') return oneriVer(mt, ad, sayi);

    // Kod
    if (niyet === 'kod') return kodCevap(mt, ad);

    // Bilgi tabanı
    const bilgiSonuc = bilgiBulCevap(m);
    if (bilgiSonuc) return bilgiSonuc;

    // Açıklama dene
    const aciklaSonuc = aciklaGiris(m, ad);
    if (aciklaSonuc) return aciklaSonuc;

    // Özel durumlar
    if (/robot musun|yapay zeka mısın|ai misin|gerçek misin|insan mısın/i.test(mt)) {
        return `Evet ${ad}, ben bir yapay zeka asistanıyım 🤖 İnsan değilim ama seninle gerçek anlamda yardımcı olmaya çalışıyorum! Merak ettiğin bir şey var mı?`;
    }

    if (/boom chat|bu site|bu platform|uygulamanın özellikleri/i.test(mt)) {
        return `💬 **BOOM Chat** özellikleri:\n🏠 Oda sohbetleri\n💌 Direkt mesaj (DM)\n👥 Grup sohbetleri\n📸 Story (24 saat)\n🎬 Reels (kısa video)\n📡 Akış (sosyal medya)\n🤖 Yapay zeka botları (ben dahil!)\n📹 Görüntülü/sesli arama (WebRTC)\n\nBaşka sorun var mı ${ad}?`;
    }

    // Varsayılan
    const varsayilanlar = [
        `🤔 "${m}" sorusunu tam anlayamadım ${ad}. Biraz daha açar mısın?`,
        `${ad}, bu konuda daha fazla bilgi verir misin? Daha iyi yardımcı olayım!`,
        `Hmm ${ad}! Soruyu farklı bir şekilde sorabilir misin? Anlamaya çalışıyorum 💭`,
        `${ad}, "yardım" yazarsan neler yapabileceğimi görebilirsin. Bu konuyu tam kavrayamadım.`,
    ];
    return varsayilanlar[sayi % varsayilanlar.length];
}

// ==================== ANTHROPİC API ENTEGRASYONU ====================

const BOT_BELLEK = {};

const SISTEM_PROMPT = `Sen BOOM Chat'in yapay zeka asistanısın. Adın Mavi Bot.

KİŞİLİĞİN:
- Samimi, sıcak, zeki ve yardımseversin
- Türkçe konuşursun, emoji az ama yerinde kullanırsın
- Chat ortamı için kısa cevaplar (1-4 cümle genellikle yeterli)
- Kullanıcıyı ismiyle hitap edersin
- Yanlış bilgi vermek yerine dürüstçe "emin değilim" dersin
- Markdown kullanabilirsin (başlıklar, listeler, kod blokları)

YETENEKLERİN:
- Matematik hesaplama (karmaşık formüller dahil)
- Tarih, bilim, coğrafya, teknoloji bilgisi
- Kod yazma (Python, JS, HTML, CSS, SQL...)
- Film/dizi/kitap/oyun/müzik önerisi
- Yemek tarifi
- Birim dönüşümü (km/m, kg/lb, °C/°F...)
- Motivasyon ve duygusal destek
- Dil bilgisi ve kelime anlamları

SINIRLAMALAR:
- Zararlı veya yasadışı içerik üretmezsin
- Anlık haber/borsa/hava durumu verisi yoktur
- Gerektiğinde dürüstçe söylersin

Kullanıcının saat dilimi: Türkiye (UTC+3)`;

async function cevapla(mesaj, kullaniciAdi, kullaniciId, tarihce = []) {
    if (!BOT_BELLEK[kullaniciId]) BOT_BELLEK[kullaniciId] = { sayi: 0 };
    BOT_BELLEK[kullaniciId].sayi++;
    const konusmaSayisi = BOT_BELLEK[kullaniciId].sayi;

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

    // API var mı?
    if (ANTHROPIC_KEY) {
        try {
            const gecmisler = tarihce.slice(-10).map(k => ({
                role: k.gonderen === 'kullanici' ? 'user' : 'assistant',
                content: k.mesaj
            }));
            gecmisler.push({ role: 'user', content: mesaj });

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 800,
                    system: SISTEM_PROMPT + `\n\nKullanıcı adı: ${kullaniciAdi}\nBu konuşmada ${konusmaSayisi}. mesaj\nŞu an Türkiye saati: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`,
                    messages: gecmisler
                })
            });

            if (response.ok) {
                const data = await response.json();
                const cevapMetni = data.content?.[0]?.text;
                if (cevapMetni) return cevapMetni;
            }
        } catch (e) {
            console.warn('[MaviBot] API hatası, yerel sisteme geçiliyor:', e.message);
        }
    }

    // Yerel sistem
    return yerelCevapUret(mesaj, kullaniciAdi, konusmaSayisi);
}

// Belleği temizle (isteğe bağlı periyodik çağrı)
function bellekTemizle() {
    const LIMIT = 5000;
    const anahtarlar = Object.keys(BOT_BELLEK);
    if (anahtarlar.length > LIMIT) {
        anahtarlar.slice(0, anahtarlar.length - LIMIT).forEach(k => delete BOT_BELLEK[k]);
    }
}

setInterval(bellekTemizle, 60 * 60 * 1000); // Saatte bir temizle

module.exports = { cevapla, yerelCevapUret, matematikCoz, birimi };
