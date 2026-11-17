/* =====================================================================
   BABA. — 2026-2027 SEZONU VERİTABANI VE LİG GENİŞLEME PAKETİ (v2)
   İçerik:
   - Logaritmik Güç (OVR) ve Piyasa Değeri Ölçeklendirme Formülü
   - TFF 1. Lig (18 Takım), TFF 2. Lig Beyaz Grup (18 Takım), TFF 2. Lig Kırmızı Grup (18 Takım)
   - UEFA Şampiyonlar Ligi (36 Gerçek Kulüp), UEFA Avrupa Ligi (36 Gerçek Kulüp),
     UEFA Konferans Ligi (36 Gerçek Kulüp) — Toplam 108 Gerçek Avrupa Kulübü (Sıfır jenerik takım)
   Not: draft-data.js (419 oyuncu denetimi) bozulmasın diye yalnızca Career tarafından okunur.
   ===================================================================== */
const CAREER_2026_EXPANSION = (() => {
  'use strict';

  // 1. LOGARİTMİK GÜÇ (OVERALL) VE PİYASA DEĞERİ ÖLÇEKLENDİRME FORMÜLÜ
  const TIER_SCALE = {
    UEFA_UCL:       { base: 76, cap: 92, maxMV: 180.0 },
    UEFA_UEL:       { base: 72, cap: 85, maxMV: 60.0 },
    UEFA_UECL:      { base: 67, cap: 80, maxMV: 25.0 },
    TUR_SL:         { base: 68, cap: 88, maxMV: 65.0 },
    TUR_1L:         { base: 60, cap: 73, maxMV: 3.5 },
    TUR_2L_BEYAZ:   { base: 52, cap: 65, maxMV: 0.6 },
    TUR_2L_KIRMIZI: { base: 52, cap: 65, maxMV: 0.6 }
  };

  function calcOvrFromMarketValue(mvMillion, age, leagueKey) {
    const t = TIER_SCALE[leagueKey] || TIER_SCALE.TUR_SL;
    const ratio = Math.log(mvMillion * 1000 + 1) / Math.log(t.maxMV * 1000 + 1);
    let raw = t.base + ratio * (t.cap - t.base);
    if (age >= 32 && mvMillion >= t.maxMV * 0.08) raw += Math.min(5, (age - 31) * 1.3);
    return Math.max(t.base - 3, Math.min(t.cap, Math.round(raw)));
  }

  // 2. ALT LİG VE YENİ YILDIZLAR İÇİN EK DOĞUM TARİHLERİ
  const EXTRA_DOB = {
    "Franculino": "2004-06-28",
    "Rafael Leão": "1999-06-10",
    "El Chadaille Bitshiabu": "2005-05-16",
    "Aleksey Batrakov": "2005-06-09",
    "Deniz Gül": "2004-07-02",
    "Kojo Oppong": "2004-06-04",
    "Fabio Miretti": "2003-08-03",
    "Ernest Poku": "2004-01-28",
    "Ali Habeşoğlu": "2004-07-19",
    "Ahmet Yıldırım": "2006-11-02",
    "Bünyamin Balcı": "2000-05-31",
    "Kenneth Paal": "1997-06-24",
    "Jesper Ceesay": "2001-10-20",
    "Doğukan Sinik": "1999-01-21",
    "Ramzi Safuri": "1995-10-21",
    "Türker Dırdıroğlu": "1996-02-19",
    "Emir Tintiş": "2004-01-12",
    "Naim Dönmez": "2006-04-18",
    "Sami Satılmış": "2004-06-16",
    "Enes Karakuş": "2001-01-03"
  };

  // 3. ALT LİG KADRO ÜRETİCİSİ
  function genSquad(clubShort, baseOvr, spread, stars) {
    const posList = ['KL', 'KL', 'ST', 'ST', 'ST', 'ST', 'BK', 'BK', 'BK', 'BK', 'OS', 'OS', 'OS', 'OS', 'OS', 'KN', 'KN', 'KN', 'FV', 'FV'];
    const fNames = ['Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'İsmail', 'Osman', 'Yusuf', 'Murat', 'Ömer', 'Ramazan', 'Halil', 'Süleyman', 'Abdullah', 'Mahmut', 'Salih', 'Kemal', 'Recep', 'Taha', 'Emir', 'Burak', 'Serkan', 'Gökhan', 'Uğur', 'Volkan', 'Onur', 'Eren', 'Kaan'];
    const lNames = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Özcan', 'Korkmaz', 'Çakır', 'Erdoğan'];
    const out = (stars || []).map(s => [s[0], s[1], s[2], 'FC27']);
    const seen = new Set(out.map(x => x[0]));
    let idx = 0;
    while (out.length < 20) {
      const pos = posList[out.length] || 'OS';
      const fn = fNames[(clubShort.charCodeAt(0) * 7 + idx * 13) % fNames.length];
      const ln = lNames[(clubShort.charCodeAt(1 % clubShort.length) * 11 + idx * 17) % lNames.length];
      const name = `${fn} ${ln}`;
      const fullName = seen.has(name) ? `${name} (${clubShort})` : name;
      seen.add(fullName);
      const r = baseOvr + ((idx * 3) % spread) - Math.floor(spread / 2);
      out.push([fullName, pos, r, 'FC27']);
      idx++;
    }
    return out;
  }

  // 4. TFF 1. LİG VE TFF 2. LİG (BEYAZ & KIRMIZI GRUP) KULÜPLERİ (2026-27)
  const LOWER_LEAGUE_CLUBS = [
    // --- TFF 1. LİG (TUR_1L - 18 Takım) ---
    {
      id: 'ant', name: 'Antalyaspor', short: 'ANT', c1: '#FF0000', c2: '#FFFFFF', league: 'TUR_1L',
      players: genSquad('ANT', 68, 5, [
        ['Abdullah Yiğiter', 'KL', 67], ['Kenneth Paal', 'BK', 71], ['Bünyamin Balcı', 'BK', 71],
        ['Arif Kocaman', 'ST', 68], ['Jesper Ceesay', 'OS', 70], ['Soner Dikmen', 'OS', 68],
        ['Ramzi Safuri', 'OS', 69], ['Doğukan Sinik', 'KN', 70], ['Nuno da Costa', 'FV', 69]
      ])
    },
    { id: 'bod', name: 'Bodrum FK', short: 'BOD', c1: '#008751', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('BOD', 67, 5, [['Gökhan Akkan', 'KL', 69], ['Taylan Antalyalı', 'OS', 69], ['Celal Dumanlı', 'FV', 67]]) },
    { id: 'ank', name: 'MKE Ankaragücü', short: 'ANK', c1: '#00205B', c2: '#FFD100', league: 'TUR_1L', players: genSquad('ANK', 67, 5, [['Ertaç Özbir', 'KL', 68], ['Tolga Ciğerci', 'OS', 70], ['Efkan Bekiroğlu', 'OS', 69]]) },
    { id: 'fkg', name: 'Fatih Karagümrük', short: 'FKG', c1: '#E30613', c2: '#111111', league: 'TUR_1L', players: genSquad('FKG', 67, 5, []) },
    { id: 'sak', name: 'Sakaryaspor', short: 'SAK', c1: '#008751', c2: '#111111', league: 'TUR_1L', players: genSquad('SAK', 66, 5, []) },
    { id: 'ban', name: 'Bandırmaspor', short: 'BAN', c1: '#800020', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('BAN', 65, 5, []) },
    { id: 'man', name: 'Manisa FK', short: 'MAN', c1: '#111111', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('MAN', 64, 5, []) },
    { id: 'bol', name: 'Boluspor', short: 'BOL', c1: '#E30613', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('BOL', 64, 5, []) },
    { id: 'igd', name: 'Iğdır FK', short: 'IĞD', c1: '#008751', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('IĞD', 65, 5, []) },
    { id: 'ero', name: 'Esenler Erokspor', short: 'ERO', c1: '#008751', c2: '#FFD100', league: 'TUR_1L', players: genSquad('ERO', 64, 5, []) },
    { id: 'umr', name: 'Ümraniyespor', short: 'ÜMR', c1: '#E30613', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('ÜMR', 64, 5, []) },
    { id: 'kec', name: 'Keçiörengücü', short: 'KEÇ', c1: '#662D91', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('KEÇ', 64, 5, []) },
    { id: 'pen', name: 'Pendikspor', short: 'PEN', c1: '#E30613', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('PEN', 65, 5, []) },
    { id: 'hat', name: 'Hatayspor', short: 'HAT', c1: '#800020', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('HAT', 66, 5, []) },
    { id: 'ads', name: 'Adana Demirspor', short: 'ADS', c1: '#0038A8', c2: '#5BC2E7', league: 'TUR_1L', players: genSquad('ADS', 63, 5, []) },
    { id: 'siv', name: 'Sivasspor', short: 'SİV', c1: '#E30613', c2: '#FFFFFF', league: 'TUR_1L', players: genSquad('SİV', 66, 5, []) },
    { id: 'kay', name: 'Kayserispor', short: 'KAY', c1: '#E30613', c2: '#FFD100', league: 'TUR_1L', players: genSquad('KAY', 66, 5, [['Bilal Bayazıt', 'KL', 69], ['Gökhan Sazdağı', 'BK', 68]]) },
    { id: 'yma', name: 'Yeni Malatyaspor', short: 'YMS', c1: '#FFD100', c2: '#111111', league: 'TUR_1L', players: genSquad('YMS', 62, 4, []) },

    // --- TFF 2. LİG BEYAZ GRUP (TUR_2L_BEYAZ - 18 Takım) ---
    {
      id: '1461', name: '1461 Trabzon FK', short: '1461', c1: '#800020', c2: '#6CA0DC', league: 'TUR_2L_BEYAZ',
      players: genSquad('1461', 59, 4, [
        ['Türker Dırdıroğlu', 'KL', 59], ['Alperen Kuyubaşı', 'ST', 59], ['Yusuf Örnek', 'ST', 59],
        ['Emir Tintiş', 'BK', 61], ['Zahit Çınar', 'BK', 59], ['Naim Dönmez', 'OS', 63],
        ['Sami Satılmış', 'OS', 62], ['Serhat Polat', 'KN', 60], ['Enes Karakuş', 'FV', 61], ['Yasir Kuduban', 'FV', 59]
      ])
    },
    { id: 'sar', name: 'Sarıyer', short: 'SAR', c1: '#002B5C', c2: '#FFFFFF', league: 'TUR_2L_BEYAZ', players: genSquad('SAR', 61, 4, []) },
    { id: 'bat', name: 'Batman Petrolspor', short: 'BAT', c1: '#E30613', c2: '#FFFFFF', league: 'TUR_2L_BEYAZ', players: genSquad('BAT', 60, 4, []) },
    { id: 'kst', name: 'Kastamonuspor', short: 'KAS', c1: '#E30613', c2: '#111111', league: 'TUR_2L_BEYAZ', players: genSquad('KAS', 60, 4, []) },
    { id: 'ad01', name: 'Adana 01 FK', short: 'A01', c1: '#FFD100', c2: '#111111', league: 'TUR_2L_BEYAZ', players: genSquad('A01', 59, 4, []) },
    { id: 'alt', name: 'Altınordu', short: 'ALT', c1: '#E30613', c2: '#002B5C', league: 'TUR_2L_BEYAZ', players: genSquad('ALT', 59, 5, []) },
    { id: 'isk', name: 'İskenderunspor', short: 'İSK', c1: '#FF671F', c2: '#0038A8', league: 'TUR_2L_BEYAZ', players: genSquad('İSK', 59, 4, []) },
    { id: 'bey', name: 'Beykoz Anadoluspor', short: 'BYK', c1: '#FFD100', c2: '#111111', league: 'TUR_2L_BEYAZ', players: genSquad('BYK', 58, 4, []) },
    { id: 'kkl', name: 'Kırklarelispor', short: 'KRK', c1: '#008751', c2: '#FFFFFF', league: 'TUR_2L_BEYAZ', players: genSquad('KRK', 58, 4, []) },
    { id: 'isp', name: 'Isparta 32 Spor', short: 'ISP', c1: '#008751', c2: '#E94E77', league: 'TUR_2L_BEYAZ', players: genSquad('ISP', 58, 4, []) },
    { id: 'ine', name: 'İnegölspor', short: 'İNG', c1: '#800020', c2: '#FFFFFF', league: 'TUR_2L_BEYAZ', players: genSquad('İNG', 57, 4, []) },
    { id: 'fth', name: 'Fethiyespor', short: 'FET', c1: '#002B5C', c2: '#FFFFFF', league: 'TUR_2L_BEYAZ', players: genSquad('FET', 58, 4, []) },
    { id: 'sin', name: 'Sincan Bld. Ankaraspor', short: 'SİN', c1: '#0072CE', c2: '#FFFFFF', league: 'TUR_2L_BEYAZ', players: genSquad('SİN', 58, 4, []) },
    { id: 'afy', name: 'Afyonspor', short: 'AFY', c1: '#662D91', c2: '#FFFFFF', league: 'TUR_2L_BEYAZ', players: genSquad('AFY', 55, 4, []) },
    { id: 'er24', name: '24 Erzincanspor', short: 'ER24', c1: '#E30613', c2: '#111111', league: 'TUR_2L_BEYAZ', players: genSquad('ER24', 58, 4, []) },
    { id: 'krc', name: 'Karacabey Belediyespor', short: 'KRC', c1: '#0072CE', c2: '#111111', league: 'TUR_2L_BEYAZ', players: genSquad('KRC', 58, 4, []) },
    { id: 'brs', name: 'Bursaspor', short: 'BUR', c1: '#008751', c2: '#FFFFFF', league: 'TUR_2L_BEYAZ', players: genSquad('BUR', 62, 4, [['Muhammet Demir', 'FV', 64]]) },
    { id: 'esk', name: 'Eskişehirspor', short: 'ESK', c1: '#E30613', c2: '#111111', league: 'TUR_2L_BEYAZ', players: genSquad('ESK', 60, 4, []) },

    // --- TFF 2. LİG KIRMIZI GRUP (TUR_2L_KIRMIZI - 18 Takım) ---
    {
      id: 'kep', name: 'Kepezspor FAŞ', short: 'KEP', c1: '#00AEEF', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI',
      players: genSquad('KEP', 57, 4, [['Mehmet Durukan', 'ST', 58], ['Uğurcan Yasin Tabak', 'OS', 58]])
    },
    { id: 'ser', name: 'Serik Belediyespor', short: 'SER', c1: '#008751', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('SER', 61, 4, []) },
    { id: 'aks', name: '68 Aksarayspor', short: 'AKS', c1: '#111111', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('AKS', 60, 4, []) },
    { id: 'ela', name: 'Elazığspor', short: 'ELA', c1: '#800020', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('ELA', 61, 4, []) },
    { id: 'men', name: 'Menemen FK', short: 'MEN', c1: '#FFD100', c2: '#002B5C', league: 'TUR_2L_KIRMIZI', players: genSquad('MEN', 60, 4, []) },
    { id: 'van', name: 'Vanspor FK', short: 'VAN', c1: '#E30613', c2: '#111111', league: 'TUR_2L_KIRMIZI', players: genSquad('VAN', 60, 4, []) },
    { id: 'buc', name: 'Bucaspor 1928', short: 'BUC', c1: '#FFD100', c2: '#002B5C', league: 'TUR_2L_KIRMIZI', players: genSquad('BUC', 59, 4, []) },
    { id: 'krm', name: 'Karaman FK', short: 'KRM', c1: '#E30613', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('KRM', 58, 4, []) },
    { id: 'and', name: 'Ankara Demirspor', short: 'AND', c1: '#002B5C', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('AND', 58, 4, []) },
    { id: 'arn', name: 'Arnavutköy Bld.', short: 'ARN', c1: '#0072CE', c2: '#008751', league: 'TUR_2L_KIRMIZI', players: genSquad('ARN', 58, 4, []) },
    { id: 'erb', name: 'Erbaaspor', short: 'ERB', c1: '#0072CE', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('ERB', 57, 4, []) },
    { id: 'der', name: 'Belediye Derincespor', short: 'DER', c1: '#FFD100', c2: '#002B5C', league: 'TUR_2L_KIRMIZI', players: genSquad('DER', 57, 4, []) },
    { id: 'som', name: 'Somaspor', short: 'SOM', c1: '#111111', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('SOM', 58, 4, []) },
    { id: 'miy', name: 'Yeni Mersin İY', short: 'MİY', c1: '#E30613', c2: '#002B5C', league: 'TUR_2L_KIRMIZI', players: genSquad('MİY', 57, 4, []) },
    { id: 'naz', name: 'Nazillispor', short: 'NAZ', c1: '#111111', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('NAZ', 56, 4, []) },
    { id: 'gir', name: 'Giresunspor', short: 'GİR', c1: '#008751', c2: '#FFFFFF', league: 'TUR_2L_KIRMIZI', players: genSquad('GİR', 56, 4, []) },
    { id: 'diy', name: 'Diyarbekirspor', short: 'DİY', c1: '#008751', c2: '#E30613', league: 'TUR_2L_KIRMIZI', players: genSquad('DİY', 57, 4, []) },
    { id: 'ksk', name: 'Karşıyaka', short: 'KSK', c1: '#008751', c2: '#E30613', league: 'TUR_2L_KIRMIZI', players: genSquad('KSK', 60, 4, []) }
  ];

  // 5. TAM 108 GERÇEK UEFA AVRUPA KULÜBÜ (UCL: 36, UEL: 36, UECL: 36 — SIFIR JENERİK TAKIM)
  const UEFA_CLUBS = [
    // ==================== UEFA ŞAMPİYONLAR LİGİ (UEFA_UCL - 36 Gerçek Kulüp) ====================
    { id: 'mci', name: 'Manchester City', short: 'MCI', country: 'ENG', uefa: 'UEFA_UCL', coef: 148, ovr: 89, c1: '#6CABDD', c2: '#FFFFFF' },
    { id: 'rma', name: 'Real Madrid', short: 'RMA', country: 'ESP', uefa: 'UEFA_UCL', coef: 140, ovr: 89, c1: '#FFFFFF', c2: '#00529F' },
    { id: 'bay', name: 'Bayern Münih', short: 'BAY', country: 'GER', uefa: 'UEFA_UCL', coef: 134, ovr: 87, c1: '#DC052D', c2: '#FFFFFF' },
    { id: 'psg', name: 'Paris Saint-Germain', short: 'PSG', country: 'FRA', uefa: 'UEFA_UCL', coef: 118, ovr: 86, c1: '#004170', c2: '#DA291C' },
    { id: 'liv', name: 'Liverpool', short: 'LIV', country: 'ENG', uefa: 'UEFA_UCL', coef: 116, ovr: 87, c1: '#C8102E', c2: '#FFFFFF' },
    { id: 'int', name: 'Inter', short: 'INT', country: 'ITA', uefa: 'UEFA_UCL', coef: 112, ovr: 86, c1: '#010E80', c2: '#111111' },
    { id: 'bar', name: 'Barcelona', short: 'BAR', country: 'ESP', uefa: 'UEFA_UCL', coef: 104, ovr: 87, c1: '#A50044', c2: '#004D98' },
    { id: 'ars', name: 'Arsenal', short: 'ARS', country: 'ENG', uefa: 'UEFA_UCL', coef: 100, ovr: 86, c1: '#EF0107', c2: '#FFFFFF' },
    { id: 'bvb', name: 'Borussia Dortmund', short: 'BVB', country: 'GER', uefa: 'UEFA_UCL', coef: 97, ovr: 83, c1: '#FDE100', c2: '#111111' },
    { id: 'lev', name: 'Bayer Leverkusen', short: 'B04', country: 'GER', uefa: 'UEFA_UCL', coef: 95, ovr: 84, c1: '#E32221', c2: '#111111' },
    { id: 'atm', name: 'Atlético Madrid', short: 'ATM', country: 'ESP', uefa: 'UEFA_UCL', coef: 92, ovr: 84, c1: '#CB3524', c2: '#FFFFFF' },
    { id: 'rbl', name: 'RB Leipzig', short: 'RBL', country: 'GER', uefa: 'UEFA_UCL', coef: 90, ovr: 82, c1: '#FFFFFF', c2: '#DD0741' },
    { id: 'ata', name: 'Atalanta', short: 'ATA', country: 'ITA', uefa: 'UEFA_UCL', coef: 88, ovr: 83, c1: '#1E71B8', c2: '#111111' },
    { id: 'juv', name: 'Juventus', short: 'JUV', country: 'ITA', uefa: 'UEFA_UCL', coef: 86, ovr: 83, c1: '#111111', c2: '#FFFFFF' },
    { id: 'ben', name: 'Benfica', short: 'SLB', country: 'POR', uefa: 'UEFA_UCL', coef: 85, ovr: 81, c1: '#E30613', c2: '#FFFFFF' },
    { id: 'mil', name: 'AC Milan', short: 'MIL', country: 'ITA', uefa: 'UEFA_UCL', coef: 82, ovr: 83, c1: '#FB090B', c2: '#111111' },
    { id: 'nap', name: 'Napoli', short: 'NAP', country: 'ITA', uefa: 'UEFA_UCL', coef: 80, ovr: 83, c1: '#12A0D7', c2: '#FFFFFF' },
    { id: 'scp', name: 'Sporting CP', short: 'SCP', country: 'POR', uefa: 'UEFA_UCL', coef: 74, ovr: 82, c1: '#008057', c2: '#FFFFFF' },
    { id: 'psv', name: 'PSV Eindhoven', short: 'PSV', country: 'NED', uefa: 'UEFA_UCL', coef: 68, ovr: 80, c1: '#ED1C24', c2: '#FFFFFF' },
    { id: 'fey', name: 'Feyenoord', short: 'FEY', country: 'NED', uefa: 'UEFA_UCL', coef: 64, ovr: 79, c1: '#EE1C25', c2: '#FFFFFF' },
    { id: 'bru', name: 'Club Brugge', short: 'CLB', country: 'BEL', uefa: 'UEFA_UCL', coef: 61, ovr: 78, c1: '#005595', c2: '#111111' },
    { id: 'mon', name: 'AS Monaco', short: 'MON', country: 'FRA', uefa: 'UEFA_UCL', coef: 58, ovr: 80, c1: '#E51B24', c2: '#FFFFFF' },
    { id: 'sha', name: 'Shakhtar Donetsk', short: 'SHA', country: 'UKR', uefa: 'UEFA_UCL', coef: 56, ovr: 76, c1: '#FF6600', c2: '#111111' },
    { id: 'avl', name: 'Aston Villa', short: 'AVL', country: 'ENG', uefa: 'UEFA_UCL', coef: 54, ovr: 82, c1: '#670E36', c2: '#95BFE5' },
    { id: 'lil', name: 'LOSC Lille', short: 'LIL', country: 'FRA', uefa: 'UEFA_UCL', coef: 53, ovr: 79, c1: '#E01E13', c2: '#00193E' },
    { id: 'sal', name: 'RB Salzburg', short: 'SAL', country: 'AUT', uefa: 'UEFA_UCL', coef: 50, ovr: 76, c1: '#FFFFFF', c2: '#E2001A' },
    { id: 'cel', name: 'Celtic', short: 'CEL', country: 'SCO', uefa: 'UEFA_UCL', coef: 48, ovr: 77, c1: '#018749', c2: '#FFFFFF' },
    { id: 'dza', name: 'Dinamo Zagreb', short: 'DZG', country: 'CRO', uefa: 'UEFA_UCL', coef: 47, ovr: 75, c1: '#003399', c2: '#FFFFFF' },
    { id: 'czv', name: 'Kızılyıldız', short: 'CZV', country: 'SRB', uefa: 'UEFA_UCL', coef: 44, ovr: 75, c1: '#E30613', c2: '#FFFFFF' },
    { id: 'yb',  name: 'Young Boys', short: 'YB', country: 'SUI', uefa: 'UEFA_UCL', coef: 41, ovr: 74, c1: '#FFD100', c2: '#111111' },
    { id: 'spa', name: 'Sparta Prag', short: 'SPA', country: 'CZE', uefa: 'UEFA_UCL', coef: 38, ovr: 75, c1: '#A6192E', c2: '#FFFFFF' },
    { id: 'vfb', name: 'VfB Stuttgart', short: 'VFB', country: 'GER', uefa: 'UEFA_UCL', coef: 36, ovr: 80, c1: '#FFFFFF', c2: '#E32219' },
    { id: 'gir_es', name: 'Girona FC', short: 'GIR', country: 'ESP', uefa: 'UEFA_UCL', coef: 34, ovr: 78, c1: '#CE1126', c2: '#FFFFFF' },
    { id: 'bol_it', name: 'Bologna FC', short: 'BOL', country: 'ITA', uefa: 'UEFA_UCL', coef: 33, ovr: 78, c1: '#1A2F48', c2: '#A21C26' },
    { id: 'stu', name: 'Sturm Graz', short: 'STU', country: 'AUT', uefa: 'UEFA_UCL', coef: 31, ovr: 74, c1: '#111111', c2: '#FFFFFF' },
    { id: 'slo', name: 'Slovan Bratislava', short: 'SLO', country: 'SVK', uefa: 'UEFA_UCL', coef: 30, ovr: 73, c1: '#009FE3', c2: '#FFFFFF' },

    // ==================== UEFA AVRUPA LİGİ (UEFA_UEL - 36 Gerçek Kulüp) ====================
    { id: 'mun', name: 'Manchester United', short: 'MUN', country: 'ENG', uefa: 'UEFA_UEL', coef: 92, ovr: 82, c1: '#DA291C', c2: '#FFFFFF' },
    { id: 'rom', name: 'AS Roma', short: 'ROM', country: 'ITA', uefa: 'UEFA_UEL', coef: 90, ovr: 81, c1: '#8E1F2F', c2: '#F0BC42' },
    { id: 'tot', name: 'Tottenham Hotspur', short: 'TOT', country: 'ENG', uefa: 'UEFA_UEL', coef: 84, ovr: 82, c1: '#FFFFFF', c2: '#132257' },
    { id: 'por', name: 'FC Porto', short: 'POR', country: 'POR', uefa: 'UEFA_UEL', coef: 82, ovr: 80, c1: '#00428C', c2: '#FFFFFF' },
    { id: 'fra', name: 'Eintracht Frankfurt', short: 'SGE', country: 'GER', uefa: 'UEFA_UEL', coef: 76, ovr: 79, c1: '#E1000F', c2: '#111111' },
    { id: 'laz', name: 'Lazio', short: 'LAZ', country: 'ITA', uefa: 'UEFA_UEL', coef: 70, ovr: 80, c1: '#87D8F7', c2: '#FFFFFF' },
    { id: 'ajx', name: 'Ajax', short: 'AJX', country: 'NED', uefa: 'UEFA_UEL', coef: 67, ovr: 79, c1: '#D2122E', c2: '#FFFFFF' },
    { id: 'soc', name: 'Real Sociedad', short: 'RSO', country: 'ESP', uefa: 'UEFA_UEL', coef: 65, ovr: 79, c1: '#0067B1', c2: '#FFFFFF' },
    { id: 'vil', name: 'Villarreal CF', short: 'VIL', country: 'ESP', uefa: 'UEFA_UEL', coef: 64, ovr: 80, c1: '#FFE667', c2: '#005187' },
    { id: 'new', name: 'Newcastle United', short: 'NEW', country: 'ENG', uefa: 'UEFA_UEL', coef: 58, ovr: 82, c1: '#111111', c2: '#FFFFFF' },
    { id: 'whu', name: 'West Ham United', short: 'WHU', country: 'ENG', uefa: 'UEFA_UEL', coef: 57, ovr: 79, c1: '#7A263A', c2: '#1BB1E7' },
    { id: 'ran', name: 'Rangers', short: 'RAN', country: 'SCO', uefa: 'UEFA_UEL', coef: 56, ovr: 76, c1: '#1B458F', c2: '#FFFFFF' },
    { id: 'ath', name: 'Athletic Bilbao', short: 'ATH', country: 'ESP', uefa: 'UEFA_UEL', coef: 55, ovr: 80, c1: '#EE2523', c2: '#FFFFFF' },
    { id: 'lyo', name: 'Olympique Lyon', short: 'OL', country: 'FRA', uefa: 'UEFA_UEL', coef: 54, ovr: 79, c1: '#FFFFFF', c2: '#DA020E' },
    { id: 'oly', name: 'Olympiacos', short: 'OLY', country: 'GRE', uefa: 'UEFA_UEL', coef: 54, ovr: 77, c1: '#D91920', c2: '#FFFFFF' },
    { id: 'az',  name: 'AZ Alkmaar', short: 'AZ', country: 'NED', uefa: 'UEFA_UEL', coef: 53, ovr: 77, c1: '#DB0021', c2: '#FFFFFF' },
    { id: 'bra', name: 'SC Braga', short: 'BRA', country: 'POR', uefa: 'UEFA_UEL', coef: 52, ovr: 77, c1: '#D4001A', c2: '#FFFFFF' },
    { id: 'om',  name: 'Olympique Marseille', short: 'OM', country: 'FRA', uefa: 'UEFA_UEL', coef: 51, ovr: 80, c1: '#FFFFFF', c2: '#2FAEE0' },
    { id: 'sla', name: 'Slavia Prag', short: 'SLA', country: 'CZE', uefa: 'UEFA_UEL', coef: 50, ovr: 76, c1: '#E30613', c2: '#FFFFFF' },
    { id: 'pao_k', name: 'PAOK', short: 'PAOK', country: 'GRE', uefa: 'UEFA_UEL', coef: 48, ovr: 76, c1: '#111111', c2: '#FFFFFF' },
    { id: 'fer', name: 'Ferencváros', short: 'FTC', country: 'HUN', uefa: 'UEFA_UEL', coef: 45, ovr: 74, c1: '#008751', c2: '#FFFFFF' },
    { id: 'plz', name: 'Viktoria Plzeň', short: 'PLZ', country: 'CZE', uefa: 'UEFA_UEL', coef: 43, ovr: 75, c1: '#E30613', c2: '#004B9B' },
    { id: 'bod_n', name: 'Bodø/Glimt', short: 'BOD', country: 'NOR', uefa: 'UEFA_UEL', coef: 42, ovr: 75, c1: '#FFD100', c2: '#111111' },
    { id: 'usg', name: 'Union SG', short: 'USG', country: 'BEL', uefa: 'UEFA_UEL', coef: 41, ovr: 75, c1: '#FFD100', c2: '#003399' },
    { id: 'dkv', name: 'Dinamo Kiev', short: 'DKV', country: 'UKR', uefa: 'UEFA_UEL', coef: 40, ovr: 75, c1: '#FFFFFF', c2: '#00529F' },
    { id: 'mid', name: 'FC Midtjylland', short: 'FCM', country: 'DEN', uefa: 'UEFA_UEL', coef: 38, ovr: 75, c1: '#111111', c2: '#E30613' },
    { id: 'mal', name: 'Malmö FF', short: 'MFF', country: 'SWE', uefa: 'UEFA_UEL', coef: 37, ovr: 74, c1: '#6CABDD', c2: '#FFFFFF' },
    { id: 'nic', name: 'OGC Nice', short: 'NIC', country: 'FRA', uefa: 'UEFA_UEL', coef: 36, ovr: 78, c1: '#E30613', c2: '#111111' },
    { id: 'hof', name: 'TSG Hoffenheim', short: 'TSG', country: 'GER', uefa: 'UEFA_UEL', coef: 35, ovr: 77, c1: '#005CA9', c2: '#FFFFFF' },
    { id: 'fre', name: 'SC Freiburg', short: 'SCF', country: 'GER', uefa: 'UEFA_UEL', coef: 35, ovr: 78, c1: '#E30613', c2: '#111111' },
    { id: 'ren', name: 'Stade Rennais', short: 'REN', country: 'FRA', uefa: 'UEFA_UEL', coef: 34, ovr: 77, c1: '#E30613', c2: '#111111' },
    { id: 'twe', name: 'FC Twente', short: 'TWE', country: 'NED', uefa: 'UEFA_UEL', coef: 32, ovr: 75, c1: '#E30613', c2: '#FFFFFF' },
    { id: 'and_b', name: 'RSC Anderlecht', short: 'AND', country: 'BEL', uefa: 'UEFA_UEL', coef: 31, ovr: 75, c1: '#4F2D7F', c2: '#FFFFFF' },
    { id: 'fcs', name: 'FCSB', short: 'FCSB', country: 'ROU', uefa: 'UEFA_UEL', coef: 29, ovr: 73, c1: '#E30613', c2: '#003399' },
    { id: 'qar', name: 'Karabağ FK', short: 'QAR', country: 'AZE', uefa: 'UEFA_UEL', coef: 33, ovr: 74, c1: '#111111', c2: '#FFFFFF' },
    { id: 'lud', name: 'Ludogorets', short: 'LUD', country: 'BUL', uefa: 'UEFA_UEL', coef: 30, ovr: 73, c1: '#008751', c2: '#FFFFFF' },

    // ==================== UEFA KONFERANS LİGİ (UEFA_UECL - 36 Gerçek Kulüp) ====================
    { id: 'che', name: 'Chelsea', short: 'CHE', country: 'ENG', uefa: 'UEFA_UECL', coef: 96, ovr: 84, c1: '#034694', c2: '#FFFFFF' },
    { id: 'fio', name: 'Fiorentina', short: 'FIO', country: 'ITA', uefa: 'UEFA_UECL', coef: 66, ovr: 79, c1: '#482E92', c2: '#FFFFFF' },
    { id: 'bet', name: 'Real Betis', short: 'BET', country: 'ESP', uefa: 'UEFA_UECL', coef: 55, ovr: 79, c1: '#0BB363', c2: '#FFFFFF' },
    { id: 'cph', name: 'FC Copenhagen', short: 'FCK', country: 'DEN', uefa: 'UEFA_UECL', coef: 51, ovr: 75, c1: '#FFFFFF', c2: '#004A99' },
    { id: 'gnt', name: 'KAA Gent', short: 'GNT', country: 'BEL', uefa: 'UEFA_UECL', coef: 47, ovr: 75, c1: '#004B9B', c2: '#FFFFFF' },
    { id: 'bas', name: 'FC Basel', short: 'BAS', country: 'SUI', uefa: 'UEFA_UECL', coef: 44, ovr: 74, c1: '#E30613', c2: '#003399' },
    { id: 'bri', name: 'Brighton & Hove Albion', short: 'BHA', country: 'ENG', uefa: 'UEFA_UECL', coef: 43, ovr: 80, c1: '#0057B8', c2: '#FFFFFF' },
    { id: 'len', name: 'RC Lens', short: 'LEN', country: 'FRA', uefa: 'UEFA_UECL', coef: 42, ovr: 77, c1: '#EC1C24', c2: '#FFF200' },
    { id: 'sev', name: 'Sevilla FC', short: 'SEV', country: 'ESP', uefa: 'UEFA_UECL', coef: 41, ovr: 77, c1: '#FFFFFF', c2: '#D4001A' },
    { id: 'mol', name: 'Molde FK', short: 'MOL', country: 'NOR', uefa: 'UEFA_UECL', coef: 38, ovr: 73, c1: '#00529F', c2: '#FFFFFF' },
    { id: 'lsk', name: 'LASK Linz', short: 'LASK', country: 'AUT', uefa: 'UEFA_UECL', coef: 37, ovr: 73, c1: '#111111', c2: '#FFFFFF' },
    { id: 'djg', name: 'Djurgårdens IF', short: 'DIF', country: 'SWE', uefa: 'UEFA_UECL', coef: 36, ovr: 72, c1: '#002B5C', c2: '#6CABDD' },
    { id: 'leg', name: 'Legia Varşova', short: 'LEG', country: 'POL', uefa: 'UEFA_UECL', coef: 35, ovr: 74, c1: '#FFFFFF', c2: '#006837' },
    { id: 'pao', name: 'Panathinaikos', short: 'PAO', country: 'GRE', uefa: 'UEFA_UECL', coef: 34, ovr: 75, c1: '#007934', c2: '#FFFFFF' },
    { id: 'hei', name: '1. FC Heidenheim', short: 'HDH', country: 'GER', uefa: 'UEFA_UECL', coef: 32, ovr: 75, c1: '#E2001A', c2: '#003D7C' },
    { id: 'vit', name: 'Vitória Guimarães', short: 'VIT', country: 'POR', uefa: 'UEFA_UECL', coef: 32, ovr: 75, c1: '#FFFFFF', c2: '#111111' },
    { id: 'rap', name: 'Rapid Wien', short: 'RAP', country: 'AUT', uefa: 'UEFA_UECL', coef: 31, ovr: 73, c1: '#008751', c2: '#FFFFFF' },
    { id: 'apo', name: 'APOEL Nicosia', short: 'APO', country: 'CYP', uefa: 'UEFA_UECL', coef: 30, ovr: 72, c1: '#FFD100', c2: '#003399' },
    { id: 'omo', name: 'Omonia Nicosia', short: 'OMO', country: 'CYP', uefa: 'UEFA_UECL', coef: 28, ovr: 72, c1: '#008751', c2: '#FFFFFF' },
    { id: 'olj', name: 'Olimpija Ljubljana', short: 'OLI', country: 'SVN', uefa: 'UEFA_UECL', coef: 27, ovr: 71, c1: '#008751', c2: '#FFFFFF' },
    { id: 'lug', name: 'FC Lugano', short: 'LUG', country: 'SUI', uefa: 'UEFA_UECL', coef: 27, ovr: 72, c1: '#111111', c2: '#FFFFFF' },
    { id: 'stg', name: 'FC St. Gallen', short: 'STG', country: 'SUI', uefa: 'UEFA_UECL', coef: 26, ovr: 72, c1: '#008751', c2: '#FFFFFF' },
    { id: 'ser_g', name: 'Servette FC', short: 'SER', country: 'SUI', uefa: 'UEFA_UECL', coef: 26, ovr: 72, c1: '#800020', c2: '#FFFFFF' },
    { id: 'hrt', name: 'Heart of Midlothian', short: 'HRT', country: 'SCO', uefa: 'UEFA_UECL', coef: 25, ovr: 72, c1: '#800020', c2: '#FFFFFF' },
    { id: 'cer', name: 'Cercle Brugge', short: 'CER', country: 'BEL', uefa: 'UEFA_UECL', coef: 25, ovr: 72, c1: '#008751', c2: '#111111' },
    { id: 'jag', name: 'Jagiellonia Białystok', short: 'JAG', country: 'POL', uefa: 'UEFA_UECL', coef: 24, ovr: 72, c1: '#FFD100', c2: '#E30613' },
    { id: 'lch', name: 'Lech Poznań', short: 'LPO', country: 'POL', uefa: 'UEFA_UECL', coef: 28, ovr: 73, c1: '#00529F', c2: '#FFFFFF' },
    { id: 'ast', name: 'FC Astana', short: 'AST', country: 'KAZ', uefa: 'UEFA_UECL', coef: 24, ovr: 71, c1: '#6CABDD', c2: '#FFD100' },
    { id: 'hjk', name: 'HJK Helsinki', short: 'HJK', country: 'FIN', uefa: 'UEFA_UECL', coef: 23, ovr: 70, c1: '#00529F', c2: '#FFFFFF' },
    { id: 'sha_r', name: 'Shamrock Rovers', short: 'SHM', country: 'IRL', uefa: 'UEFA_UECL', coef: 22, ovr: 69, c1: '#008751', c2: '#FFFFFF' },
    { id: 'tsc', name: 'TSC Bačka Topola', short: 'TSC', country: 'SRB', uefa: 'UEFA_UECL', coef: 21, ovr: 70, c1: '#003399', c2: '#FFFFFF' },
    { id: 'bor_b', name: 'Borac Banja Luka', short: 'BOR', country: 'BIH', uefa: 'UEFA_UECL', coef: 20, ovr: 69, c1: '#E30613', c2: '#003399' },
    { id: 'cel_s', name: 'NK Celje', short: 'CEL', country: 'SVN', uefa: 'UEFA_UECL', coef: 20, ovr: 70, c1: '#FFD100', c2: '#003399' },
    { id: 'paf', name: 'Pafos FC', short: 'PAF', country: 'CYP', uefa: 'UEFA_UECL', coef: 21, ovr: 72, c1: '#00529F', c2: '#FFFFFF' },
    { id: 'brn', name: 'SK Brann', short: 'BRN', country: 'NOR', uefa: 'UEFA_UECL', coef: 22, ovr: 72, c1: '#E30613', c2: '#FFFFFF' },
    { id: 'str_f', name: 'RC Strasbourg', short: 'RCSA', country: 'FRA', uefa: 'UEFA_UECL', coef: 29, ovr: 76, c1: '#00529F', c2: '#FFFFFF' }
  ];

  // Süper Lig (DRAFT_CLUBS) + Alt Lig kulüplerini birleştiren yardımcı fonksiyon
  function getAllCareerClubs() {
    const base = (typeof DRAFT_CLUBS !== 'undefined' ? DRAFT_CLUBS : []).map(c => Object.assign({}, c, {
      league: c.league || 'TUR_SL',
      uefa: c.uefa || (c.id === 'gs' || c.id === 'fb' ? 'UEFA_UCL' : c.id === 'ts' ? 'UEFA_UEL' : c.id === 'bjk' || c.id === 'ibfk' || c.id === 'sam' ? 'UEFA_UECL' : null)
    }));
    const existingIds = new Set(base.map(c => c.id));
    LOWER_LEAGUE_CLUBS.forEach(low => {
      if (!existingIds.has(low.id)) base.push(low);
    });
    return base;
  }

  return {
    TIER_SCALE,
    calcOvrFromMarketValue,
    EXTRA_DOB,
    LOWER_LEAGUE_CLUBS,
    UEFA_CLUBS,
    getAllCareerClubs,
    genSquad
  };
})();
