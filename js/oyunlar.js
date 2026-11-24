"use strict";
/* =====================================================================
   BABA. — OYUN KÜTÜPHANESİ (#oyunlar)
   Hero video · kayan şeritler · öne çıkan oyun vitrini · filtrelenebilir kütüphane ·
   kategori karoları · skor çağrısı. Tüm hareketler prefers-reduced-motion'a uyar.
   ===================================================================== */
const BABALibrary = (() => {
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const IMPORTED_ARCADE = new Set(["age-of-war","gunblood","warfare-1917","the-waitress","fancy-pants-3","territory-war","electric-man-2","wild-ones-world","rota-conference","runaway-cheese","sis-hatti"]);
  const COVER = (id, w) => IMPORTED_ARCADE.has(id) ? `img/library/${id}-1280.svg` : `img/library/${id}-${w}.webp`;
  const SRCSET = id => IMPORTED_ARCADE.has(id) ? `${COVER(id, 1280)} 1280w` : `${COVER(id, 640)} 640w, ${COVER(id, 1280)} 1280w, ${COVER(id, 1920)} 1920w`;

  // Kategori ve kısa tanıtım metinleri (kart, vitrin ve şeritler)
  const META = {
    'hayat-oyunu': { cat: 'sim', accent: '#ff8a5c', time: ['Uzun soluklu', 'Long-form'], blurb: ['Doğumdan emekliliğe kendi hayatını kur: kariyer, ilişkiler, sağlık ve seçimler.', 'Build a life from birth to retirement: career, relationships, health and choices.'] },
    futbol: { cat: 'foot', accent: '#c8ff3a', time: ['2 mod', '2 modes'], blurb: ['Draft mı kariyer mi? Tarafını seç, kadronu kur, sahaya çık.', 'Draft or career? Pick your side, build a squad, take the pitch.'] },
    career: { cat: 'foot', accent: '#3de0c8', time: ['Sezonluk', 'Season-long'], blurb: ['Kulübü devral: transfer pazarlığı, antrenman, devre arası konuşması ve canlı 2D maç.', 'Take over a club: transfer talks, training, half-time talks and live 2D matches.'] },
    draft: { cat: 'foot', accent: '#c8ff3a', time: ['10 dk', '10 min'], blurb: ['Çark döner, 18 Süper Lig kulübünün son 10 yılından 11+2 kur ve 34 maçlık sezonu izle.', 'Spin the wheel, build an 11+2 from 18 Süper Lig clubs’ last decade and watch a 34-game season.'] },
    istiklal1919: { cat: 'str', accent: '#e9c46a', time: ['Sefer', 'Campaign'], blurb: ['1919–1923: cepheler, diplomasi ve kaynak yönetimiyle tarihsel strateji.', '1919–1923: fronts, diplomacy and resources in a historical strategy game.'] },
    vadi: { cat: 'str', accent: '#7fd36b', time: ['3 bölüm', '3 chapters'], blurb: ['Vadide şehrini kur, kaynakları yönet ve üç bölümlük seferi tamamla.', 'Build your city in the valley, manage resources and finish a three-chapter campaign.'] },
    'rota-conference': { cat: 'sim', accent: '#0aa99f', time: ['15–20 dk', '15–20 min'], isNew: true, blurb: ['45 kişilik uluslararası konferansı yönet: teklif, otel, ekip, dört kriz ve gerçek kâr hesabı.', 'Run a conference for 45 guests: bidding, hotels, staff, four crises and a real profit breakdown.'] },
    'dsan-shipyard': { cat: 'sim', accent: '#3db7ff', time: ['3D yönetim', '3D management'], isNew: true, blurb: ['Antalya’da 3D tersane: sekiz tekne, deniz denemesi, İK görüşmeleri ve müşteri ziyaretleri.', 'A 3D shipyard in Antalya: eight vessels, sea trials, HR interviews and client visits.'] },
    'runaway-cheese': { cat: 'arc', accent: '#ffdb4d', time: ['3D kovalamaca', '3D chase'], isNew: true, blurb: ['Peynir tekerleği ol, yokuştan yuvarlan; çitlerden, kütüklerden ve peşindeki koşuculardan kaç.', 'Roll a cheese wheel downhill and dodge logs, rocks and the hilarious crowd chasing behind.'] },
    'sis-hatti': { cat: 'arc', accent: '#d3ab79', time: ['Hikâye RPG', 'Story RPG'], isNew: true, blurb: ['02:17’de kaybolan bir yolcu, sisli liman, gizemli telsiz: keşfet, ipuçlarını birleştir ve farklı sonlara ulaş.', 'A missing passenger, foggy harbor and midnight radio. Investigate, solve clues and discover multiple endings.'] },
    'yayla-savunmasi': { cat: 'str', accent: '#9fc36a', time: ['10 dalga', '10 waves'], isNew: true, blurb: ['Zigana dağları, Uzungöl ve ladin ormanları arasında 3D kule savunma; ışığı gerçek yayla fotoğraflarına göre ölçülüp ayarlanmış.', '3D tower defense among the Zigana peaks, a highland lake and spruce forests, lit to match real Black Sea highland photos.'] },
    '2048': { cat: 'puz', accent: '#ffb547', time: ['5 dk', '5 min'], blurb: ['Kaydır, birleştir, 2048’e ulaş. Kısa molaların klasiği.', 'Swipe, merge, reach 2048. The short-break classic.'] },
    sudoku: { cat: 'puz', accent: '#8b9bff', time: ['3 seviye', '3 levels'], blurb: ['Kolaydan zora üç seviye; temiz bir kafa ve bir fincan kahve.', 'Three levels from easy to hard; a clear head and a cup of coffee.'] },
    mines: { cat: 'puz', accent: '#ff5c7a', time: ['Klasik', 'Classic'], blurb: ['Sayıları oku, bayrakları dik, mayına basmadan alanı temizle.', 'Read the numbers, plant the flags, clear the field without a blast.'] },
    'kafa-topu': { cat: 'foot', accent: '#c8ff3a', time: ['Süper Lig', 'Süper Lig'], isNew: true, blurb: ['Sports Heads mekaniğiyle Süper Lig kafa futbolu: 8 takım, güçlendirmeler, kupa ve 2 kişilik mod.', 'Sports Heads style Süper Lig football: 8 teams, power-ups, championship cup and 2-player mode.'] },
    'age-of-war': { cat: 'str', accent: '#f8b84e', time: ["5 çağ","5 eras"], isNew: true, blurb: ["Taş Devri'nden geleceğe yüksel, üssünü savun ve asker üret.","Advance from the Stone Age to the future, defend your base and deploy units."] },
    'gunblood': { cat: 'arc', accent: '#e9954f', time: ["Düello","Duel"], isNew: true, blurb: ["Reflekslerini test et: hızlı silah çekme ve fizik tabanlı western düelloları.","Test your reflexes in physics-based quick-draw western duels."] },
    'warfare-1917': { cat: 'str', accent: '#c0bb7d', time: ["1917","1917"], isNew: true, blurb: ["Siperlere asker ve tank gönder, topçuyla cepheyi ilerlet.","Command trench infantry, tanks and artillery on the 1917 front."] },
    'the-waitress': { cat: 'sim', accent: '#ffb6a0', time: ["Kafe","Cafe"], isNew: true, blurb: ["Müşterilerin siparişlerini al, mutfağı ve servisi yönet.","Take orders, run the kitchen and serve customers in a retro cafe."] },
    'fancy-pants-3': { cat: 'arc', accent: '#ffb955', time: ["Platform","Platform"], isNew: true, blurb: ["Hızlı hareket, kayma ve duvar zıplamasıyla el çizimi dünyayı keşfet.","Dash, slide and wall-jump across a hand-drawn platform world."] },
    'territory-war': { cat: 'str', accent: '#a1d5ff', time: ["4v4","4v4"], isNew: true, blurb: ["Dört kişilik takımı yönet, sıra tabanlı taktiklerle rakibi yen.","Command a four-person team in turn-based tactical battles."] },
    'electric-man-2': { cat: 'arc', accent: '#aaf6fe', time: ["Arena","Arena"], isNew: true, blurb: ["Arena rakiplerini döv, elektrikli ağır çekim saldırılarını kullan.","Fight arena opponents with slow-motion electric super attacks."] },
    'wild-ones-world': { cat: 'arc', accent: '#b9f57a', time: ["Dünya","World"], isNew: true, blurb: ["Wild Ones'un genişletilmiş dünya haritalı, çok karakterli sürümü.","A larger Wild Ones edition with world maps and more characters."] },
    'yilan-arenasi': { cat: 'arc', accent: '#3de0ff', time: ['Arena', 'Arena'], isNew: true, blurb: ['Slither.io tarzı neon yılan arenası: enerji küreleriyle büyü, hızlanıp rakiplerini kes ve zirveye çık.', 'Slither.io style neon snake arena: grow with glowing orbs, boost to cut off rivals and top the board.'] },
    'gta-vice-city': { cat: 'arc', accent: '#ff5cc8', time: ['Klasik', 'Classic'], isNew: true, blurb: ['80’ler Vice City atmosferinde klasik aksiyon deneyimine doğrudan bağlantı.', 'Direct launch into the classic 80s Vice City action experience.'] },
    'tekken-3': { cat: 'arc', accent: '#ff9f43', time: ['Dövüş', 'Fighting'], isNew: true, blurb: ['Efsanevi arcade dövüş turnuvası Tekken 3’e doğrudan bağlantı.', 'Direct launch into the legendary Tekken 3 arcade fighting tournament.'] },
    'hungry-shark': { cat: 'arc', accent: '#3de0ff', time: ['Arcade', 'Arcade'], isNew: true, blurb: ['Okyanusu avla, yedikçe büyü, Altın Hücumu’nu tetikle ve derinliklerin zirve yırtıcısı ol.', 'Hunt the ocean, grow as you eat, trigger Gold Rush and become the apex predator of the deep.'] },
    blocks: { cat: 'arc', accent: '#b07cff', time: ['Arcade', 'Arcade'], blurb: ['Düşen blokları yerleştir, satırları temizle, hızlandıkça dayan.', 'Drop the blocks, clear the lines, hold on as it speeds up.'] }
  };
  const CATS = [
    { id: 'all', tr: 'Tümü', en: 'All' }, { id: 'foot', tr: 'Futbol', en: 'Football' }, { id: 'str', tr: 'Strateji', en: 'Strategy' },
    { id: 'sim', tr: 'Simülasyon', en: 'Simulation' }, { id: 'puz', tr: 'Bulmaca', en: 'Puzzle' }, { id: 'arc', tr: 'Arcade', en: 'Arcade' }, { id: 'web', tr: 'Web Oyunları', en: 'Web Games' }
  ];
  const SPOTLIGHT = ['yayla-savunmasi', 'sis-hatti', 'runaway-cheese', 'rota-conference', 'kafa-topu', 'hungry-shark', 'yilan-arenasi', 'age-of-war', 'wild-ones-world', 'dsan-shipyard'];
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const icon = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const I = { play: 'M7 4.5v15l12.5-7.5z', pause: 'M8 5v14M16 5v14', arrow: 'M7 17L17 7M9 7h8v8', down: 'M12 5v14M6 13l6 6 6-6', search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3', trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 6h3a3 3 0 01-3 4M7 6H4a3 3 0 003 4', spark: 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z', clock: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z', prev: 'M15 6l-6 6 6 6', next: 'M9 6l6 6-6 6' };

  function render(o) {
    const { root, games, isExternal, T, esc, P, isOwner, covers } = o;
    const localGames = games.filter(g => !isExternal(g.id));
    const featured = SPOTLIGHT.filter(id => !isExternal(id));
    const L = id => games.find(g => g.id === id);
    const m = id => ({ ...(META[id] || { cat: 'arc', accent: '#c8ff3a', time: ['', ''], blurb: ['', ''] }), ...(isExternal(id) ? { cat: 'web' } : {}) });
    const name = g => P(g.name), bl = id => T(...m(id).blurb), tags = g => g.tags.map(t => P(t));
    const coverOf = id => (covers && covers[id]) || COVER(id, 1280);
    const last = ls.get('baba_last_game', null), lastG = last && !isExternal(last.id) && L(last.id);
    const catCount = id => id === 'all' ? localGames.length : games.filter(g => m(g.id).cat === id).length;
    const date = new Date().toLocaleDateString((typeof I18N !== 'undefined' && I18N.locale) || 'tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    const band = (dir) => `<div class="lb-band ${dir}" aria-hidden="true"><div class="lb-band-track">${[0, 1].map(() => localGames.map(g => `<span>${esc(name(g))}</span><i>${icon(I.spark)}</i>`).join('')).join('')}</div></div>`;

    const card = (g, i) => {
      const mm = m(g.id), best = (() => { try { return g.best(); } catch (e) { return '—'; } })();
      return `<a class="lb-card${mm.cat === 'web' ? ' lb-hide' : ''}" href="#${g.id}" data-id="${g.id}" data-cat="${mm.cat}" data-name="${esc((name(g) + ' ' + tags(g).join(' ')).toLocaleLowerCase('tr-TR'))}" data-i="${i}" style="--acc:${mm.accent};--d:${(i % 8) * 60}ms">
        <div class="lb-cover">
          <div class="card-art card-art-cover" data-game-cover="${g.id}"><img src="${esc(coverOf(g.id))}" ${covers && covers[g.id] && covers[g.id].indexOf('img/library/') !== 0 ? '' : `srcset="${SRCSET(g.id)}" sizes="(max-width:640px) 92vw, (max-width:1100px) 46vw, 30vw"`} alt="${esc(name(g))}" loading="lazy" decoding="async"></div>
          <span class="lb-shine" aria-hidden="true"></span>
          <span class="lb-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          ${mm.isNew ? `<span class="lb-sticker">${T('YENİ', 'NEW')}</span>` : ''}
          <span class="lb-playbtn" aria-hidden="true">${icon(I.play)}</span>
        </div>
        <div class="lb-body">
          <div class="lb-row"><span class="lb-cat">${T(...[CATS.find(c => c.id === mm.cat)].map(c => [c.tr, c.en])[0])}</span><span class="lb-time">${icon(I.clock)}${esc(T(...mm.time))}</span></div>
          <h3>${esc(name(g))}</h3>
          <p>${esc(bl(g.id))}</p>
          <div class="lb-tags">${tags(g).map(t => `<span>${esc(t)}</span>`).join('')}<b>${icon(I.trophy)}${esc(String(best))}</b></div>
        </div></a>`;
    };
    const slide = (id, i) => { const g = L(id); if (!g) return ''; const mm = m(id);
      return `<article class="lb-slide${i ? '' : ' on'}" data-k="${i}" style="--acc:${mm.accent}" aria-hidden="${i ? 'true' : 'false'}">
        <img class="lb-slide-img" src="${COVER(id, 1280)}" srcset="${SRCSET(id)}" sizes="100vw" alt="" loading="${i ? 'lazy' : 'eager'}" decoding="async">
        <div class="lb-slide-shade"></div>
        <div class="lb-slide-txt"><span class="lb-badge">${String(i + 1).padStart(2, '0')} / ${String(featured.length).padStart(2, '0')} · ${T('Öne çıkan', 'Featured')}</span>
          <h3>${esc(name(g))}</h3><p>${esc(bl(id))}</p>
          <div class="lb-tags light">${tags(g).map(t => `<span>${esc(t)}</span>`).join('')}</div>
          <a class="lb-btn pri" href="#${id}" tabindex="${i ? -1 : 0}">${icon(I.play)} ${T('Şimdi oyna', 'Play now')}</a></div></article>`; };

    root.innerHTML = `<div class="lb">
      <section class="lb-hero" aria-labelledby="lbTitle">
        <div class="lb-media" aria-hidden="true"><img class="lb-poster" src="img/library/hero-1920.webp" srcset="img/library/hero-960.webp 960w, img/library/hero-1920.webp 1920w, img/library/hero-2560.webp 2560w" sizes="100vw" alt=""><video class="lb-vid" muted loop playsinline preload="none" poster="img/library/hero-2560.webp"></video></div>
        <div class="lb-shade" aria-hidden="true"></div><div class="lb-spot" aria-hidden="true"></div><div class="lb-grain" aria-hidden="true"></div>
        <div class="lb-hero-in">
          <p class="lb-kicker"><span class="lb-live"></span>${T('BABA. Oyun Kütüphanesi', 'BABA. Game Library')} · ${esc(date)}</p>
          <h1 class="lb-title" id="lbTitle"><span class="w"><b>${T('Oyna.', 'Play.')}</b></span><span class="w"><b>${T('Kur.', 'Build.')}</b></span><span class="w em"><b>${T('Kazan.', 'Win.')}</b></span></h1>
          <p class="lb-lead">${T(`${games.length} oyun, sıfır reklam. Süper Lig draftından 3D tersane yönetimine, 1919 stratejisinden kısa bulmacalara kadar el seçimi bir koleksiyon.`, `${games.length} games, zero adverts. From a Süper Lig draft to 3D shipyard management, from 1919 strategy to quick puzzles — a hand-picked collection.`)}</p>
          <div class="lb-ctas">
            <a class="lb-btn pri" href="#${lastG ? lastG.id : 'futbol'}">${icon(I.play)} ${lastG ? T('Devam et', 'Continue') + ': ' + esc(name(lastG)) : T('Oynamaya başla', 'Start playing')}</a>
            <a class="lb-btn ghost" href="#lbLibrary" data-jump="lbLibrary">${T('Kütüphaneye göz at', 'Browse the library')} ${icon(I.down)}</a>
          </div>
          <dl class="lb-stats">
            <div><dt>${T('Oyun', 'Games')}</dt><dd data-count="${games.length}">${games.length}</dd></div>
            <div><dt>${T('Kategori', 'Categories')}</dt><dd data-count="${CATS.length - 1}">${CATS.length - 1}</dd></div>
            <div><dt>${T('Reklam', 'Adverts')}</dt><dd>0</dd></div>
            <div><dt>${T('Tarayıcıda', 'In browser')}</dt><dd>%100</dd></div>
          </dl>
        </div>
        ${lastG ? `<a class="lb-continue" href="#${lastG.id}"><img src="${COVER(lastG.id, 640)}" alt="" loading="lazy"><span><small>${T('Son oynadığın', 'Last played')}</small><b>${esc(name(lastG))}</b></span>${icon(I.play)}</a>` : ''}
        <button type="button" class="lb-vidctl" aria-pressed="false" aria-label="${T('Arka plan videosunu duraklat', 'Pause background video')}">${icon(I.pause)}</button>
        <a class="lb-scrollcue" href="#lbLibrary" data-jump="lbLibrary" aria-label="${T('Aşağı kaydır', 'Scroll down')}"><span></span></a>
      </section>

      <nav class="lb-subnav" aria-label="${T('Kütüphane menüsü', 'Library menu')}">
        <div class="lb-subnav-in">
          <b class="lb-brand">${T('Kütüphane', 'Library')}<i>.</i></b>
          <a href="#lbFeatured" data-jump="lbFeatured">${T('Öne çıkanlar', 'Featured')}</a>
          <a href="#lbLibrary" data-jump="lbLibrary">${T('Tüm oyunlar', 'All games')}</a>
          <a href="#lbCats" data-jump="lbCats">${T('Kategoriler', 'Categories')}</a>
          <a href="#skor">${T('Skor tablosu', 'Leaderboard')}</a>
          <label class="lb-search">${icon(I.search)}<input type="search" placeholder="${T('Oyun ara…', 'Search games…')}" aria-label="${T('Oyun ara', 'Search games')}"></label>
        </div>
      </nav>

      ${band('l')}${band('r')}

      <section class="lb-feat" id="lbFeatured" aria-roledescription="carousel" aria-label="${T('Öne çıkan oyunlar', 'Featured games')}">
        <header class="lb-sec-head"><p class="lb-eyebrow">${T('Vitrin', 'Spotlight')}</p><h2>${T('Bu hafta <em>sahnede</em>', 'On stage <em>this week</em>')}</h2>
          <div class="lb-feat-ctl"><button type="button" data-f="prev" aria-label="${T('Önceki', 'Previous')}">${icon(I.prev)}</button><button type="button" data-f="next" aria-label="${T('Sonraki', 'Next')}">${icon(I.next)}</button></div></header>
        <div class="lb-stage">${featured.map(slide).join('')}
          <div class="lb-dots" role="tablist">${featured.map((id, i) => `<button type="button" role="tab" data-k="${i}" aria-label="${esc(name(L(id)))}" aria-selected="${i ? 'false' : 'true'}"><i></i></button>`).join('')}</div></div>
      </section>

      <section class="lb-lib" id="lbLibrary">
        <header class="lb-sec-head"><p class="lb-eyebrow">${T('Koleksiyon', 'Collection')}</p><h2>${T('Tüm <em>oyunlar</em>', 'All <em>games</em>')}</h2>
          <div class="bb-cover-toolbar lb-tools"><span class="lb-count" aria-live="polite"><b>${localGames.length}</b> ${T('oyun', 'games')}</span>
            <label class="lb-sort">${T('Sırala', 'Sort')}<select aria-label="${T('Sırala', 'Sort')}"><option value="rec">${T('Önerilen', 'Recommended')}</option><option value="az">A–Z</option><option value="last">${T('Son oynanan', 'Recently played')}</option></select></label>
            ${isOwner() ? `<button type="button" id="bbCoverEditToggle" class="bb-cover-edit-toggle" aria-controls="bbCoverEditor" aria-expanded="false">✎ ${T('Kapakları Düzenle', 'Edit covers')}</button>` : ''}</div></header>
        <div class="lb-filters" role="toolbar" aria-label="${T('Kategori filtresi', 'Category filter')}">${CATS.map((c, i) => `<button type="button" data-cat="${c.id}" aria-pressed="${i ? 'false' : 'true'}">${T(c.tr, c.en)}<small>${catCount(c.id)}</small></button>`).join('')}</div>
        ${isOwner() ? '<section id="bbCoverEditor" class="bb-cover-editor" hidden></section>' : ''}
        <div class="lb-grid cards">${games.map(card).join('')}</div>
        <p class="lb-empty" hidden>${T('Bu aramaya uyan oyun yok.', 'No games match this search.')}</p>
      </section>

      <section class="lb-cats" id="lbCats">
        <header class="lb-sec-head"><p class="lb-eyebrow">${T('Ruh haline göre', 'By mood')}</p><h2>${T('Ne <em>oynasak?</em>', 'What shall we <em>play?</em>')}</h2></header>
        <div class="lb-cat-grid">${CATS.slice(1).map(c => { const first = games.find(g => m(g.id).cat === c.id); return `<button type="button" class="lb-cat-tile" data-pick="${c.id}" data-img="${first ? COVER(first.id, 640) : ''}"><span class="lb-cat-n">${catCount(c.id)}</span><b>${T(c.tr, c.en)}</b><i>${icon(I.arrow)}</i></button>`; }).join('')}</div>
      </section>

      <a class="lb-score" href="#skor"><span class="lb-trophy">${icon(I.trophy)}</span><span><small>${T('Aile skor tablosu', 'Family leaderboard')}</small><b>${T('Haftanın şampiyonu kim?', 'Who’s champion this week?')}</b><em>${T('Rekorlar ve Draft düellosu', 'Records and the Draft duel')}</em></span><i>${icon(I.arrow)}</i></a>
    </div>`;

    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    const offs = [];
    const on = (el, ev, f, opt) => { el.addEventListener(ev, f, opt); offs.push(() => el.removeEventListener(ev, f, opt)); };
    const RM = reduce();
    document.body.classList.add('lib-mode');
    offs.push(() => document.body.classList.remove('lib-mode', 'lb-solid'));
    const nav = document.querySelector('body > .nav');
    const setNavH = () => document.documentElement.style.setProperty('--lb-navh', (nav ? nav.offsetHeight : 64) + 'px');
    setNavH(); on(window, 'resize', setNavH);

    // ---- Hero video: ekran boyutuna göre kaynak; azaltılmış hareket/veri tasarrufunda poster ----
    const vid = $('.lb-vid'), hero = $('.lb-hero'), ctl = $('.lb-vidctl');
    const saveData = navigator.connection && navigator.connection.saveData;
    let userPaused = ls.get('baba_lib_video_paused', false);
    const setCtl = () => { const p = vid.paused; ctl.innerHTML = icon(p ? I.play : I.pause); ctl.setAttribute('aria-pressed', String(p)); ctl.setAttribute('aria-label', p ? T('Arka plan videosunu oynat', 'Play background video') : T('Arka plan videosunu duraklat', 'Pause background video')); };
    if (!RM && !saveData) {
      // Ekranın gerçek piksel genişliğine göre en uygun kalite (720p → 4K)
      const px = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(window.devicePixelRatio || 1, 3);
      const net = navigator.connection && navigator.connection.effectiveType;
      const slow = net && /(^|-)2g|3g/.test(net);
      const phone = innerWidth <= 900;
      vid.src = slow ? 'media/oyunlar-hero-720.mp4' : phone ? 'media/oyunlar-hero-1080.mp4' : px <= 1300 ? 'media/oyunlar-hero-720.mp4' : px <= 1950 ? 'media/oyunlar-hero-1080.mp4' : px <= 2700 ? 'media/oyunlar-hero-1440.mp4' : 'media/oyunlar-hero-2160.mp4';
      vid.addEventListener('playing', () => hero.classList.add('vid-on'), { once: true });
      if (!userPaused) vid.play().catch(() => {});
    } else { userPaused = true; }
    vid.addEventListener('play', setCtl); vid.addEventListener('pause', setCtl); setCtl();
    on(ctl, 'click', () => { if (!vid.src) { vid.src = 'media/oyunlar-hero-720.mp4'; } if (vid.paused) { vid.play().catch(() => {}); userPaused = false; } else { vid.pause(); userPaused = true; } ls.set('baba_lib_video_paused', userPaused); });
    // Ekran dışındayken video durur (pil/veri)
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) { if (!userPaused && vid.src) vid.play().catch(() => {}); } else if (!vid.paused) vid.pause(); }); }, { threshold: .05 }); io.observe(hero); offs.push(() => io.disconnect()); }

    // ---- Parallax, menü saydamlığı, imleç ışığı ----
    let ticking = false;
    const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; const y = scrollY, h = hero.offsetHeight;
      document.body.classList.toggle('lb-solid', y > 40);
      if (!RM && y < h * 1.2) { root.style.setProperty('--lb-par', (y * .35).toFixed(1) + 'px'); root.style.setProperty('--lb-fade', Math.max(0, 1 - y / (h * .8)).toFixed(3)); } }); };
    on(window, 'scroll', onScroll, { passive: true }); onScroll();
    if (!RM) on(hero, 'pointermove', e => { const r = hero.getBoundingClientRect(); hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); });

    // ---- Sayaçlar ----
    if (!RM) $$('[data-count]').forEach(el => { const n = +el.dataset.count, t0 = performance.now(); el.textContent = '0'; const step = t => { const k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; setTimeout(() => requestAnimationFrame(step), 500); });

    // ---- Bölüm içi kaydırma (adres çubuğundaki rotayı bozmadan) ----
    on(root, 'click', e => { const a = e.target.closest('[data-jump]'); if (!a) return; e.preventDefault(); const t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); });

    // ---- Vitrin ----
    let k = 0, timer = 0, startedAt = 0;
    const DUR = 6500, slides = $$('.lb-slide'), dots = $$('.lb-dots button');
    const go = n => { k = (n + slides.length) % slides.length; slides.forEach((s, i) => { s.classList.toggle('on', i === k); s.setAttribute('aria-hidden', String(i !== k)); s.querySelector('.lb-btn').tabIndex = i === k ? 0 : -1; }); dots.forEach((d, i) => { d.setAttribute('aria-selected', String(i === k)); d.classList.remove('run'); if (i === k && !RM) { void d.offsetWidth; d.classList.add('run'); } }); startedAt = performance.now(); };
    const auto = () => { clearInterval(timer); if (!RM) timer = setInterval(() => go(k + 1), DUR); };
    offs.push(() => clearInterval(timer));
    dots.forEach((d, i) => on(d, 'click', () => { go(i); auto(); }));
    on($('[data-f=prev]'), 'click', () => { go(k - 1); auto(); });
    on($('[data-f=next]'), 'click', () => { go(k + 1); auto(); });
    const stage = $('.lb-stage');
    on(stage, 'pointerenter', () => { clearInterval(timer); stage.classList.add('hold'); });
    on(stage, 'pointerleave', () => { stage.classList.remove('hold'); auto(); });
    let sx = null; on(stage, 'touchstart', e => { sx = e.touches[0].clientX; }, { passive: true }); on(stage, 'touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) { go(k + (dx < 0 ? 1 : -1)); auto(); } sx = null; });
    go(0); auto();

    // ---- Kütüphane: filtre, arama, sıralama ----
    const grid = $('.lb-grid'), cards = $$('.lb-card'), empty = $('.lb-empty'), count = $('.lb-count b'), search = $('.lb-search input'), sortSel = $('.lb-sort select');
    let cat = 'all', q = '';
    const apply = () => {
      let n = 0;
      cards.forEach(c => { const ok = (cat === 'all' ? c.dataset.cat !== 'web' : c.dataset.cat === cat) && (!q || c.dataset.name.includes(q)); c.classList.toggle('lb-hide', !ok); if (ok) n++; });
      count.textContent = n; empty.hidden = n > 0;
      $$('.lb-filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    };
    const sort = mode => {
      const lastId = (ls.get('baba_last_game', null) || {}).id, hist = ls.get('baba_game_history', {});
      const arr = cards.slice().sort((a, b) => mode === 'az' ? a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent, 'tr') : mode === 'last' ? (hist[b.dataset.id] || (b.dataset.id === lastId ? 1 : 0)) - (hist[a.dataset.id] || (a.dataset.id === lastId ? 1 : 0)) : a.dataset.i - b.dataset.i);
      arr.forEach((c, i) => { c.style.setProperty('--d', (i % 8) * 50 + 'ms'); grid.appendChild(c); });
      if (!RM) { grid.classList.remove('lb-resort'); void grid.offsetWidth; grid.classList.add('lb-resort'); }
    };
    $$('.lb-filters button').forEach(b => on(b, 'click', () => { cat = b.dataset.cat; apply(); }));
    $$('.lb-cat-tile').forEach(b => on(b, 'click', () => { cat = b.dataset.pick; apply(); $('#lbLibrary').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }));
    on(search, 'input', () => { q = search.value.trim().toLocaleLowerCase('tr-TR'); apply(); if (q && scrollY < $('#lbLibrary').offsetTop - 200) $('#lbLibrary').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); });
    on(sortSel, 'change', () => sort(sortSel.value));

    $$('.lb-cat-tile').forEach(t => { if (t.dataset.img) t.style.setProperty('--img', `url("${new URL(t.dataset.img, location.href).href}")`); });
    // ---- Kaydırınca beliren öğeler ----
    const revealEls = $$('.lb-card, .lb-sec-head, .lb-cat-tile, .lb-score, .lb-stage');
    if (!RM && 'IntersectionObserver' in window) {
      revealEls.forEach(el => el.classList.add('lb-pre'));
      const io2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('lb-in'); io2.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
      revealEls.forEach(el => io2.observe(el)); offs.push(() => io2.disconnect());
    }

    // ---- Kart eğimi (fareyle) ----
    if (!RM && matchMedia('(hover: hover)').matches) cards.forEach(c => {
      on(c, 'pointermove', e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg'); c.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg'); c.style.setProperty('--gx', ((x + .5) * 100).toFixed(1) + '%'); c.style.setProperty('--gy', ((y + .5) * 100).toFixed(1) + '%'); });
      on(c, 'pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });

    return () => { offs.forEach(f => { try { f(); } catch (e) {} }); try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) {} };
  }

  // Son oynanan oyunu ve oynama geçmişini kaydet (rota değişiminde çağrılır)
  function track(id) { const h = ls.get('baba_game_history', {}); h[id] = Date.now(); ls.set('baba_game_history', h); ls.set('baba_last_game', { id, at: Date.now() }); }
  return { render, track, META, COVER };
})();
