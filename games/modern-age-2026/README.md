# Modern Age: 2026 • V0.7.1

Modern çağda geçen, altı ülkenin aynı temel istatistiklerle oynandığı tek oyunculu izometrik strateji oyunu. Bu sürüm, V0.6 üzerine kurulmuş oynanabilir geliştirme sürümüdür.

## Oyna

Çevrimdışı paket içeren ZIP’i bir klasöre çıkarıp **OYNA.html** dosyasını güncel Chrome veya Edge ile aç. İnternet, Python ve kurulum gerekmez. Maçı başlat, B ile işçileri seç ve soldaki malzeme yığınına sağ tıkla. İşçiler yükü teslim edince stok çubuğu güncellenir. Kışla için inşaat panelinden bir yer seç. Tamamlanınca binayı seçip piyadeleri sıraya koy. Savaş ilanı Diplomasi panelindedir.

Web sunucusu kullanıyorsan giriş dosyası **index.html**. Windows'ta Python yüklüyse START-WINDOWS.bat, macOS/Linux'ta `sh start.sh` kullanılabilir. Yerel sunucu adresi [localhost:8080](http://localhost:8080). Oyun dünyası Three.js ve WebGL 2 ile çizilir. Grafik ayarı aynı sahnenin çözünürlüğünü ve gölgelerini değiştirir. WebGL 2 açılamazsa başlangıç menüsü durumu gösterir.

## Maç kuralları

- Hazır karargâh, altı işçi, 500 para, 200 gıda, 350 malzeme, 100 petrol. Skirmish rakibi de aynı başlangıç bütçesini kullanır. Sandbox tek taraflıdır.
- İşçi yükü 20 birimdir. Farklı kaynağa geçerken eski yük önce depoya taşınır. Hareket, inşaat ve dur komutları yükü korur. Uygun teslim noktası olmadan stok artmaz.
- Konut +5 kapasite sağlar. Üretim başladığında maliyet ödenir, nüfus yeri ayrılır. Son sırayı iptal edince maliyet iade edilir. Çıkış doluysa sıra bekler. İnşaat iptali tamamlanmamış orana göre iade verir. İşçi ve askerler için toplanma noktası belirlenebilir.
- Altyapı seviyesinde taşıma ekipmanı yükü 30'a çıkarır. Araştırma merkezinde hassas tarım veya modüler montaj geliştirilebilir. Bir enerji tesisi 20 kapasite sağlar. Fabrika 8, hangar 12, araştırma merkezi 4 tüketir. Arz yetersizken bu tesisler %50–100 hızda çalışır. Araştırma penceresi açıkken simülasyon durur.
- Ticaret her tarafa saniyede 0,5 para kazandırır. İttifak için 60 saniye ticaret veya 100 prestij gerekir. Ateşkes 90 saniye boyunca ilişkiyi kilitler. Başlatma ekranında ek kültür, teknoloji, ekonomi veya diplomasi hedefi seçilebilir. Süreklilik koşulu bozulduğunda sayaç sıfırlanır. Rakip karargâhını savaşta düşürmek de maçı bitirir.
- B işçileri, H karargâhı seçer. Ctrl+1…9 grup atar, sayı tuşu grubu çağırır. Seçili üretim binasında “Toplanma noktası”na basıp haritaya sağ tıkla. Kaydet/Yükle tarayıcı kaydını kullanır. Menü → Ayarlar içinden JSON indirilebilir ve içe aktarılabilir. Dosyadan ve sunucudan açılan oyunlar tarayıcının farklı depolama alanlarını kullanabilir.

## Geliştirme ve test

Yakındaki işçiler ve piyadeler iskelet animasyonlu GLB modellerini kullanır. Uzak kamerada aynı hareketler daha az üçgenli 3D modellerle çizilir. Simülasyon ve arayüz index.html, Three.js çizimi renderer-three.js, paket GLB okuyucusu landmark.js içindedir. GLB kaynağı ve dönüştürme betiği pakettedir. Kaydetme anahtarı V0.6 ile ortaktır. Yeni JSON zarfı version=7, world, seq alanlarını içerir. Eski maçlara başlangıç binaları eklenmez. Ülke, stok, konum ve nesne kimlikleri yükleme öncesi kontrol edilir. Özel dosya oynatıcısının aynı kaynaklardan yeniden üretimi:

```sh
python tools/build-offline.py
```

Testler için Node.js ve Playwright gerekir. Dağıtılan oyun bu araçlara bağımlı değildir.

```sh
npm install --no-save --package-lock=false playwright@1.51.1
npx playwright install chromium
node qa/regression.mjs
node smoke.mjs
```

Python Playwright ile `python qa/match.py` gerçek zamanlı maçı, `python qa/offline.py` çift tıklama yolunu ve JSON aktarımını test eder. CHROMIUM_PATH ile kurulu Chromium çalıştırılabilir dosyası seçilebilir. Geliştirme testlerinde dünya koordinatları tıklamaya nişan almak ve sonuçları okumak için kullanılır. match.py simülasyonu hızlandırmaz, kaynak veya HP değiştirmez. smoke.mjs ise senaryo hazırlığı, hızlandırılmış zaman ve zayıflatılmış karargâh kullanır.

`modern-age-report.json` kısa WebGL ölçümlerini, `qa/` başlangıç karşılaştırmasını, regresyonları, maç olaylarını ve gerçek oyun görüntülerini içerir. Uygulanan maddeler ve bekleyen kabul kriterleri **GDD-V07.md** içindedir. Orijinal tasarım ve MASTER PROMPT **design/** altındadır.
