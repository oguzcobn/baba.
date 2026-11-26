# Yol haritası ve izlenebilir kabul kriterleri

Sürüm isimleri önerilen aşama etiketleridir; kullanıcı V0.6'yı teslim almıştır. Önceki yol haritasını güncel durumla birleştir. Maddeleri yalnız kodlandı diye kapatma: doğrulanmış kanıt, tarih, commit ve dosya belirt.

## 1. İlk iş: V0.6 stabilizasyonu

| ID | Özellik | Kabul kriteri |
|---|---|---|
| ST-01 | Çalıştırma | ZIP açılır, HTTP ile başlar, JS hatası yok, Three.js gerçekten çizim yapar; yoksa açıklamalı Canvas fallback |
| ST-02 | Başlangıç | 6 ülke × 2 mod × en az 3 seed: tek ücretsiz HQ, 6 işçi, başlangıç kaynakları ve seçili merkez, çakışma yok |
| ST-03 | UI | Ana menü sekmeleri, seed, zorluk, ülke/rakip, komut kategorileri, H/B, minimap ve resize gerçek tarayıcıda |
| ST-04 | Ekonomi | Topla/taşı/teslim, kaynak azalır, stok doğru artar, sıkışma ve boş işçi kontrolü |
| ST-05 | İnşaat | Geçerli/geçersiz konum, işçi yaklaşması, kaynak kesintisi, bitiş, inşaat iptali, overlap yok |
| ST-06 | Üretim | Zamanlı kuyruk, kaynak/nüfus rezervi, iptal, çıkış engeli, kayıt/yükleme |
| ST-07 | Çatışma | Birim hedefi, hareket, HP, yıkım, ilişki kuralı, zafer/yenilgi ekranı; kültürel yapı korunur |
| ST-08 | Kayıt | V0.6 ve önceki kayıtlar, JSON import/export, bozuk veri, ayarlar |
| ST-09 | Tam maç | Normal hızda gerçek UI ile ekonomi → gelişim → rekabet → sonuç; fixture testini ayrı göster |

## 2. Uygulama aşamaları

| Aşama | İçerik | Çıkış kapısı |
|---|---|---|
| V0.7 | Modüler mimari, GLB loader, kaliteli Türkiye bina/işçi/araç modeli, doğal arazi | Gerçek ekran görüntüleri, asset lisansları, LOD testi, regression |
| V0.8 | Rapier, karakter rig/animasyon, araç hareketi, çevresel yıkım | Çarpışma/penetrasyon/ayak kayması testleri; görsel doğrulama |
| V0.9 | AI ekonomi ve üretim, FOW, formasyon, saldırı-hareket, çoklu zafer | En az 10 otomatik tam maç, manuel/UI maç, adil kaynak kuralları |
| V0.10 | Altı ülke özgün görsel paketleri, Köşk ve simge yapılar, 30 bina/40+ birim hedefi | Veri tutarlılığı, eşit temel mekanikler, mimari doğrulama |
| V0.11 | Dört teknoloji seviyesi, araştırma ağacı, diplomasi, enerji, ticaret | Önkoşul/bonus/iptal/kayıt ve diplomatik durum geçiş testleri |
| V0.12 | Tutorial, Campaign, Sandbox, Skirmish, harita editörü, dil/ses/erişilebilirlik | Her mod giriş/çıkış ve save, senaryo hedefleri |
| V0.13 | Referans kalibrasyonu ve gerçek GPU profiling | 100+ yamalı ham veri, ayrı validation, benchmark ve kalite profilleri |
| V1.0 | Tam sürüm | Açık kritik hata yok; tüm kabul kriterleri kanıtlı; ZIP/README/CI |
| V2.0 | Multiplayer | Netcode tasarımı, deterministik replay veya yetkili sunucu, sync, reconnect ve güvenlik |

Öncelikler birbirinden bağımsız değil: grafik/fizik/perf çalışmaları her aşamada ölçülür. 60 FPS için en sonu bekleme. Bir oturumda hepsini yapamıyorsan ST maddelerinden başla, çalışan sürüm ver ve kaldığın aşamayı kaydet.

## 3. Fonksiyonel test matrisi

- Seed: en az 100 harita (altı ülkeye dağıt), iki mod, geçerli HQ ve rakip, kaynak erişimi, kara bağlantısı, kıyı. Başlangıç fairness dağılımı.
- İşçi: tek/6/50 işçi, ortak hedef, engel, depoya varış, kaynak bitişi, taşıma sırasında görev değişimi, kayıp hedef, kayıt ortasında teslim.
- Bina: dört aşama; kaynak/nüfus/enerji; tahrip/onarım; kültürel yapı korunumu; yol engel cache invalidation; oyuncu rakip binasını inşa edemez.
- Birlik: üretim, iptal, çoklu seçim, rally, formasyon, engel, hava/deniz ayrımı, HP ve ölüm, etki/target geçersizliği, barışta saldırı olmaması.
- AI: kolay/normal/zor, farklı seed ve ülkeler, kaynak muhasebesi, ekonomi kurması, teknoloji ve üretim, ilişki değişimi, çıkmazdan kurtulma. 10+ uzun otomatik maç; kazanan dağılımı ve süre, takılma/draw logları.
- UI: 1280×800, 1920×1080, yüksek DPI, dar pencere; tab focus, input focus, mouse select/drag/right click, minimap, H/B/Esc, ayarlar, dialog pause/resume; HUD tıklaması harita komutu tetiklemez.
- Kamera: world→screen→world round-trip; farklı zoom ve resize; seçim konumu kaymaz.
- Kayıt: yeni/sürüm eski, queue, tech, AI, diplomasi, seed, timer ve outcome; tekrar yükleme; JSON doğrulama; hatalı veride mesaj; eski kayıt bozulmasın.
- Physics: birim ayrışması, static collider, CCD, gravity/scale, dinamik enkaz uykusu, teker/foot contact, su/karadan geçiş.
- Grafik: gerçek Three.js render, PBR, GLB, gölge, gece/mevsim, LOD geçişi; görsel referans ve screenshot karşılaştırma; fallback açıkça etiketli.
- Performans: 100/500/1500 aktif birim, gerçek GPU + yazılımsal CI ayrı, 1080p kalite profilleri, ortalama/p95/p99/1% low/frametime grafik; grafik kalitesi ve ölçek kayıtlı.

## 4. Teslim kontrolü (her sürüm)

- [ ] Kaynak kodu ve bağımlılıklar sürüm kontrollü, lisans ve kaynak tablosu var.
- [ ] Yerel başlatma, README ve güncel kayıt şeması var.
- [ ] Syntax/build, unit, integration ve gerçek Chromium E2E logları mevcut.
- [ ] Normal hızda oynanış raporu veya neden yapılamadığı açık; hızlandırılmış testler ayrı.
- [ ] Screenshot/video gerçekten oyundan, konsept görseli diye etiketlenmiş.
- [ ] Ham performans verileri ve donanım bilgisi mevcut; 60 FPS kanıtlanmadıysa belirtilmiş.
- [ ] Referans kalibrasyonu ve geometri/fizik ölçümleri gerçek, eksikler açık.
- [ ] Önceki özellikler ve BABA oyunları korunmuş; yeni branch/PR ve onaylı deployment.
- [ ] ZIP eksiksiz, temiz ortamda açıp çalıştırma kontrolü yapıldı.

## 5. Backlog rapor şablonu

| ID | Gereksinim | Öncelik | Durum | Dosya/commit | Test kanıtı | Açık risk |
|---|---|---|---|---|---|---|
| ST-01 | Oyun açılışı | P0 | Doğrulama bekliyor | | | |

Durumlar: bekliyor / kodlandı / test geçti / görsel doğrulandı / engelli. Sayısal ölçüm yoksa sayı yazma. İşlem tamamlanmadıysa kalan adımları tam listele, önceki raporun maddelerini sessizce silme.
