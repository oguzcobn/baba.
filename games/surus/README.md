# SÜRÜŞ. — Konyaaltı

Akdeniz Bulvarı çevresindeki yaklaşık 3 km'lik güzergâhı izleyen tarayıcı prototipi. Araç rota boyunca ilerler ve direksiyon yanal konumu değiştirir. İlk sürümde serbest dolaşım, trafik ve çarpışmalar yoktur.

## Oynama

Paketin kökünde `python3 -m http.server 8000` çalıştır ve `http://localhost:8000/games/surus/` adresini aç. Antrenman görünümü hemen açılır. WASD, yön tuşları veya dokunmatik pedallarla sür. Tofaş Kartal’ın kokpit ve takip kameraları arasında geçiş yapabilirsin. Araç durduğunda şoförün bira ve sigara animasyonlarını başlatabilirsin. Gaza basınca animasyon kapanır.

Google görünümü için Google Cloud projesinde faturalandırmayı ve Map Tiles API'yi etkinleştir. Tarayıcı anahtarını HTTP yönlendiricileriyle ve Map Tiles API ile sınırla. Yerel test için `http://localhost:8000/*`, canlı ortam için kendi site adresini ekle. Oyunda Harita menüsünden anahtarı gir. Oyun anahtarı kaydetmez. Google görünümü internet, uygun WebGL desteği ve rotada 3D veri kapsamı gerektirir. CesiumJS Google 3D atıflarını ekranda gösterir.

## BABA.'ya ekleme

`games/surus/` ve `img/library/surus-1280.svg` dosyalarını deponun aynı konumlarına kopyala. Depo kökünden `git apply --check /paketin/yolu/baba-oyunlar.patch` çalıştır. Kontrol geçerse `git apply /paketin/yolu/baba-oyunlar.patch` komutunu kullan. Yama `472dfdc` sürümüne göre hazırlandı.

Rota geometrisi OpenStreetMap katkıcılarının yol verisinden FOSSGIS OSRM servisiyle 25 Kasım 2026 tarihinde alındı. [OpenStreetMap lisans ve atıf bilgisi](https://www.openstreetmap.org/copyright).
