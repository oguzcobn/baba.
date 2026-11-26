# Teknik mimari ve matematik tabanlı gerçekçilik standardı

## 1. Mimari

Başlangıç Three.js r170 yerel ES module ve V0.6 HTML/JS. Önce mevcut sistemi koru ve küçük adımlarla ayır. TypeScript + Vite tercih edilir; sürümleri sabitle, lockfile ekle, çalışma sırasında CDN gerektirme. WebGL2 birincil; WebGPU/TSL deneysel opsiyon, aynı gameplay state. Rapier WASM (veya belgelenmiş eşdeğer) hibrit fizik. Blender glTF/GLB üretimi; GLTFLoader, KTX2/Basis, Meshopt, gerekirse Draco; tüm asset'ler lisanslı ve kaynakları kayıtlı. Kaynak dosyaları ve derlenmiş dist ayrı. Vitest ve Playwright; GitHub Actions.

Önerilen yapı:
```
src/{core,sim,ecs,world,navigation,economy,production,combat,ai,diplomacy,technology,save,render,physics,animation,ui,audio,workers}/
assets/{countries,buildings,characters,vehicles,landmarks,terrain,textures,audio,licenses}/
data/{countries,units,buildings,tech,biomes,scenarios}/
labs/{model,material,lighting,physics,animation,navigation,weather,destruction,landmark,benchmark,map,ai}/
tests/{unit,integration,e2e,benchmarks}/
README.md  GDD.md  ARCHITECTURE.md  CLAUDE.md
```

ECS veya veri odaklı modüler sistem; UI sadece olay/komut ile simülasyonu değiştirir. Render state'i gameplay kurallarından ayır. Web Workers: nav, terrain, AI işlerini zaman dilimlerine böl; transferable buffers ile veri taşı; her kare JSON kopyalama yapma. Sık güncellenen birim state'leri typed arrays ve havuzlar. Kayıt versiyonlama ve migration testleri.

Sabit sim tick (başlangıç 20 Hz, dt=0.05 s), render requestAnimationFrame ve interpolation. Accumulator sınırı ve slow frame politikası; render düşse bile kontrol ve simülasyon zamanlamasını açıkça yönet. Multiplayer için sadece sabit dt yeterli değil: deterministik PRNG, sıralı komutlar, platformlar arası float davranışı ve state hash/rollback gereklilikleri.

## 2. Grafik ve fizik doğruluğu

Kullanıcının zorunlu standardı: **Mathematics-Driven Photorealism & Reference-Based Rendering Calibration**. Modelleme yalnızca göze güzel gelene kadar rastgele ayar yapmak değildir. Gerçek ölçü ve mimari referans, fizik tabanlı hesaplama, objektif kıyas ve tekrarlı doğrulama.

### 2.1 Geometri ve materyal
- Parametrik ölçüler: bina kat yüksekliği, duvar kalınlığı, kapı/pencere oranı, çatı açısı, araç teker çapı ve dingil mesafesi, insan anatomisi. Ölçülen, tahmin edilen, kurgusal değerleri ayır. Kaynak/provenance tablosu.
- PBR metallic-roughness; fiziksel BRDF, Cook–Torrance, GGX NDF, Smith visibility, Schlick Fresnel; doğru sRGB/linear dönüşümü, normal map tangent space, ORM haritaları, albedo üzerinde gölge pişirmeme. Three.js MeshStandardMaterial/PhysicalMaterial. Malzemeye uygun metalness ve roughness; mikro yüzey ayrıntısı ve makro aşınma; fiziksel IOR, gerektiğinde clearcoat/transmission.
- Doğal ışık: güneş yönü ve elevasyonu, gökyüzü/hemisphere, HDRI/PMREM IBL; fiziksel atmosfer için Rayleigh/Mie ve referans tabanlı renk; dolaylı ışık için light probes/baked GI veya uygun real-time yaklaşım. AO/GTAO (performans uygunsa), gölge bias ve cascade/atlas, tonemap ACES/AgX seçimini ölç. Exposure, white balance, local tonemap isteğe bağlı ve kontrollü; DOF/film grain sadece gerekliyse. UI ve seçim görünürlüğünü koru.
- Arazi: fBm, erosion yaklaşımı, makro/mikro doku harmanlama, triplanar veya tile variation, bitki instancing, rüzgâr, mevsim; su için Fresnel, reflection/refraction, normal dalgaları, kıyı köpüğü, sığ su rengi. FFT ocean yalnızca açık deniz ve bütçe gerektiriyorsa; küçük RTS nehrinde Gerstner veya shader normal dalgaları yeterli olabilir. Volumetric clouds/fog gibi pahalı sistemler ihtiyaca göre LOD/kalite profiline bağlanmalı.
- Materyal, bina, bitki ve araç varlıkları aynı aydınlatma standardında hazırlanır. Render katmanı oyun mekaniğini değiştirmez.

### 2.2 Referans kalibrasyonu (kanıt zorunlu)
1. Akademik makale, oyun motoru teknik dokümantasyonu ve lisanslı gerçek fotoğraf araştır. Ülke, mevsim, saat, hava, kamera ve mimari tip bazında etiketle.
2. 12–20 elle seçilmiş uygun referans; her birinde 7–12 karşılaştırılabilir yama (güneşli/gölgeli çimen, duvar, çatı, toprak, metal, gökyüzü, su gibi), toplam 100+ eşleşmiş ölçüm. Mümkünse doğrusal RAW veya doğru renk profilli fotoğraf; JPEG belirsizliklerini belirt. Üretim/kalibrasyon referansından ayrı doğrulama görüntüleri ayır.
3. Aynı görüş açısı, ışık ve ölçek ile render al. Yamaların maskeleri, renk uzayı, kamera parametreleri, tarih/saat, seed, grafik ayarı ve donanımı kaydet. Görsel yama kayıtlarını CSV/JSON üret.
4. Lineer luminance: Y=0.2126R+0.7152G+0.0722B. CIELAB üzerinden L*, C*=sqrt(a*²+b*²), hue=atan2(b*,a*); döngüsel hue farkını doğru hesapla. CIEDE2000, luminance RMSE, yapısal benzerlik SSIM, geometri silhouette IoU, reprojection error. Uygun metrikleri karşılaştırılabilir alanlarda kullan; görüntü kalibrasyonu mimari ölçü kanıtı değildir.
5. Ağırlıklı nonlinear least squares: min Σ wᵢ ρ(rᵢ(θ)²), θ fiziksel sınırlar içinde (roughness 0–1, IOR/metalness anlamlı, ışık yoğunluğu pozitif, geometri ölçü sınırları). SciPy least_squares / uygun optimizer. Referansa aşırı uyumdan kaçın; uygun regularization ve ayrı doğrulama. Tek bir renk hatasını azaltmak için başka materyali bozma.
6. Render → ölç → parametreleri ayarla → yeniden render. İlk ve son metrikler, hiperparametreler, referans ID'leri ve görsel karşılaştırmaları kaydet. Ölçülmemiş değeri uydurma. SSIM/ΔE hedefleri başlangıç önerisi olarak belirlenir; referans/maske kalitesi ve model hata toleransı ile raporlanır. Kabul için belirgin iyileşme ve bağımsız referansta gerileme olmaması; sayısal eşikleri veri toplandıktan sonra sabitle.
7. Aynı kontrolü geometri, animasyon ve fizik için yap: ölçü hatası, siluet, eklem sınırı, yürüyüş kadansı, ayak kayması, teker kayması, çarpışma penetrasyonu, timestep kararlılığı.

## 3. Trabzon Atatürk Köşkü — landmark laboratuvarı

20–40 farklı açılı lisanslı fotoğraf, mimari envanter, varsa rölöve/plan/ölçüm. Beyaz cephe, kırmızı kiremit çatı, asimetrik yapı, pencere/cephe süslemeleri, taş kaide, merdiven ve bahçe, havuz, ağaçlar. Görüntülerde perspektif ve lens bozulması düzelt, cephe oranlarını çoklu açı ile doğrula; güvenilir ölçü bulunmazsa tahmini yaz. Fotoğraftan ölçeksiz kesin santimetre çıkarmaya çalışma. Referans model `referans/ataturk-kosku-prototip.glb` önceki yaklaşık prototiptir, üretim kalitesi değildir. Onu incele ve gerekiyorsa yeniden modelle. Landmark modelinde özgün oran korunur. Önerilen geometri bütçesi: LOD0 30–60k triangle; LOD1 8–20k; LOD2 1.5–4k; ekrandaki boyuta göre yeniden ayarla. UV, normal, mip, doğru PBR, baked AO uygun. Dış görünüş doğrulama ve minyatür oyun görünümü ayrı. İç mekân ancak güvenilir referans varsa eklenir. Kültürel yapı yıkım hedefi değildir.

## 4. Fizik, hareket ve animasyon

- Rapier WASM sabit timestep; kinematic character controller/kinematic vehicles, static terrain/building colliders, sensörler; yalnız gereken enkaz, araç etkileşimi, çevresel nesneler dynamic rigid body. Collider sade ve render mesh'ten ayrı; collision groups. Fizik metre ve game unit ölçek dönüşümü açıkça tanımlanır.
- Dünya birimi metre ise yerçekimi 9.81 m/s²; sim birimi farklıysa dönüştür. F=ma, impulse ve momentum, restitution ve Coulomb sürtünme; CCD hızlı küçük nesneler için; uyku, maksimum hız, substep ve enkaz sayısı limitleri. Çarpışma/tünelleme, penetrasyon, eğim ve durağanlık testleri. Görsel yıkım gameplay hasarıyla eşleşmeli; gereksiz dinamik rigid body sayısını sınırla.
- Araç: teker yarıçapı r, açısal hız ω=v/r (kayma yokken); hızlanma/fren, direksiyon, zemin eğimi, süspansiyonun kinematik yaklaşımı; araç gövdesi ve teker animasyonu; görsel hareket ile rota hızı uyumlu. Su taşıtında bob/roll/pitch dalgadan örneklenir; karaya çıkamaz. Uçak görsel bank/irtifa ve rotaya bağlı yönelim.
- İnsan: rig/skeleton, gerçek anatomik eklem sınırları, gait cycle, yürüyüş/koşu/boşta/inşa/topla/taşı/teslim/hasar animasyonları, blend, ayak IK, zemin teması, hızla senkron root motion veya in-place. AnimasyonMixer/AnimationClip ve kısıtlı güncelleme; uzak birim için VAT/impostor veya LOD animasyon. Kayma, animasyon sıçraması, kol/baş penetrasyonu ölç.
- Navigation: A* (binary heap), HPA* / navmesh / flow fields büyük haritalarda; spatial hash, ORCA benzeri local avoidance, formasyon hedef dağılımı, geçerli yaklaşma noktaları, path cache ve obstacle invalidation. Her birime her tick tam A* çalıştırma. Geçersiz hedefe yaklaşma ve sıkışma geri kazanımı. AI ve oyuncu aynı navigation kurallarını kullanır.

## 5. 60 FPS mühendisliği

Hedef 60 FPS (16.67 ms frame) belgelenmiş referans masaüstü donanımında; evrensel garanti değil. Başlangıç hedef profili: 1080p gerçek GPU, normal maç 500 birime kadar; 1500 aktif birim stres/ileri hedef. Donanım ve ölçüm şartı belirlenmeden başarı sayma. 1280×800 CI fonksiyonel kontrolü gerçek 1080p GPU testi yerine geçmez.

- CPU/GPU bütçeleri bağımsız profil: simülasyon, render hazırlık, draw call, shader, GPU zamanlama ve garbage collection. GPU timer query varsa kullan, yoksa belirt. Chrome DevTools flame chart; Three renderer.info; p50/p95/p99, 1% low, frame pacing, max, drop count, bellek, draw calls, visible units, triangles, internal scale. En az 30–60 sn warmup ve 60 sn ölçüm, üç tekrar önerisi. Kısa CI ölçümleri yalnızca smoke/erken uyarı.
- Statik chunk/instancing, texture atlas, material batching, frustum ve gerektiğinde occlusion culling, LOD ekran alanı, dynamic instance pooling, GPU skinning/VAT, gölge menzili, düşük frekanslı shadow updates, visibility culling. Performans için görsel kaliteyi sessizce düşürme: kalite profilleri ve ölçek raporu; kullanıcının istediği yüksek kalite profili ayrıca test edilir.
- Geometri yeniden inşasını inşaat ve hasar event'lerine göre yerel güncelle; mini harita statik zemin cache, UI DOM yalnız değişince, ağır string/array allocation ve O(n²) hedef araması yok. Spatial index ve time slicing. Harita chunk streaming; texture compression; worker job budget.
- DRS hysteresis: birkaç saniyelik P95/p90 ölçümüyle kontrollü scale ayarla; ani titreşim ve 1px render yok. Minimum kalite, görünürlük ve okunabilirlik sınırları. CPU bottleneck çözümünü çözünürlük düşürerek gizleme. Sabit 60 için uygun VSync/frame pacing; 120/144 Hz ekranda 60 sınırı seçenek olabilir.
- Performans testleri: normal maç, 100/500/1500 aktif hareketli birim; AI, üretim, rota, gerçek render, gölge, hava ve savaş efektleri çalışırken. Tümü görünür stres ile normal görünürlük ayrı test. Donanım, çözünürlük, kamera/seed, ayar, visible/total counts ve süreyi kaydet. Yazılımsal GPU/SwiftShader = fonksiyonel test; 60 FPS gerçek donanım iddiası değildir. Mevcut README'deki mean≥59, P95≤17.5 ms erken hedefini kullan; daha sıkı sabit 60 iddiası için frame pacing ve düşüş sınırlarını ayrıca değerlendir.

## 6. Geliştirme laboratuvarları

Model Studio (GLB preview, ölçü, LOD, materyal), Material Lab (PBR), Lighting Lab (referans ışık), Physics Lab (rigid body, çarpışma), Animation Lab (gait/IK), Navigation Lab (rotalar ve kalabalık), Weather Lab, Destruction Lab, Landmark Lab, Benchmark Lab, Map Lab (seed fairness), AI Lab (karar logları). Her laboratuvar bağımsız çalışabilir, oyun ile aynı asset/engine kullanır; debug paneli yalnız geliştirici modunda. Testler ve ham ölçümler dosya olarak bırakılır.
