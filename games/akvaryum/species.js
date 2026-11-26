/* BABA. AKVARYUM — Tür verileri: görünüm + biyomekanik + davranış.
   Boylar (TL, cm) yetişkin akvaryum bireyleri içindir. Hızlar boy/saniye (BL/s).
   mode: 'bcf' gövde-kuyruk (karangiform/subkarangiform) · 'lab' göğüs yüzgeciyle kürek (labriform/MPF)
         'benthic' dipte, yüzgeç + kısa kuyruk sıçramaları
   bc: hızlan–süzül (burst-and-coast) yüzücü · air: saatlik yüzeyden hava alma sayısı (ortalama)
   spawn: kur/üreme koreografisi · gest/hatch: gerçek süre metni (oyunda hızlandırılır) */
(function (root) {
  'use strict';
  const SP = {
    lepistes:{ad:'Lepistes', sci:'Poecilia reticulata', from:'Venezuela, Trinidad ve çevresi', TL:5, h:.27, ped:.11, w:.13, span:.28, A:.1, lam:.95, Uc:1.6, Ub:6, bc:true, mode:'bcf', band:'upper', breed:'live', spawn:'live', gest:'yaklaşık 4 hafta',
      tail:{type:'round', len:.3, spread:.14}, dorsal:{x:-.05, w:.14, h:.1, sweep:.05}, anal:{x:-.12, w:.1, h:.07},
      male:{scale:.65, finArea:1.9, tail:{type:'fan', len:.72, spread:.38, a:.82}, dorsal:{x:-.06, w:.2, h:.2, sweep:.14}},
      fact:'Erkek, dişinin yaklaşık 2 cm önüne geçip gövdesini S biçiminde büker, yüzgeçlerini açar ve titrer: buna "sigmoid gösteri" denir. Canlı doğurur; dişi bir çiftleşmeden sonra spermi saklayıp birkaç kez doğurabilir.'},
    neon:{ad:'Neon Tetra', sci:'Paracheirodon innesi', from:'Güney Amerika · Amazon havzası', TL:3.5, h:.28, ped:.1, w:.13, span:.26, A:.1, lam:1, Uc:1.6, Ub:7, bc:true, mode:'bcf', band:'mid', breed:'egg', egg:'plant', spawn:'scatter', school:true, hatch:'yaklaşık 1–1,5 gün',
      tail:{type:'fork', len:.3, spread:.16}, dorsal:{x:0, w:.12, h:.14, sweep:.06}, anal:{x:-.1, w:.18, h:.1, sweep:.04},
      fact:'Hızlan–süzül yüzer: birkaç kuyruk vuruşuyla hızlanır, sonra gövdesini düz tutup süzülür; süzülürken sürüklenme belirgin şekilde azalır. Gece mavi şeridi solar. Yumurtalarını ince yapraklı bitkilerin arasına saçar.'},
    plati:{ad:'Plati', sci:'Xiphophorus maculatus', from:'Meksika ve Orta Amerika', TL:5.5, h:.4, ped:.15, w:.16, span:.3, A:.1, lam:.95, Uc:1.2, Ub:5, mode:'bcf', band:'mid', breed:'live', spawn:'live', gest:'yaklaşık 4 hafta',
      tail:{type:'fan', len:.32, spread:.2}, dorsal:{x:.02, w:.18, h:.15, sweep:.05}, anal:{x:-.1, w:.1, h:.1},
      fact:'Uysal bir canlı doğurandır. Yavrular doğar doğmaz yüzer ve hemen bitkilerin arasına saklanır.'},
    molly:{ad:'Molly', sci:'Poecilia sphenops', from:'Meksika ve Orta Amerika kıyıları', TL:8, h:.36, ped:.16, w:.16, span:.3, A:.1, lam:.95, Uc:1.0, Ub:5, mode:'bcf', band:'mid', breed:'live', spawn:'live', gest:'yaklaşık 4–6 hafta',
      tail:{type:'round', len:.34, spread:.22}, dorsal:{x:0, w:.2, h:.12, sweep:.05}, anal:{x:-.12, w:.1, h:.09},
      male:{scale:.85, finArea:1.6, dorsal:{x:0, w:.4, h:.2, sweep:.03}},
      fact:'Tatlı suya da hafif tuzlu suya da uyum sağlayabilir. Canlı doğurur. Erkeklerin sırt yüzgeci yelken gibi geniştir; bu yüzgeç kur sırasında açılır.'},
    kilic:{ad:'Kılıçkuyruk', sci:'Xiphophorus hellerii', from:'Meksika ve Orta Amerika', TL:10, h:.28, ped:.12, w:.13, span:.26, A:.1, lam:1, Uc:1.5, Ub:7, mode:'bcf', band:'mid', breed:'live', spawn:'live', gest:'yaklaşık 4 hafta',
      tail:{type:'fan', len:.32, spread:.18}, dorsal:{x:0, w:.18, h:.13, sweep:.06}, anal:{x:-.12, w:.1, h:.08},
      male:{scale:.85, finArea:1.5, tail:{type:'sword', len:.32, spread:.18}},
      fact:'Akıntılı derelerde yaşadığı için güçlü bir yüzücüdür. Erkeğin kuyruğunun alt ucundaki "kılıç" kur gösterisinin parçasıdır. Canlı doğurur.'},
    beta:{ad:'Beta', sci:'Betta splendens', from:'Tayland ve Güneydoğu Asya', pect:.025, TL:6.5, h:.3, ped:.14, w:.15, span:.3, A:.08, lam:.9, Uc:.6, Ub:4, mode:'lab', fpmax:5, band:'top', breed:'egg', egg:'nest', spawn:'nest', air:12, hatch:'yaklaşık 1–2 gün',
      tail:{type:'round', len:.32, spread:.2, a:.8}, dorsal:{x:-.08, w:.16, h:.12, sweep:.08, a:.75}, anal:{x:-.06, w:.38, h:.14, sweep:.1, a:.75},
      male:{finArea:2.6, tail:{type:'veil', len:.8, spread:.55, a:.82}, dorsal:{x:-.1, w:.3, h:.34, sweep:.26, a:.8}, anal:{x:-.06, w:.5, h:.46, sweep:.26, a:.8}},
      fact:'Labirent organıyla yüzeyden hava solur. Erkek, salyayla kaplı kabarcıklardan yüzeyde bir köpük yuva yapar; dişiye sarılarak yumurtlatır, düşen yumurtaları ağzıyla toplayıp yuvaya taşır ve yuvayı tek başına korur. Uzun yüzgeçleri ağır olduğu için yavaş yüzer.'},
    melek:{ad:'Melek Balığı', sci:'Pterophyllum scalare', from:'Güney Amerika · Amazon havzası', pect:.03, TL:13, h:.58, ped:.1, w:.09, span:.32, A:.09, lam:.9, Uc:.5, Ub:4, mode:'lab', fpmax:3.5, finArea:1.9, band:'mid', breed:'egg', egg:'leaf', spawn:'leaf', feel:.7, hatch:'yaklaşık 2–3 gün',
      tail:{type:'fork', len:.38, spread:.28}, dorsal:{x:-.06, w:.34, h:.55, sweep:.36}, anal:{x:-.06, w:.34, h:.55, sweep:.32},
      fact:'Yavaş yüzerken kuyruğunu kullanmaz; gövdesini dik tutup göğüs yüzgeçleriyle kürek çeker (labriform yüzme). Çiftler bir yaprağı önce ağızlarıyla temizler, yumurtaları sıra sıra dizer ve yüzgeçleriyle yelpazeleyerek korur.'},
    diskus:{ad:'Diskus', sci:'Symphysodon spp.', from:'Güney Amerika · Amazon havzası', pect:.03, TL:15, h:.88, ped:.12, w:.12, span:.26, A:.08, lam:.9, Uc:.45, Ub:3.5, mode:'lab', fpmax:3.2, band:'mid', breed:'egg', egg:'rock', spawn:'rock', hatch:'yaklaşık 2–3 gün',
      tail:{type:'round', len:.22, spread:.17}, dorsal:{x:-.02, w:.72, h:.08, sweep:.06}, anal:{x:-.06, w:.6, h:.08, sweep:.05},
      fact:'Disk biçimli gövdesiyle yerinde dönmede ustadır. Yavrular ilk günlerde anne babalarının derisinden salgılanan besleyici bir mukusla beslenir; bu yüzden yavruları ebeveynlerin yanlarına yapışık görürsün.'},
    danyo:{ad:'Zebra Danyo', sci:'Danio rerio', from:'Hindistan ve Güney Asya', TL:4.5, h:.22, ped:.1, w:.12, span:.26, A:.1, lam:1, Uc:2.4, Ub:9, bc:true, mode:'bcf', band:'upper', breed:'egg', egg:'sand', spawn:'scatter', school:true, hatch:'yaklaşık 3 gün',
      tail:{type:'fork', len:.32, spread:.15}, dorsal:{x:-.08, w:.12, h:.12, sweep:.05}, anal:{x:-.1, w:.16, h:.1, sweep:.04},
      fact:'Durgun suda sürekli yüzmek yerine hızlan–süzül döngüsü kullanır. Araştırmalar balığın, belli bir hızda enerji maliyetini en aza indiren hızlanma/süzülme oranını seçtiğini gösteriyor. Yumurtaları yaklaşık üç günde açılır.'},
    koridoras:{ad:'Koridoras', sci:'Corydoras paleatus', from:'Güney Amerika', pect:.02, TL:6.5, h:.38, ped:.13, w:.22, span:.26, A:.09, lam:.9, Uc:.7, Ub:5, bc:true, mode:'benthic', fpmax:4, density:1.02, band:'bottom', breed:'egg', egg:'glass', spawn:'tpos', school:true, barbels:true, air:14, nocturnal:true, hatch:'yaklaşık 3–4 gün',
      tail:{type:'fork', len:.3, spread:.17}, dorsal:{x:.1, w:.14, h:.26, sweep:.03}, anal:{x:-.14, w:.08, h:.08},
      fact:'Arka bağırsağıyla hava solur: ara sıra yüzeye fırlayıp hava yutar, en sık da yemekten sonra. Üreme sırasında çift "T pozisyonu" alır; dişi 2–4 yumurtayı karın yüzgeçlerinin oluşturduğu bir cepte taşıyıp cama ya da yaprağa yapıştırır.'},
    japon:{ad:'Japon Balığı', sci:'Carassius auratus', from:'Çin (evcil)', TL:12, h:.5, ped:.13, w:.25, span:.3, A:.1, lam:.9, Uc:.6, Ub:4, mode:'bcf', env:'sub', finArea:1.9, band:'low', breed:'egg', egg:'plant', spawn:'chase', hatch:'yaklaşık 2–7 gün (sıcaklığa bağlı)',
      tail:{type:'double', len:.55, spread:.36, a:.72}, dorsal:{x:.02, w:.32, h:.22, sweep:.1}, anal:{x:-.18, w:.1, h:.12},
      fact:'Kuyruk vuruş frekansı ile hız arasındaki ünlü Bainbridge (1958) ilişkisi kısmen japon balıklarıyla ölçüldü. Çift kuyruk ve yuvarlak gövde sürüklenmeyi artırdığı için süs japon balıkları yavaştır. Aslında serin suyu sever; gerçek bir akvaryumda tropikal balıklardan ayrı tutulmalıdır.'},
    gurami:{ad:'Cüce Gurami', sci:'Trichogaster lalius', from:'Hindistan ve Bangladeş', pect:.025, TL:7.5, h:.45, ped:.14, w:.14, span:.28, A:.09, lam:.9, Uc:.6, Ub:4, mode:'lab', fpmax:4, band:'upper', breed:'egg', egg:'nest', spawn:'nest', feel:.6, air:12, hatch:'yaklaşık 1–1,5 gün',
      tail:{type:'round', len:.3, spread:.2}, dorsal:{x:-.06, w:.45, h:.1, sweep:.06}, anal:{x:-.02, w:.6, h:.1, sweep:.06},
      fact:'İplik gibi uzun karın yüzgeçleriyle önündeki şeylere dokunarak keşfeder. Labirent organıyla hava solur; erkek yüzeyde köpükten yuva kurar ve yumurtalara o bakar.'},
    rasbora:{ad:'Harlequin Rasbora', sci:'Trigonostigma heteromorpha', from:'Malezya, Tayland, Endonezya', TL:4.5, h:.34, ped:.11, w:.13, span:.28, A:.1, lam:1, Uc:1.6, Ub:7, bc:true, mode:'bcf', band:'mid', breed:'egg', egg:'leaf', spawn:'inverted', school:true, hatch:'yaklaşık 1–1,5 gün',
      tail:{type:'fork', len:.32, spread:.18}, dorsal:{x:0, w:.12, h:.15, sweep:.05}, anal:{x:-.1, w:.14, h:.1, sweep:.04},
      fact:'Sıkı ve kutuplanmış sürüler halinde yüzer; komşular arasında genellikle bir–iki boy mesafe kalır. Çift, geniş bir yaprağın altında ters dönerek yumurtaları yaprağın alt yüzüne yapıştırır.'},
    ramirezi:{ad:'Ramirezi', sci:'Mikrogeophagus ramirezi', from:'Venezuela ve Kolombiya', pect:.03, TL:5.5, h:.45, ped:.13, w:.15, span:.3, A:.09, lam:.9, Uc:.6, Ub:5, mode:'lab', fpmax:4.5, band:'low', breed:'egg', egg:'rock', spawn:'rock', hatch:'yaklaşık 2–3 gün',
      tail:{type:'round', len:.3, spread:.2}, dorsal:{x:-.05, w:.55, h:.16, sweep:.08}, anal:{x:-.12, w:.25, h:.14, sweep:.08},
      fact:'Kumu ağzına alıp eleyerek yem arayan küçük bir çiklittir. Çiftler yumurtalarını düz bir taşa bırakır, sırayla başında nöbet tutup yüzgeçleriyle taze su yelpazeler.'},
  };
  const ORDER = ['lepistes','plati','molly','kilic','neon','rasbora','danyo','koridoras','beta','gurami','melek','ramirezi','diskus','japon'];
  const API = {SP, ORDER};
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FishSpecies = API;
})(typeof self !== 'undefined' ? self : this);
