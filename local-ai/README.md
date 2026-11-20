# BABA. Yerel AI Model Çalıştırıcısı

Bu klasör, **BABA. → LAB. → AI Stüdyo** ile kişisel bilgisayarında kurduğun yapay zekâ motorlarını birbirine bağlar. **GitHub Pages sadece arayüzdür; modeller BABA. sunucusunda veya tarayıcıda çalışmaz.** Model ağırlıklarının otomatik olarak indirildiği, paylaşımlı veya bulut üzerinde hazır bir servis değildir.

## Modeller

| BABA. aracı | Yerel kaynak / kurulum |
| --- | --- |
| Seslendirme | [VoxCPM2](https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi) |
| Görsel oluşturma | [Z-Image Turbo 4 GB](https://github.com/alexturkey/z-image-turbo-pascal-4gb) |
| Video oluşturma | [Wan 2.2 4 GB](https://github.com/alexturkey/wan22-pascal-4gb) |
| Kelime zamanlı transkripsiyon | [CrisperWhisper](https://github.com/alexturkey/crisperwhisper-turkce-kelime-zamani) |
| Dublaj | [DubWorld](https://github.com/alexturkey/dubworld) |
| Uzak masaüstü | [Tailscale + RustDesk rehberi](https://github.com/alexturkey/ozel-uzak-masaustu). *Bir AI modeli değildir.* |

Bunlar ayrı üçüncü taraf projelerdir. Rehberlerinin gerektirdiği donanım, çalışma ortamı, model lisansı ve disk alanını kontrol et. Örneğin CrisperWhisper model ağırlıkları **ticari olmayan** lisans altındadır. Yerel kurulumun lisanslarını kabul etmeden bu modelleri kullanma.

## Windows kurulum adımları

1. Python 3.10 veya üzerini kur. Her bir üçüncü taraf projeyi **kendi README/AGENTS.md belgesine göre** ayrı klasöre kur ve örnek komutlarının çalıştığını doğrula. Bu köprü projeleri kurmaz, indirme yapmaz veya lisans koşullarını kabul etmez.
2. `local-ai/config.example.json` dosyasını `local-ai/config.json` olarak kopyala. `root` klasörlerini kurduğun projelerin bulunduğu gerçek klasörlere ayarla. Gerekirse `executable` alanına projenin kendi `.venv/Scripts/python.exe` yolunu yaz. Wan 2.2 için `models_dir` ve `sd_cli` gerekli. DubWorld için `.venv/Scripts/dubla.exe` bulunmalı. Uzak masaüstü için RustDesk yüklü olmalı.
3. BABA. depo kökünde terminal açıp köprüyü çalıştır:

   ```powershell
   py -3 local-ai/bridge.py
   ```

4. Terminal, `http://127.0.0.1:8767` adresini ve **erişim anahtarını** gösterir. [BABA. LAB.](https://oguzcobn.github.io/baba./#lab) → AI Stüdyo bölümüne anahtarı girip **Bilgisayara bağlan** seç.
5. Kurulu motorlar “Kullanıma hazır” görünür. Metin girerek ses/görsel/video oluşturabilir, ses veya video yükleyerek transkripsiyon/dublaj başlatabilirsin. Sonuçlar kendi bilgisayarında `local-ai/runs/` altına kaydolur; BABA. ekranından indirebilirsin. Uzun süren video işlerinde sekmeyi kapatsan bile yerel işlem devam eder; köprü çalışıyor olmalıdır.

Alternatif olarak `BABA_AI_CONFIG` ortam değişkenini özel bir JSON ayar dosyasına, `BABA_AI_TOKEN` değişkenini sabit bir gizli anahtara ayarlayabilirsin. Anahtar yalnızca tarayıcı oturumunda (`sessionStorage`) saklanır. **Bu anahtarı kimseyle paylaşma.**

## Güvenlik ve sınırlar

- Sunucu yalnızca **127.0.0.1** üzerinde dinler, dış ağa port açmaz; tüm istekler erişim anahtarı gerektirir. CORS yalnızca BABA. GitHub Pages kökeni ve tanımlı yerel geliştirme adresleri için açıktır.
- Çağrılar yalnızca tanınan üçüncü taraf komut satırı araçlarına yapılır; web arayüzünden serbest kabuk komutu çalıştırılmaz. Eşzamanlı yalnızca bir GPU işi yürütülür.
- Ses/video yükleme en fazla **512 MB**. İşlem kayıtları ve dosyalar yalnızca bu cihazda tutulur. Yedeklemeden önce gizlilik ve disk kullanımını denetle.
- **4 GB Pascal GPU** projeleri belirli Windows/CUDA sürümleri ve RAM/disk gerektirir. Farklı sistemlerde çalışmaları garanti değildir. Wan 2.2'de 5 saniyelik üretim çok uzun sürebilir.
- GitHub Pages'in `https://` kökeninden yerel `http://127.0.0.1` servisine bağlantı bazı tarayıcılarda özel ağ erişim izinlerine tabi olabilir. Tarayıcı engellerse yerel servisin kendi arayüzünde çalışmayı dene.
- Uzak masaüstü sekmesi yalnızca **senin açık onayınla RustDesk'i açar**; masaüstüne izinsiz erişim, kayıtlı parola alma veya otomatik bağlantı yapmaz. Tailscale ve RustDesk kurulumu önceden yapılmalıdır.
- DubWorld ve diğer projelerin komut satırı değişirse, köprü entegrasyonu da güncellenmelidir. Bu entegrasyon kaynak motorların yerine geçmez.

## Yerel kontrol

```powershell
py -3 -m py_compile local-ai/bridge.py
node tests/lab-models.cjs
```

Model kurulu değilse LAB. hata verir; **sahte AI yanıtı üretmez**.