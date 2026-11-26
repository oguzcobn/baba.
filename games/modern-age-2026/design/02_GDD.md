# MODERN AGE: 2026 — Birleştirilmiş Oyun Tasarım Dokümanı

## 1. Vizyon ve kararlar

Klasik Age of Empires tarzı gerçek zamanlı strateji, modern 2026 ortamı. Özgün oyun; görünüş ve deneyim için AoE II DE örnek alınır, telifli materyalleri kopyalanmaz. Oyuncu hazır karargâhtan başlayarak işçileri yönetir, kaynak toplar, üssünü büyütür, teknoloji ve ordu geliştirir, yapay zekâ rakipleriyle ticaret, barış veya kurgusal çatışma yoluyla rekabet eder. Oyunun hedef kitlesi klasik PC RTS oyuncuları; kolay öğrenme, ustalaşma derinliği, okunabilir sahne ve doğal, canlı renkler.

### Kullanıcı tarafından onaylanan tercihler
| Başlık | Karar |
|---|---|
| Grafik | Age of Empires tarzı, gerçekçi minyatür |
| Kamera | Sabit izometrik |
| Dünya | Modern askerî üs ve çevresi |
| Harita | Rastgele, seed bazlı |
| Binalar | Detaylı minyatür |
| İnsan | Gerçekçi minyatür |
| UI | Klasik RTS, özgün Modern Age kimliği |
| Başlangıç | **V0.6 revizyonu:** hazır yönetim merkezi + altı işçi |
| Ekonomi | Basit, elle görev verilebilen kaynak toplama |
| Ülkeler | Ortak mekanik, özgün ülke modelleri |
| Savaş | Görsel olarak gerçekçi, kolay yönetim |
| Modlar | Skirmish, Sandbox, Campaign, Tutorial; ileride multiplayer |
| Fizik | Detaylı fizik, çevre etkileşimi ve yıkım |
| Atmosfer | Gece/gündüz, mevsimler, hava olayları |
| Cihaz | PC öncelikli |
| Diplomasi | Anlaşmalar, ticaret, barış ve ateşkes |
| Ölçek | Gerçekçi minyatür, okunabilirlik için hafif değişim |
| Renk | AoE gibi canlı doğal |
| Simge yapılar | Kültürel prestij ve bonuslar; Trabzon Atatürk Köşkü |

## 2. Oyun döngüsü ve başlangıç

Yeni maç: 1 ücretsiz tamamlanmış HQ, 6 işçi, 500 para, 200 gıda, 350 malzeme, 100 petrol. Başlangıç nüfus kapasitesi 10, enerji kapasitesi 0; bunlar mevcut prototip dengesidir. HQ merkezde ve seçili, işçiler çevresinde güvenli ayrı konumlarda. Ana döngü: işçileri seç → kaynaklara görev ver → toplama ve taşıma → depoya teslim → konut/tesis → teknoloji → ordu → ekonomi/diplomasi/rekabet → maç sonucu. Başlangıç HQ maliyetini kesme. Ek HQ inşası normal maliyetli olabilir. Yüklenen eski kayıtların başlangıç durumunu değiştirme.

Ekonomi basit dört stok + enerji/nüfus:
- Para: ticaret, gelir, alım/satım, diplomasi.
- Gıda: işçiler, tarla, çiftlik, üretim.
- Malzeme: taş/maden/tedarik, inşaat.
- Petrol: araç/deniz/hava üretimi ve ileri seviye ekonomi.
- Elektrik: kapasite ve tüketim; enerji yoksa tesis davranışı açıkça tanımlansın. Üretim ve teknoloji bonusları tutarlı.
- Nüfus: konut, üretim sırası rezervasyonu, üst sınır, ölüm/iptal durumunda doğru güncelleme.

İşçi davranışı: git, topla, taşı, teslim et, tekrar topla; görünür taşıma animasyonu; teslim noktası zorunluluğu ve erişilebilir rota; en yakın uygun depo; dolu taşıma kapasitesi, kaynak tükenmesi, görev iptali, boş işçi seçimi. Görev iptalinde mevcut taşıma kaybolmamalı. Üretim kuyrukları süreli, iptal ve iade kuralları tutarlı, engellenen çıkışta sırada beklemeli. Rally point ve toplu kuyruk ekle. Çoklu seçim, işçi/asker filtreleri, kontrol grupları, bekle/dur, saldırı-hareket ve savunma duruşu.

## 3. Ülkeler ve kültür

| Ülke | Görsel dil (önerilen) | Simge yapı |
|---|---|---|
| Türkiye | Modern betonarme, beyaz/krem cephe, kiremit, endüstriyel tesisler, Türkçe işçi sesleri | Trabzon Atatürk Köşkü (kesin) |
| ABD | Endüstriyel depo ve modern altyapı, ülkeye özgü mimari ve araç siluetleri | Beyaz Saray (öneri) |
| İsrail | Açık tonlu taş, modern Akdeniz mimarisi | Knesset (öneri) |
| İran | Pers mimarisi etkili çağdaş tuğla/taş, modern tesisler | Azadi Kulesi (öneri) |
| Birleşik Krallık | Tuğla, taş, endüstriyel mimari | Edinburgh Kalesi (öneri) |
| Yunanistan | Akdeniz beyaz cephe, doğal taş ve kiremit | Parthenon (öneri) |

Bütün ülkeler aynı mekanikleri, temel üretimi ve istatistikleri kullanır. Model farklılıkları yalnızca yeniden renklendirme olmamalı: geometri, cephe, kıyafet, ses, araç görseli ve bayrak. Ülkeleri stereotipleştirme. Ülke bazlı ayrı özel bonuslar mevcut kararın parçası değildir; ileride açıkça onaylanırsa ekle. TR/EN dil desteği, veri tabanlı ülke tanımları.

### Simge yapılar
Her ülkenin kültürel yapısı eşdeğer fayda sağlamalı. Önceki raporda önerilen ileri oyun dengesi: +100 prestij, +15% moral, +5% kaynak toplama, +10% ticaret, +20 diplomatik itibar; 2000 malzeme, 1500 para, 180 saniye, seviye IV. Bu değerler taslak, mevcut V0.6 maliyet/gelir sistemiyle aynı değildir; test ve oyun dengesiyle ayarla. Kültürel yapılar çatışmanın yıkılabilir hedefi değildir. Bahçe, ziyaretçi animasyonu, ışıklandırma ve kültürel zafer puanı. Prestij bonusları istiflenmemeli veya istismar edilememeli.

## 4. Harita, kamera ve atmosfer

- Üretim boyutları hedef: 128×128 / 256×256 / 512×512; hücre boyutu önerisi 4 m. Mevcut 64×64 prototipi aşamalı büyüt. Render/metre ölçeğini açıkça tanımla; fizik ile oyun mekaniği aynı dönüşümü kullanmalı.
- Seed'li PRNG; fBm/noise arazi, nehirler, kıyılar, köprü/boğaz, bitki örtüsü, kaynak noktaları. Karadeniz, Akdeniz, çöl, kar, yayla ve ada biyomları. Topografya rotaları engellememeli; slope limitleri, yol maliyetleri ve su derinliği oyun tasarımına uygun olmalı.
- Başlangıç yerleşimi dengesi: kaynaklara mesafe ve miktar, güvenli HQ alanı, başlangıç işçi yolları, rakibe ulaşılabilirlik, kıyı erişimi. Her seed için doğrulama ve gerekirse yeniden üretim. En az 100 seed test et.
- Ortografik izometrik kamera: azimut 45°, elevasyon 35.264°, sabit rotasyon, pan/zoom, kenar kaydırma isteğe bağlı, WASD/oklar, H ve Space merkez. CSS pikseli, render pikseli ve dünya koordinatı eşleşmeli. Seçim, komut, mini harita tıklaması, yüksek DPI ve pencere yeniden boyutlandırma testleri.
- Gece/gündüz ve mevsimler; açık, yağmur, sis, kar. Işık, ıslaklık, su, parçacıklar, rüzgâr, mevsimsel bitkiler. Önce görsel; mekanik etkiler varsa kullanıcıya açık, adil ve test edilebilir olsun. Gece okunabilirliği korunmalı.
- Görüş alanı/fog of war: keşfedilmemiş, keşfedilmiş ama görünmeyen, görünür; mini harita ve hedefleme aynı görünürlük bilgisini kullanmalı. Kendi birimlerini ve işaretlerini göster; rakip AI da aynı bilgi kurallarına uysun.

## 5. Binalar — ilk tam sürüm için katalog

Mevcut 12 türü koru. Aşağıdaki katalog önceki yaklaşık 30 bina hedefini somutlaştıran öneridir; yeni türler modüler data-driven tanımlansın. Her tesis için cost, buildTime, footprint, HP, enerji, önkoşul, üretim listesi, animasyon, model LOD, hasar durumu, UI simgesi, AI kullanımı.

| ID | Bina | İşlev |
|---|---|---|
| B01 | Yönetim merkezi | İşçi, kaynak teslimi, gelişim |
| B02 | Depo | Teslimat ve lojistik |
| B03 | Personel konutu | Nüfus |
| B04 | Tarım tesisi | Gıda |
| B05 | Maden/taş ocağı | Malzeme |
| B06 | Petrol çıkarma tesisi | Petrol |
| B07 | Ticaret merkezi | Para, ticaret |
| B08 | Güneş enerji tesisi | Elektrik |
| B09 | Rüzgâr enerji tesisi | Elektrik |
| B10 | Jeneratör | Elektrik, yakıt maliyeti |
| B11 | Enerji dağıtım tesisi | Enerji ağı |
| B12 | Araştırma merkezi | Teknoloji |
| B13 | Diplomasi merkezi | Anlaşmalar |
| B14 | Kışla | Piyade |
| B15 | Araç fabrikası | Kara birimleri |
| B16 | Hangar | Hava birimleri |
| B17 | Tersane | Deniz birimleri |
| B18 | Atölye | Bakım/onarım |
| B19 | Hastane | Birim iyileştirme |
| B20 | Lojistik merkezi | Taşıma ve tedarik |
| B21 | Garaj | Araç hizmeti |
| B22 | İtfaiye | Çevre hasarına müdahale |
| B23 | Duvar | Engel |
| B24 | Kapı | Geçiş kontrolü |
| B25 | Gözetleme kulesi | Görüş/savunma |
| B26 | Haberleşme tesisi | Bilgi/teknoloji |
| B27 | Ulaşım terminali | Ticaret/lojistik |
| B28 | Eğitim tesisi | Eğitim bonusu |
| B29 | Kültür merkezi | Prestij |
| B30 | Ulusal simge yapı | Kültürel bonus |

İnşaat aşamaları: zemin/fundament, iskelet, cephe, bitiş; dört görünür model aşaması. Yerleştirme önizlemesi kırmızı/yeşil, footprint ve engeller, shoreline kuralı, üretim çıkışı, rotanın kesilmemesi. Hasar aşamaları sağlam, orta, ağır, enkaz; kültürel yapılar korunur. Gerçekçi inşaat ekipmanı görsel animasyonları, şantiye işçileri.

## 6. Birlikler, hareket ve oyun savaşı

Mevcut piyade, zırhlı araç, hava birimi ve devriye teknesi korunur; işçi ekonominin temelidir. Nihai katalog hedefi 40+ kurgusal, dengeli birlik varyantıdır; 6 ülke için ortak işlevsel istatistikler. İşçiler, lojistik/onarım, keşif, hafif/ağır kara birlikleri, destek, farklı hava ve deniz sınıfları. Birimlerin oyun içi maliyeti, hız, HP, menzil, saldırı hızı, zırh, tür ve sayaç ilişkileri data-driven ve tamamen kurgusal olmalı. Gerçek silah sistemlerinin operasyonel değerlerini kopyalama. Görsel siluetler ve takım rengi okunabilir olsun.

Kara: rotalama, formasyon, engel, ayrışma; hava: irtifa, uçuş animasyonu, açık sınırlar; deniz: yalnız su ve uygun derinlik, kıyı geçişi yok, dalgaya bağlı görsel hareket. Komutlar: seç, hareket, saldırı, saldırı-hareket, dur, bekle, savunma, gruplar, rally; erişilebilir komutlar ve klavye kısayolları. Çatışma okunabilir HP, görsel etki, hasar, hedef doğrulama, yenilgi/zafer; dost ateşi veya barışta saldırı hatası olmamalı. Savaş, kurgusal oyun simülasyonudur.

## 7. Teknoloji, AI, diplomasi ve maç

Dört modern gelişim seviyesi: I Kuruluş, II Altyapı, III İleri Teknoloji, IV Modernizasyon. Çağların hepsi 2026 modern dünyasındadır; antik/ortaçağ geçişi yok. Önkoşullar, maliyet ve süre; kilitli binalar/teknolojiler açık gösterilsin. Araştırma ağacı önerileri: ekonomi verimliliği, lojistik, enerji, ulaşım, birim eğitim ve bakım, diplomasi/itibar. Teknoloji etkileri kaydedilebilir, çift uygulanmamalı.

AI: aynı kaynak ve görüş kuralları; stratejik hedef seçimi, ekonomi/işçi üretimi, kaynak atama, tesis inşası, teknoloji, genişleme, savunma, üretim, taktiksel oyun komutları, diplomasi. Normal zorlukta gizli kaynak artışı yok; kolay/zor için karar gecikmesi, hata oranı, öncelik ve plan derinliği ayarlanır. Seed'li, gözlemlenebilir ve hata ayıklanabilir kararlar; AI bütçesi ve zaman dilimleme. Rakip oyuncunun ulaşamayacağı veya engelli bir yere HQ kurmasın.

Diplomasi: tarafsızlık, ticaret, ittifak, yardım, saldırmazlık, savaş, ateşkes, barış, ortak zafer. İlişkiler ve süreler kaydedilir; AI kabul/red nedenleri; ateşkesle saldırı ve yeniden hedefleme durur. Anlaşmaların ekonomi/itibar etkileri açıkça gösterilir. Birden fazla AI ileriki sürümlerde.

Zafer türleri: çatışma (kurallı rakip hedefi), ekonomi (sürdürülen hedef), teknoloji (ileri araştırma), kültür (prestij eşiği ve süre), diplomasi (ortak hedef/anlaşma). Dengeye göre seçilebilir maç ayarları. Yenilgi, zafer, istatistikler, tekrar/yeniden başlat, maç sonrası haritayı incele.

Modlar: Skirmish (AI rakip), Sandbox (serbest deneyim), Tutorial (görevli öğretim), Campaign (özgün kurgusal senaryolar; tarihî olay taklidi değil), ileride multiplayer. Harita editörü ve özel seed paylaşımı. Multiplayer ayrı mimari aşama: deterministik komutlar, lockstep veya yetkili sunucu kararı, replay, senkronizasyon ve hile önleme.

## 8. UI/UX ve ses

Klasik RTS düzeni, özgün Modern Age logosu ve bronz/altın/zeytin panel paleti. V0.6 ana menü: Yeni maç, Rehber, Ayarlar, ülke/rakip/zorluk/mod/harita seed, başlat ve devam. Üst kaynak çubuğu ve gelişim seviyesi; alt mini harita, seçim bilgisi, komut ızgarası; Ekonomi/Askerî/Kültür kategorileri. İkonlar, tooltip, maliyet ve önkoşul; bağlamsal komutlar, iptal, boş işçi, kontrol grupları, tüm birimler, bildirimler. Menüde erişilebilir klavye odağı, yeterli kontrast, kaydırma, çözünürlükte kesilmeyen paneller. Kullanıcı ayarları: grafik, ses, kamera, dil, kısayollar. H: HQ; B: işçi/inşaat; Esc: iptal; WASD/oklar, tekerlek, Space. Yeni kısayollar kullanıcıya gösterilmeli. Ses: lisanslı özgün ülke dilleri, ortam, araç/işçi hareketi, uyarı, ses seviyeleri; sessiz mod; telifli AoE seslerini kopyalama.

## 9. Ölçek ve sanat dili

Önerilen görünürlük çarpanları: insan 1.20–1.35; araç 1.00–1.15; binalar 0.85–1.00; landmark 1.00; ağaçlar 0.85–1.00; çevre 1.00. Gerçek boyutlar ve anatomiyi temel al, sadece okunabilirlik gerekirse hafifçe ayarla. Görsel ve çarpışma ölçekleri belgelenmeli.

Önerilen başlangıç paleti: yeşil `#3e6938 #648b43 #8aa85d #b3c47d #d5d9ac`; arazi/mimari `#80654c #ae9573 #c7b89b #e0d8c5 #f0ede4`; su/gökyüzü `#315e7e #518ba8 #7bb2c5 #b5d3df #e1eff5`; araç `#404b42 #6e7b61 #8d9186 #a9aba7 #c9cdca`. Doğal canlı renkler, okunabilir kontrast; tekdüze gri askerî görünüm değil. Bu renkler başlangıç önerisi, kalibrasyon sonucuna göre değişebilir.

## 10. Kalıcılık ve kalite

Sürüm numaralı kayıt, otomatik kayıt, üç manuel slot önerisi, JSON export/import, IndexedDB, kayıt migrasyonu ve bozuk kayıt hata yönetimi. UI ayarları ayrı saklanır. Replay için seed, komutlar, sim tick. Oyun hatasız açılmalı, WebGL2 desteklenmiyorsa açık uyarı ve mevcut Canvas 2.5D yedek mod. 60 FPS performans hedefi, fotogerçekçi referans ve fizik testleri teknik dokümanda. Her sürüm çalışır ZIP ve test raporu ile teslim edilir.
