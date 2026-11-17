/* =====================================================================
   BABA. — Oyuncu karakteristikleri (PlayStyles / Traits) ve Fiziksel Alt Özellikler
   Traits.of(name, pos, r) → ['FINESSE_SHOT', ...]
   Traits.attrs(name, pos, r) → { pace, dribbling, passing, shooting, defending, physical }
   ===================================================================== */
const Traits = (() => {
  'use strict';
  const LIST = {
    FINESSE_SHOT: [
        "Mohamed Salah",
        "Mason Greenwood",
        "Rafael Leão",
        "Aral Şimşir",
        "Ernest Muçi",
        "Leandro Trossard",
        "İrfan Can Kahveci",
        "Hakim Ziyech",
        "Leroy Sané",
        "Marco Asensio",
        "Yunus Akgün",
        "Kerem Aktürkoğlu",
        "Ricardo Quaresma",
        "Arda Güler",
        "Cengiz Ünder",
        "Edin Višća",
        "Anthony Nwakaeme",
        "Afonso Sousa",
        "Ianis Hagi",
        "Alexandru Maxim"
    ],
    AERIAL_THREAT: [
        "Paul Onuachu",
        "Victor Osimhen",
        "Dušan Vlahović",
        "Franculino",
        "Chibuike Nwaiwu",
        "Romelu Lukaku",
        "Vedat Muriqi",
        "Edin Džeko",
        "Edin Dzeko",
        "Mauro Icardi",
        "Simon Banza",
        "Vincent Aboubakar",
        "Youssef En-Nesyri",
        "Alexander Sørloth",
        "Andreas Cornelius",
        "Bafétimbi Gomis",
        "Demba Ba",
        "Burak Yılmaz",
        "Cenk Tosun",
        "Michy Batshuayi",
        "Mbaye Diagne",
        "Bruno Petković",
        "Eren Tozlu"
    ],
    SPEED_DRIBBLER: [
        "Rafael Leão",
        "Barış Alper Yılmaz",
        "Ernest Poku",
        "Mohamed Salah",
        "Aral Şimşir",
        "Franculino",
        "Mason Greenwood",
        "Dorgeles Nene",
        "Noah Saviolo",
        "Wagner Pina",
        "Sidny Cabral",
        "Wilfried Singo",
        "Jayden Oosterwolde",
        "Rafa Silva",
        "Allan Saint-Maximin",
        "Anthony Nwakaeme",
        "Trézéguet",
        "Trezeguet",
        "Leroy Sané",
        "Adama Traoré",
        "Gift Orban",
        "Nicolas Pépé",
        "Ryan Babel",
        "Henry Onyekuru",
        "Kerem Aktürkoğlu",
        "Jota",
        "Cengiz Ünder",
        "Ermal Krasniqi",
        "Doğukan Sinik",
        "Andreas Skov Olsen"
    ],
    PLAYMAKER: [
        "Orkun Kökçü",
        "Gabriel Sara",
        "Aleksey Batrakov",
        "Fabinho",
        "Ernest Muçi",
        "Fabio Miretti",
        "Mattéo Guendouzi",
        "Arseniy Batagov",
        "Dries Mertens",
        "Dušan Tadić",
        "Muhammed Cham",
        "Gedson Fernandes",
        "Fred",
        "Mesut Özil",
        "İlkay Gündoğan",
        "Hakim Ziyech",
        "Sebastian Szymański",
        "Marco Asensio",
        "Lucas Torreira",
        "Younès Belhanda",
        "Ianis Hagi",
        "Ruslan Malinovskyi",
        "Tolgay Arslan",
        "Sérgio Oliveira",
        "Haris Hajradinović"
    ],
    FREEKICK_MASTER: [
        "Orkun Kökçü",
        "Gabriel Sara",
        "Ernest Muçi",
        "Marco Asensio",
        "Enis Bardhi",
        "Kerem Demirbay",
        "Hakim Ziyech",
        "Ricardo Quaresma",
        "Edin Višća",
        "Dušan Tadić",
        "Mesut Özil",
        "Hakan Çalhanoğlu",
        "Ruslan Malinovskyi",
        "Alexandru Maxim",
        "Ianis Hagi"
    ],
    AGGRESSIVE_TACKLER: [
        "Davinson Sánchez",
        "Chibuike Nwaiwu",
        "Fabinho",
        "Batista Mendy",
        "Emmanuel Agbadou",
        "Lesley Ugochukwu",
        "Mattéo Guendouzi",
        "N'Golo Kanté",
        "Alexander Djiku",
        "Gabriel Paulista",
        "Wilfred Ndidi",
        "Lucas Torreira",
        "Milan Škriniar",
        "Pepe",
        "Gary Medel",
        "Domagoj Vida",
        "Wilfried Singo",
        "Jawad El Yamiq",
        "Christian Luyindama",
        "Nathan Aké"
    ],
    WALL_GK: [
        "Uğurcan Çakır",
        "Ederson",
        "André Onana",
        "Alexander Nübel",
        "Fernando Muslera",
        "Dominik Livaković",
        "Mert Günok",
        "Altay Bayındır",
        "Alban Lafont",
        "Horațiu Moldovan"
    ]
};
  const BY = {}; Object.entries(LIST).forEach(([t, ns]) => ns.forEach(n => (BY[n] = BY[n] || []).push(t)));
  const LABEL = () => {
    const T = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en') ? en : tr;
    return { FINESSE_SHOT: T('Plaseci', 'Finesse shot'), AERIAL_THREAT: T('Hava hakimiyeti', 'Aerial threat'), SPEED_DRIBBLER: T('Patlayıcı hız & çalım', 'Speed dribbler'), PLAYMAKER: T('Oyun kurucu', 'Playmaker'), FREEKICK_MASTER: T('Duran top ustası', 'Free-kick master'), AGGRESSIVE_TACKLER: T('Sert kesici', 'Aggressive tackler'), WALL_GK: T('Panter kaleci', 'Wall keeper') };
  };
  const ICON = { FINESSE_SHOT: '🎯', AERIAL_THREAT: '🗼', SPEED_DRIBBLER: '⚡', PLAYMAKER: '🧠', FREEKICK_MASTER: '🌀', AGGRESSIVE_TACKLER: '🛡️', WALL_GK: '🧤' };
  const h = s => { let x = 2166136261; for (const c of String(s)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return (x >>> 0) % 100; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, Math.round(x)));

  function of(name, pos, r) {
    if (BY[name]) return BY[name].slice();
    const t = [], k = h(name); r = r || 70;
    if (pos === 'KL' && r >= 80) t.push('WALL_GK');
    if (pos === 'FV' && r >= 74 && k < 45) t.push('AERIAL_THREAT');
    if (pos === 'ST' && k < 22) t.push('AERIAL_THREAT');
    if ((pos === 'KN' || pos === 'FV') && r >= 75 && k >= 45 && k < 80) t.push('SPEED_DRIBBLER');
    if (pos === 'KN' && r >= 76 && k >= 80) t.push('FINESSE_SHOT');
    if (pos === 'OS' && r >= 77 && k < 40) t.push('PLAYMAKER');
    if ((pos === 'OS' || pos === 'KN') && r >= 75 && k >= 90) t.push('FREEKICK_MASTER');
    if ((pos === 'ST' || pos === 'OS') && k >= 70 && k < 88) t.push('AGGRESSIVE_TACKLER');
    return t;
  }

  function attrs(name, pos, r) {
    const ovr = r || 70, k = h(name), tr = of(name, pos, ovr);
    const w = {
      KL: { pac: -18, drb: -22, pas: -8, sho: -35, def: +4, phy: +1 },
      ST: { pac: -3, drb: -9, pas: -5, sho: -18, def: +5, phy: +5 },
      BK: { pac: +5, drb: +1, pas: 0, sho: -12, def: +2, phy: +1 },
      OS: { pac: 0, drb: +3, pas: +5, sho: 0, def: 0, phy: 0 },
      KN: { pac: +8, drb: +7, pas: +1, sho: +2, def: -18, phy: -4 },
      FV: { pac: +4, drb: +2, pas: -3, sho: +6, def: -22, phy: +3 }
    }[pos] || { pac: 0, drb: 0, pas: 0, sho: 0, def: 0, phy: 0 };

    return {
      pace: clamp(ovr + w.pac + (k % 9 - 4) + (tr.includes('SPEED_DRIBBLER') ? 7 : 0), 35, 97),
      dribbling: clamp(ovr + w.drb + ((k * 3) % 9 - 4) + (tr.includes('SPEED_DRIBBLER') ? 6 : 0) + (tr.includes('FINESSE_SHOT') ? 3 : 0), 30, 96),
      passing: clamp(ovr + w.pas + ((k * 7) % 9 - 4) + (tr.includes('PLAYMAKER') ? 7 : 0), 35, 95),
      shooting: clamp(ovr + w.sho + ((k * 11) % 9 - 4) + (tr.includes('FINESSE_SHOT') ? 5 : 0), 25, 95),
      defending: clamp(ovr + w.def + ((k * 13) % 9 - 4) + (tr.includes('AGGRESSIVE_TACKLER') ? 6 : 0), 25, 95),
      physical: clamp(ovr + w.phy + ((k * 17) % 9 - 4) + (tr.includes('AERIAL_THREAT') ? 7 : 0), 40, 96)
    };
  }

  return { of, attrs, LIST, LABEL, ICON };
})();
