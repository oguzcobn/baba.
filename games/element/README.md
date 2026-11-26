# ELEMENT. — Teknik geliştirme raporu

## Hedef
DAN-BALL Powder Game'in erişilebilir çizim ve serbest deney yaklaşımından esinlenen, özgün BABA. 2D madde laboratuvarı. Orijinal kaynak kodu, varlıkları veya kullanıcı arayüzü kopyalanmadı.

## İlk sürüm
- 384×240 grid (92.160 hücre), 37 seçilebilir madde / araç bileşeni.
- TypedArray tabanlı madde, sıcaklık, yük, ömür, rüzgâr, basınç ve hidrostatik sütun alanları.
- Yerçekimi yönüne göre tarama, rastgele yatay tarama, her simülasyon adımında hareket damgası.
- Yoğunluk sıralaması, granüler çökelme, viskoziteye göre farklı akış, sütun derinliğine bağlı yaklaşık yatay akış.
- Komşu sıcaklık alışverişi, su/buz/buhar, lav/obsidyen, yanma, tohum/bitki, kil/tuğla, tuzlu su, çamur, basit korozyon.
- Sönümlü basınç/rüzgâr alanı, fan, kaynak, drenaj, pil/metal/lamba, enerji darbesi.
- Beş görünüm: madde, termal, hava basıncı, elektrik, sıvı basınç göstergesi.
- Fırça, çizgi, dikdörtgen, örnekleme, silgi, ısıtma/soğutma, basınç ve rüzgâr; sol ve sağ fare seçimi, dokunmatik.
- Altı deney: volkan, yağmur bahçesi, baraj, elektrik, akış fabrikası, yoğunluk.
- Duraklatma, tek adım, hız kontrolü, ters/sıfır yerçekimi, döngüsel kenar, geri alma, yerel kayıt ve JSON dışa/içe aktarım.
- 30 Hz hedefli sabit zaman akışı, Canvas ImageData, FPS sayacı, harici ağ bağımlılığı yok.
- BABA katalog, simülasyon kategorisi, vitrin, SVG kapak, hash rota, PWA önbelleği.

## Fizik ve doğrulama
Hücre takası taşıma sırasında madde miktarını korur; kaynaklar, drenajlar ve reaksiyonlar bunu değiştirebilir. Hidrostatik sütun yoğunluk toplamı yaklaşık rho*g*h göstergesidir, SI basıncı değildir. Isı transferi komşu sıcaklık farkının bir oranıdır; enerji/latent ısı kalibrasyonu yoktur. Elektrik devresi gerilim/akım çözümü değil, iletkenler üzerinden sönümlenen ayrık yük yayılımıdır. Rüzgâr basınç farkından ve fanlardan türeyen sönümlü alan; tam Navier–Stokes değildir.

Uygulanan otomatik motor testleri: tek kum tanesinin zemine ulaşması, tek su hücresinin korunması, sıvı sütununda derinlik arttıkça basınç göstergesi, pil-metal-lamba yük aktarımı. JavaScript sözdizimi ayrıca kontrol edildi. Tarayıcı içi gerçek cihaz performans ölçümü henüz doğrulanmadı.

## İleri sürüm hedefleri
1. Fizik: kütle/enerji bütçeleri, malzeme bazlı ısı kapasitesi, erime ve buharlaşma gizli ısısı, viskozite, yığılma açısı, sıvı hacim payı, basınç Poisson çözücüsü, engel sınır koşulları; analitik baraj, kapalı kap ve difüzyon testleri.
2. Yapılar: bağlı katı adalar, parçalanabilir rijit cisimler, çarpışma, tork, kaldırma, motor ve dişliler.
3. Elektronik: direnç, anahtar, sensör, lojik kapılar; düğüm analizi, Ohm yasası, izole devre testleri.
4. Ekosistem: nem, güneş, besin döngüsü, büyüme, erozyon, yağış; canlı ve oynanabilir karakterler.
5. Editör: yakınlaştırma ve kaydırma, alan seçimi, kopyala/yapıştır, çoklu kayıt, şablonlar, görevler, paylaşım ve topluluk moderasyonu.
6. Performans: aktif 32×32 bölgeler, uyuyan hücreler, önceden ayrılmış bellek, Web Worker/OffscreenCanvas, cihaz destekliyorsa WebGPU ping-pong. Hedef 60 FPS; orta sınıf mobilde ölçüm, p95 frame time, 10/50/90% doluluk yük testleri. GPU desteği zorunlu olmamalı.
7. Görsellik: gerçek piksel simülasyonuna bağlı emissive ışık, sıvı yüzeyleri, sıcaklık katmanları, ölçümlü referans kalibrasyonu. Görsel efektler fizik değerlerini değiştirmemeli.

Bu ileri hedeflerin tümü ilk sürümde uygulanmış değildir. Çevrimiçi galeri sunucu ve moderasyon altyapısı gerektirir.

## Kaynaklar
- https://dan-ball.jp/en/javagame/dust/ — orijinal oyun ve araçlar.
- https://www.gdcvault.com/play/1025695/Exploring-the-Tech-and-DesignAt — Noita, piksel simülasyonu ve rijit cisimler.
- https://github.com/ericleong/sand.js/ — WebGL hücresel otomat yaklaşımı.
- https://github.com/hriztam/Falling-Sand-Game/blob/main/docs/simulation-model.md — yoğunluk ve sıvı hareketi üzerine teknik referans.

## v2.1 — 26 Kasım 2026
55 seçilebilir madde ve mekanizma. Eski 0–37 kimlikleri ve v1 dünya kayıt formatı korundu. Eklenenler: zıplayan top, klon, havai fişek, oyun içi enerji bloğu, virüs, hassas sıvı, karınca, meşale, yıldırım, bomba, lazer, sarmaşık, cıva, fitil, pompa, sabunlu su, baloncuk, kuş.

Komşu çiftleri dört yönde değerlendirilir; tuz/su, lav/su, buz/su, kar/su, su/odun, su ve tuzlu su/metal, tuzlu su/bitki, asit, yanma, ısı geçişleri, yük yayılımı, klon, taşıma, lazer ve canlı davranışı için özgün kurallar eklendi. Pompa soldan alıp sağa taşır; lazer yatay/dikey durumları, metal/cıva yansıması ve en çok 12 hücre geçirgen ortam geçişiyle yaklaşık modellenir. Kuşlar yerel komşu yönelimi kullanır, gerçek aerodinamik değildir. Enerji olayları tamamen soyut oyun kurallarıdır.

Dört ek deney: klon, pompa, lazer aynası ve reaksiyon bahçesi. Maddeler seçildiğinde açıklamalar gösterilir. Eski 6 deney ve araçlar korunur.

Doğrulama: İlk revizyonda 10 motor kontrolü geçti (su/tuz, lav/su, klon, devre, pompa, lazer/metal, asit/cam, kum, enerji darbesi, üç sıvının korunması). Son revizyonda 5 ek motor kontrolü (4 hücre pompa, kalın cam, cıva yansıması, tuz, kuş) ve tüm JS sözdizimi kontrolü geçti. Bunlar küçük deterministik 40×30 grid testleridir. Tam 55×55 kombinasyon matrisi, orijinal oyunun etkileşimli karşılaştırması, tarayıcı/mobil FPS ve tüm UI akışları henüz doğrulanmamıştır. Orijinaldeki nesneler (oyuncu, dişli, kutu, fizik topu) bu revizyonda yoktur. Reaksiyonlar gerçek kimya değildir.

Ek kaynaklar: https://danball.fandom.com/wiki/Powder_Game_Reaction_Table ; https://danball.fandom.com/wiki/Water_(Powder_Game_element) ; https://danball.fandom.com/wiki/Clone_(Powder_Game_element) ; https://danball.fandom.com/wiki/Pump_(Powder_Game_element) ; https://danball.fandom.com/wiki/Laser_(Powder_Game_element) ; https://danball.fandom.com/wiki/Seawater_(Powder_Game_element) . Wiki tablosunun tüm hücreleri erişilebilir olmadığından birebir uyumluluk iddia edilmez.

## v2.2 — Otomatik reaksiyon laboratuvarı
- 55×55 sıralı çift (3.025); aynı maddeler ve ters A/B yönleri ayrı dahil. Liste M üzerinden otomatik türetilir.
- Her test 16×12 gridde bitişik iki 3×3 örnekle, aynı konumlarda ayrı ayrı çalıştırılan iki kontrolle karşılaştırılır. 8/24/60/120 adım, 1/3/5 sabit tohum, normal/sıfır/ters yerçekimi ve kaynak ayarı. Standart 24 adım / 3 tekrar.
- Gerçek motorun komşu reaksiyonunda A–B kimlik değişimleri ve elektrik olayları kaydedilir; kontrol farkı, yeni ürün, madde adetleri, ısı, yük, basınç, rüzgâr ve merkez hareketi ölçülür. Kontrollerin toplamı yaklaşık referanstır; rastgelelik, yoğunluk ve sınırlar fark yaratabilir. Her fark doğrudan kimyasal reaksiyon değildir.
- Filtrelenebilir ve tıklanabilir matris, ilk tekrarın adım adım piksel görünümü, madde sayısı tablosu, CSV/JSON dışa aktarma, durdur/devam et. Sonuçlar oturum belleğindedir; kalıcı arşiv için dışa aktar. Ana alana başlangıç düzeni taşınır (geri alınabilir), ana alan ayarları ve sınırları farklıdır.
- Worker ile tarama, desteklenmiyorsa ana iş parçacığında zaman dilimlerine bölünen yedek mod. Matris ilk açılışta oluşturulur. Oyun laboratuvar açıkken duraklatılır.
- Doğrudan çalıştırılan 8 adım / 1 tekrar taraması: 3.025/3.025 çift hatasız; 278 doğrudan dönüşüm, 614 kontrol farkı, 249 alan/hareket, 1.884 belirgin fark yok. Su+tuz, ters yön, lav+su, duvar+duvar, klon+su, deterministik tekrar ve tüm JS sözdizimi kontrolleri geçti. Bu sonuçlar kısa test koşullarına özgüdür; tam fiziksel/kimyasal doğrulama değildir.
- Kalıcı kontroller: `node tests/element-reaction-lab.cjs`; Playwright dosyası `tests/element-reaction-lab.spec.cjs`. Tarayıcı CI sonuçları yayın öncesi ayrıca kontrol edilmelidir.
