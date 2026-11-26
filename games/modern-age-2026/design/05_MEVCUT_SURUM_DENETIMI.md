# Mevcut V0.6 başlangıç durumu

Girdi: Modern_Age_2026_V0.6.zip (10 dosya, 1,793,134 bayt sıkıştırılmamış). GitHub: `oguzcobn/baba.` / `games/modern-age-2026/`. Canlı dağıtım: https://oguzcobn.github.io/baba./games/modern-age-2026/ . V0.6 GitHub Pages dağıtımı önceki konuşmada başarılı raporlanmıştır; burada canlı sayfa tekrar test edilmedi.

## Dosyalar
- index.html: ana oyun, simülasyon, UI, Canvas fallback, eski özel WebGL kodu ve yeni Three.js boot.
- renderer-three.js: Three.js r170 PBR render, mesh instancing, procedural textures, shadow, adaptive resolution ve karakter LOD.
- mansion-data.js: yaklaşık landmark vertex verisi.
- vendor/three.module.min.js ve THREE-LICENSE.txt: yerel Three.js ve MIT lisansı.
- smoke.mjs: Playwright iş akışı, hızlandırılmış simülasyon, kontrollü çatışma ve benchmark.
- github-actions-modern-age-check.yml: CI yapılandırma kopyası.
- README.md, START-WINDOWS.bat, start.sh: çalıştırma. README başlığı V0.4 olarak kalmış; yeni sürümde düzelt.

## Bilinen durum
| Alan | V0.6 |
|---|---|
| Başlangıç | Hazır HQ ve altı işçi, ücretsiz HQ, kaynaklar korunuyor; 36 senaryo mocked DOM simülasyonu geçti |
| Ana menü/UI | Özgün bronz/zeytin RTS UI, kaynak çubuğu, mini harita, kategoriler; tam görsel tarayıcı doğrulaması bu rapor hazırlanırken mevcut değil |
| 3D motor | Three.js r170 gerçekten tarayıcıda çalıştığı V0.4 CI'da doğrulandı |
| Modeller | Geometrik minyatür prototip; profesyonel GLB ve iskeletli karakterler eksik |
| Fizik | Özel kinematik/enkaz, spatial hash; Rapier değil |
| Harita | 64×64 prototip; hedef 128–512, biyom/fairness genişletilecek |
| Ekonomi ve binalar | 4 kaynak, 12 bina, temel worker loop; enerji tüketimi/çok sayıda bina/derin denge eksik |
| Birlikler | 4 askerî tip + işçi, kara/hava/deniz; süreli kuyruk; 40+ hedefi eksik |
| AI | Sınırlı üretim, sabit rakip gelir, basit hedef; tam ekonomi/strateji ve eşit bilgi kuralları eksik |
| Teknoloji | 4 gelişim seviyesi; tam teknoloji ağacı ve unlock/bonuslar eksik |
| Diplomasi | Temel ilişkiler, ticaret/ateşkes; tam AI pazarlık/çoklu rakip eksik |
| Atmosfer | Temel gece/gündüz, mevsim, hava; gelişmiş fiziksel atmosfer kalibrasyonu eksik |
| Landmark | Köşk yaklaşık geometri; rölöve/referans ölçümü yok, diğer ülke modelleri eksik |
| Oyun modları | Skirmish ve Sandbox; Tutorial/Campaign/editor/multiplayer eksik |
| FPS | 60 hedefi doğrulanmadı; gerçek GPU test gerekli |

V0.5 testinde işçilerin ortak hedefte sıkışması düzeltilmiş, mock DOM hızlandırılmış simülasyonda HQ, 80 malzeme, kışla, üretim ve kontrollü zafer testi geçmişti. Bu tam normal hızda insan oyunu değildir. V0.5 Three.js yazılımsal GPU benchmark'ı: 18/100/500/1500 birimde sırasıyla 4.70/5.35/4.97/4.03 FPS. Bu sonuç fiziksel GPU'yu temsil etmez. V0.4 Three.js fonksiyonel testi başarılıydı, ancak bu değerler V0.6 için güncel ölçüm değildir. Son V0.6 kapsamlı tarayıcı testi tamamlandığına dair bu pakette kanıt yok; yeniden çalıştır.

## Yerel çalışma
ZIP'i aç; klasörde `python -m http.server 8080`, tarayıcıda `http://localhost:8080`. Windows batch ve shell başlangıç dosyaları mevcut. Node ile `npm install --no-save --package-lock=false playwright@1.51.1`, `npx playwright install chromium`, `node smoke.mjs`. Gerçek GPU için PowerShell'de `$env:GPU_HARDWARE='1'; $env:HEADED='1'; $env:REQUIRE_60FPS='1'; node smoke.mjs`. Önce test dosyasının yeni başlangıç kararlarıyla uyumunu kontrol et. Paket README'si eski versiyon notları içeriyor, güncelle.

## Kritik inceleme sırası
1. Normal açılış ve Three.js init, konsol hatası, input/menü. 2. HQ/işçi/yükleme ve işçi rotaları. 3. Ekonomi/AI/teknoloji/üretim ve tam maç. 4. Asset/GLB ve GPU profili. 5. Rapier ve gerçekçilik kalibrasyonu. 6. Diğer GDD kapsamı. Her değişiklikten önce mevcut davranışı test ile sabitle.
