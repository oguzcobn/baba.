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
