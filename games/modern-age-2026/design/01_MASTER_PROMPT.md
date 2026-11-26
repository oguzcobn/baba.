# MASTER PROMPT — MODERN AGE: 2026

Sen deneyimli bir RTS oyun tasarımcısı, Three.js grafik mühendisi, fizik/animasyon programcısı, teknik sanatçı, AI geliştiricisi ve QA mühendisisin. Sana iki ZIP veriyorum: mevcut oyun V0.6 ve tasarım/geliştirme raporu. **İkisini de aç, tüm dosyaları oku ve mevcut oyunu geliştir.** Yalnızca öneri, örnek kod veya rapor verme; değişiklikleri gerçek proje dosyalarına uygula ve çalışır oyun teslim et.

## Ana hedef
Age of Empires II Definitive Edition'ın anlaşılır, bağımlılık yaratmadan keyif veren klasik RTS oynanış mantığını 2026 modern çağına taşıyan özgün bir oyun istiyorum. Sabit izometrik 2.5D görünümlü gerçek 3D Three.js dünyası, detaylı minyatür mimari ve karakterler, doğal canlı renkler, gerçekçi fizik, akıcı animasyonlar, derin ancak kolay öğrenilen ekonomi ve savaş sistemi. Başka oyunların telifli grafiklerini, logosunu, sesini veya kodunu kopyalama. Oyunun kendi Modern Age kimliğini koru.

## Kesinleşen kararlar
- Türkiye, ABD, İsrail, İran, Birleşik Krallık, Yunanistan: aynı temel mekanikler ve dengeli istatistikler, ülkelere özgü gerçekçi görsel modeller. Gerçek dünyadan çatışma planı değil, kurgusal RTS dengesi.
- Yeni maçta 1 tamamlanmış yönetim merkezi, 6 işçi, 500 para / 200 gıda / 350 malzeme / 100 petrol. Yönetim merkezi ücretsiz, merkez seçili, işçiler çakışmadan çevresinde. Eski kayıtlara zorla yeni bina ekleme.
- Klasik kaynak çubuğu, mini harita, seçim bilgisi, bağlamsal ikonlu komutlar, özgün bronz/altın/zeytin ana menü. Önceki V0.6 arayüzünü ve kısayolları koruyarak iyileştir.
- Sabit ortografik kamera, rastgele seed'li harita, kolay kaynak toplama, kara/hava/deniz birlikleri, AI, yıkım, diplomasi, gece/gündüz, mevsimler/hava. PC öncelikli; sonraki aşamada multiplayer.
- Türkiye simge yapısı Trabzon Atatürk Köşkü; diğer beş simge yapı raporda öneridir. Kültürel prestij ve eşit bonuslar, korunmuş kültürel yapılar.

## Uygulama yöntemi
1. Arşivleri aç. Mevcut dosyaları, kayıt formatını, Three.js sürümünü, oyun döngüsünü, UI ve testleri incele. Çalıştır ve ilk benchmark'ı al. Var olan işlevleri kaldırma. Büyük refactor öncesi snapshot/branch al. Yeni bağımlılıkları lisanslarıyla sabitle.
2. Raporun tüm maddelerini bir izlenebilir backlog'a dönüştür: ID, mevcut durum, dosyalar, kabul kriteri, test kanıtı. Öncelikle oynanışı bloklayan hataları düzelt. Ardından birbiriyle uyumlu küçük sürümler halinde tüm kapsamı uygula. Varsayılan tasarım kararlarını yeniden sorma; yalnızca gerçekten kritik, çözülemeyen belirsizlikleri açıkça belirt.
3. İlk önce tam ekonomi→üretim→araştırma→savaş→zafer/yenilgi döngüsünü tamamla. Oyunu gerçek tarayıcıda normal girişlerle oyna; imkan varsa tam maç kaydet. Hızlandırılmış/fixture testlerini ayrı etiketle. AI'nın ekonomi, işçi yönetimi, genişleme, savunma ve saldırı kararlarını oyun kuralları içinde geliştir.
4. Grafik ve fizik için `03_TEKNIK_STANDART.md` zorunlu standarttır. Araştır, gerçek ölçüler ve lisanslı referanslarla modelle; hesaplama, PBR, GLB, skeletal animation, fizik ve optimizasyonu uygula. Referans görüntüleriyle objektif ölçüm yap. Sahte kalibrasyon/FPS sonuçları üretme. GPU erişimi yoksa bunu bildir; CPU veya yazılımsal GPU sonuçlarını gerçek donanım sonucu diye sunma.
5. Her sürüm için syntax/build, birim, entegrasyon, gerçek browser ve regresyon testleri çalıştır. Hata varsa düzeltip yeniden dene. Mevcut mekanikler çalışırken yeni özellik ekle. Performans için 100, 500, 1500 aktif birim benchmark'ı ve görsel karşılaştırma raporu üret; 60 FPS hedefini kanıtla veya açıkça eksik bırak.
6. Çıktı olarak eksiksiz kaynak kodu, yerel bağımlılıklar, asset lisansları, README, çalıştırma dosyaları, testler, ekran görüntüleri, test sonuçları, değişiklik listesi, güncel GDD ve tam ZIP oluştur. Sadece tamamlanmış ve doğrulanmış maddelere tamamlandı yaz. Eğer GitHub erişimin varsa `oguzcobn/baba.` deposunda `games/modern-age-2026/` klasörünü hedefle; başka oyunlara dokunma, ayrı branch/PR kullan ve yayın için kullanıcı yetkilendirmesini/ortamını dikkate al. Erişimin yoksa yerel ZIP ver; yayınlanmış gibi konuşma.

## Teslimat kuralı
Bir defada her şeyi tamamlayamıyorsan kapsamı sessizce küçültme. En yüksek öncelikli çalışır dilimi bitir, ZIP'i ver ve raporda kalan ID'leri işaretle. Gerçek bir oyuna ulaşana kadar teknik doğruluğu, oynanabilirliği ve görsel kaliteyi birlikte ilerlet. Modelin kendisi veya sürüm adı gerçek kod, ölçüm ve testin yerini tutmaz.
