# Modern Age: 2026 • V0.7 uygulama durumu

Bu sürümün önceliği ekonomik açılıştan maç sonuna kadar oynanabilirliktir. Aşağıdaki tablo mevcut uygulamayı, kanıtı ve bir sonraki kabul koşulunu gösterir. design/ altındaki tam katalog, teknik standart, yol haritası ve test matrisi geliştirme kapsamındadır.

| ID | Uygulama ve dosya | Kanıt ve kalan kabul koşulu |
|---|---|---|
| ST-01 | Yerel Three.js r170, GLB, Canvas yedek kip, tek HTML çıkışı | smoke ve offline gerçek Chromium. WebGL bağlam kaybı ve farklı tarayıcılar açık. |
| ST-02 | Altı ülke, iki mod, ücretsiz merkez ve işçiler | qa/regression.json, 100 seed × 2 mod, ülkeler dönüşümlü. Tam kaynak mesafesi ve kıyı adaleti dağılımı açık. |
| ST-03 | Mevcut menüler, seçim, inşa kategorileri, kısayollar, grup ve toplanma noktası | smoke.mjs, regression.mjs ve match.py. Yüksek DPI, dar ekran ve tüm erişilebilirlik matrisi açık. |
| ST-04 | Fiziksel yük teslimi, tür koruma, paylaşılan oyuncu/rakip toplama ve inşa kuralları | Regresyonda taşıma sırasında hedef değiştirme ve tam teslim; normal maçta ilk teslim. 50 işçi tıkanma ve alternatif yol stres testi açık. |
| ST-05 | Orantılı iade, bina engeli, temel/iskelet/tamamlanma görseli | İnşaat ve iptal regresyonu. Dört ayrı üretim modeli ve şantiye makineleri açık. |
| ST-06 | HQ dahil süreli kuyruk, kapasite rezervi, geri ödeme, yakın çıkış, toplanma | Regresyon ve gerçek maç. Bütün deniz/kıyı ve kapalı çıkış kombinasyonları açık. |
| ST-07 | Mevcut savaş, yıkım, korunan kültürel yapı, dört alternatif zafer koşulu | Askerî zafer kontrollü fixture; dört hedef sayaç testi; gerçek maçta yenilgi. Denge dağılımı açık. |
| ST-08 | Sürüm 7 ve eski zarfı kabul eden yükleme, yerel kayıt, JSON aktarımı | Offline JSON gidiş-dönüşü, hatalı verinin aktif maçı koruması. Çoklu slot, IndexedDB, otomatik kayıt, kapsamlı eski kayıt arşivi açık. |
| ST-09 | Gerçek zamanlı UI ile topla, seviye atla, kışla/konut kur, dört piyade üret, savaş ilan et ve karargâha saldır | qa/match-result.json ve match-end.png. Maç sonucuna kadar olağan girişler. On ayrı hızlandırılmış maçta pasif oyuncuya karşı AI açılışı; rakipler arası denge testi açık. |

## İzlenecek geliştirme sırası

| Aşama | Bu sürümde | Geriye kalanlar |
|---|---|---|
| V0.7 sanat ve temel | Çalışma anında GLB okuması, tek çizim primitifi olarak Köşk, sürekli arazi rengi, su normalleri, yumuşak zemin gölgeleri, farklı ağaç biçimleri; bağımsız inşaat çizim grupları | TypeScript/Vite ve veri odaklı modüler çekirdek, aktarılabilir worker işleri, enterpolasyon, asset yükleyicileri, KTX2/Meshopt, ekran alanına göre LOD, özgün yüksek detaylı Türkiye modelleri |
| V0.8 fizik | Gerçekleşen yol mesafesinden adım fazı, iki bağlantılı analitik diz çözümü, teker dönüşü; mevcut parçacık ve temas çözümü | Rapier, iskelet/klip harmanlama, eğime göre ayak ve araç süspansiyonu, kayma ölçümü, su roll/pitch, fiziksel yıkım ve collider testleri |
| V0.9 AI ve dünya | Rakip görünür işçileriyle toplar, kışla/konut inşa eder ve kendi stoklarından süreli piyade üretir. Zorluk karar aralığını belirler. Ek zafer koşulları | AI teknoloji, karma ordu, keşif/savunma, saldırı-hareket, duruşlar, iki tarafa eşit savaş sisi, kalabalık rota/engelden kurtarma, farklı biyomlar ve 128–512 harita. Rakip halen karşı HQ konumunu bilir. Eski kayıtlarda başlangıç ekonomisi eksik olabilir. |
| V0.10 altı ülke | Ortak istatistik, ülkeye göre değişen merkez/konut cephe elemanları, işçi ekipmanı ve üç şasi/yürüyüş takımı düzeni. Köşk için eğrisel bahçe merdiveni | Altı kapsamlı ve doğrulanmış özgün bina/insan/araç seti, beş simge yapı, 30 bina/40+ birim, bahçe ziyaretçileri, sesler, hasarlı modeller, gerçek ölçüler ve bağımsız mimari doğrulama |
| V0.11 gelişim | Dört seviye, lojistik, iki süreli araştırma, enerji arz/talebi, ticaret geliri ve ittifak kabul koşulu | Geniş teknoloji ağacı, ileri seviye kilitleri, yardım/pazarlık/itibar, birden fazla rakip, ayrıntılı AI ve ekonomi dengesi |
| V0.12 içerik ve kullanım | Skirmish, Sandbox, başlama rehberi, TR arayüz | Görevli Tutorial, özgün Campaign, editör, EN dil paketi, lisanslı ses, yeniden atanabilir kısayollar ve erişilebilirlik |
| V0.13 gerçekçilik ve FPS | PBR, GLB, karışımlı arazi yüzeyi, mesh instancing, mini harita zemini önbelleği, inşaatta bağımsız grup güncellemesi; kısa 100/500/1500 testleri | 12–20 lisanslı referans, 100+ yama, lineer renk yönetimi, ΔE/SSIM/RMSE, ayrı doğrulama ve optimizasyon; Köşk için çok açılı ölçülendirme; 1080p fiziksel GPU'da uzun test, profiler ve kalite karşılaştırması |
| V1.0 ve V2.0 | Tek oyunculu ara sürüm | Tüm laboratuvarlar (model, malzeme, ışık, fizik, animasyon, rota, hava, yıkım, simge yapı, performans, harita, AI), tüm kalite kapıları, deterministik replay, multiplayer, yeniden bağlanma |

## Model ve kaynaklar

- Köşk kullanıcı tarafından verilen GLB prototipinden türetildi. Eğitim amaçlı bu incelemede özgün prototipin dağıtım lisansı bağımsız olarak teyit edilmedi. Betik, düz basamakları eliptik yaylardan oluşan altı basamakla değiştirir. Model ölçeği ve basamak boyutları sanatsal tahmindir. Envanterdeki kat düzeni, cephe ve eğrisel bahçe merdiveni mimari referans olarak kullanıldı. Fotoğraf dokusu dağıtılmadı. [Doğu Karadeniz Kültür Envanteri](https://karadeniz.gov.tr/ataturk-kosku/) · [Atatürk Ansiklopedisi](https://ataturkansiklopedisi.gov.tr/detay/409/Trabzon-Atat%C3%BCrk-K%C3%B6%C5%9Fk%C3%BC)
- Three.js r170 ve MIT lisansı vendor/ altındadır. Ülke cepheleri ve karakter/araç parçaları işlemsel minyatürlerdir. MeshStandardMaterial metalness/roughness iş akışı, ortam ışığı ve normal haritası ile kullanılır. [Three.js malzeme referansı](https://threejs.org/docs/pages/MeshStandardMaterial.html)
- Animasyon ölçüsü mevcut oyun hücresidir. Teker açısı θ = kat edilen mesafe / yarıçap. Diz, eşit uzunlukta iki uzvun kalça ve ayak bileği merkezli çember kesişiminden çözülür. Bu kinematik yaklaşımın gerçeğe uygunluğu hareket yakalama ile ölçülmedi. [OpenStax, Rolling Motion](https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion)
- Performans testindeki işçi kalabalığı kısa, tekrarlanan yürüyüş emirleri alır. Bu sentetik yük tam savaş/AI stres testi değildir. Render alanı ve dinamik çözünürlük her ölçümde kaydedilir. Sonuçların fiziksel GPU'da 1080p karşılığı ölçülmedi.
