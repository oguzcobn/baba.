(function () {
  'use strict';
  // Local, device-scoped artwork. The owner's existing PIN gate controls edit UI;
  // this is not a server-side authorization mechanism.
  const DB_NAME = 'baba-game-covers-v1';
  const STORE = 'covers';
  const LIMIT = 25 * 1024 * 1024;
  const MAX_EDGE = 1440;
  let dbPromise = null;
  const L = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en') ? en : tr;

  function database() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Cannot open cover storage'));
      req.onblocked = () => reject(new Error('Cover storage blocked'));
    }).catch(error => { dbPromise = null; throw error; });
    return dbPromise;
  }

  async function recordOperation(mode, action, record) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let request;
      try {
        if (action === 'all') request = store.getAll();
        else if (action === 'put') request = store.put(record);
        else if (action === 'delete') request = store.delete(record);
      } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(request && request.result);
      tx.onerror = () => reject(tx.error || new Error('Could not save cover'));
      tx.onabort = () => reject(tx.error || new Error('Cover transaction aborted'));
    });
  }

  async function compressedImage(file) {
    if (!file || file.size > LIMIT) throw new Error(L('Görsel 25 MB altında olmalı.', 'Choose an image smaller than 25 MB.'));
    if (!/^image\//i.test(file.type) && !/\.(jpg|jpeg|png|webp|heic|heif|avif)$/i.test(file.name)) {
      throw new Error(L('Lütfen bir fotoğraf seç.', 'Please choose a photo.'));
    }
    const source = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error(L('Fotoğraf açılamadı. JPG veya PNG deneyin.', 'Cannot open photo. Try JPG or PNG.')));
        element.src = source;
      });
      const width = img.naturalWidth, height = img.naturalHeight;
      if (!width || !height) throw new Error(L('Görsel boyutu geçersiz.', 'Invalid image dimensions.'));
      const ratio = Math.min(1, MAX_EDGE / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(L('Görsel işlenemedi.', 'Image processing unavailable.'));
      ctx.fillStyle = '#071725';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error(L('Görsel kaydedilemedi.', 'Image could not be saved.'))), 'image/jpeg', 0.86);
      });
      canvas.width = 0;
      canvas.height = 0;
      return blob;
    } finally {
      URL.revokeObjectURL(source);
    }
  }

  function mount({ container, games, defaults, isOwner }) {
    if (!container || !Array.isArray(games)) return () => {};
    const items = new Map(games.map(game => [game.id, game]));
    const nodes = new Map();
    const original = new Map();
    const overrides = new Map();
    const activeUrls = new Map();
    const switcher = container.querySelector('#bbCoverEditToggle');
    const panel = container.querySelector('#bbCoverEditor');
    let disposed = false;
    const owner = Boolean(typeof isOwner === 'function' && isOwner());

    container.querySelectorAll('[data-game-cover]').forEach(node => {
      const id = node.dataset.gameCover;
      if (!items.has(id)) return;
      nodes.set(id, node);
      original.set(id, { html: node.innerHTML, cls: node.className, style: node.getAttribute('style') });
    });

    const live = () => !disposed && typeof isOwner === 'function' && isOwner();
    function artwork(id) {
      const node = nodes.get(id);
      if (!node) return;
      const oldUrl = activeUrls.get(id);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      activeUrls.delete(id);
      const rec = overrides.get(id), saved = original.get(id);
      if (rec && rec.blob instanceof Blob) {
        const url = URL.createObjectURL(rec.blob);
        activeUrls.set(id, url);
        node.className = 'card-art card-art-cover bb-cover-custom';
        node.style.setProperty('--cover-image', 'none');
        node.textContent = '';
        const img = document.createElement('img');
        img.src = url;
        img.alt = (items.get(id) || {}).name || id;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.style.objectFit = rec.fit === 'contain' ? 'contain' : 'cover';
        node.appendChild(img);
      } else if (saved) {
        node.className = saved.cls;
        node.innerHTML = saved.html;
        if (saved.style === null) node.removeAttribute('style');
        else node.setAttribute('style', saved.style);
      }
    }

    function updateRow(id) {
      if (!panel) return;
      const row = Array.from(panel.querySelectorAll('[data-bb-cover-row]')).find(e => e.dataset.bbCoverRow === id);
      if (!row) return;
      const rec = overrides.get(id);
      const img = row.querySelector('.bb-cover-editor-img');
      const blank = row.querySelector('.bb-cover-editor-blank');
      const url = activeUrls.get(id) || (defaults && defaults[id]);
      img.hidden = !url;
      blank.hidden = !!url;
      if (url) { img.src = url; img.style.objectFit = rec && rec.fit === 'cover' ? 'cover' : 'contain'; }
      row.querySelectorAll('[data-bb-cover-fit]').forEach(button => {
        button.disabled = !rec;
        button.setAttribute('aria-pressed', String(Boolean(rec && rec.fit === button.dataset.bbCoverFit)));
      });
      row.querySelector('[data-bb-cover-reset]').disabled = !rec;
      row.classList.toggle('bb-cover-edited', Boolean(rec));
    }

    function message(id, msg, error) {
      if (!panel || disposed) return;
      const row = Array.from(panel.querySelectorAll('[data-bb-cover-row]')).find(e => e.dataset.bbCoverRow === id);
      if (!row) return;
      const status = row.querySelector('.bb-cover-editor-status');
      status.textContent = msg;
      status.classList.toggle('is-error', Boolean(error));
    }

    if (owner && switcher && panel) {
      switcher.disabled = true;
      switcher.addEventListener('click', () => {
        if (!live()) return;
        const opening = panel.hidden;
        panel.hidden = !opening;
        switcher.setAttribute('aria-expanded', String(opening));
        switcher.textContent = opening ? L('✕ Düzenlemeyi Kapat', '✕ Close editor') : L('✎ Kapakları Düzenle', '✎ Edit covers');
        if (opening) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      panel.innerHTML = `<div class="bb-cover-editor-intro">
        <h3>${L('Kapak düzenleyici', 'Cover editor')}</h3>
        <p>${L('Galerinden bir fotoğraf seç. “Doldur” kartı tamamen kaplar, “Tamamı” görselin tamamını gösterir. Değişiklikler yalnızca bu cihazda saklanır; ziyaretçilerin telefonlarına otomatik aktarılmaz.', 'Choose a photo from your gallery. Fill covers the whole card; Fit shows the entire image. Changes are saved on this device only and do not automatically reach visitors.')}</p>
      </div><div class="bb-cover-editor-grid">${games.map(game => `<div class="bb-cover-editor-item" data-bb-cover-row="${game.id}">
        <div class="bb-cover-editor-thumb"><img class="bb-cover-editor-img" alt="" hidden><span class="bb-cover-editor-blank">🎮</span></div>
        <div class="bb-cover-editor-info"><b>${String(game.name).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</b>
          <div class="bb-cover-editor-controls">
            <label class="bb-cover-pick">${L('＋ Galeriden Seç', '＋ Choose Photo')}<input type="file" accept="image/*" data-bb-cover-file="${game.id}" aria-label="${L('Galeriden kapak seç', 'Choose cover from gallery')}"></label>
            <button type="button" data-bb-cover-fit="cover" data-bb-game="${game.id}">${L('Doldur', 'Fill')}</button>
            <button type="button" data-bb-cover-fit="contain" data-bb-game="${game.id}">${L('Tamamı', 'Fit')}</button>
            <button type="button" data-bb-cover-reset="${game.id}">${L('Sıfırla', 'Reset')}</button>
          </div>
          <small class="bb-cover-editor-status" role="status" aria-live="polite"></small>
        </div>
      </div>`).join('')}</div>`;

      panel.addEventListener('change', async event => {
        const input = event.target.closest('[data-bb-cover-file]');
        if (!input || !live()) return;
        const id = input.dataset.bbCoverFile;
        if (!items.has(id) || !input.files || !input.files[0]) return;
        input.disabled = true;
        message(id, L('Görsel hazırlanıyor…', 'Preparing photo…'));
        try {
          const blob = await compressedImage(input.files[0]);
          if (!live()) return;
          const rec = { id, blob, fit: 'cover', updatedAt: Date.now() };
          await recordOperation('readwrite', 'put', rec);
          if (disposed) return;
          overrides.set(id, rec);
          artwork(id);
          updateRow(id);
          message(id, L('✓ Kapak kaydedildi', '✓ Cover saved'));
        } catch (error) {
          message(id, error && error.message ? error.message : L('Kayıt başarısız.', 'Save failed.'), true);
        } finally {
          input.disabled = false;
          input.value = '';
        }
      });

      panel.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button || !live()) return;
        const id = button.dataset.bbGame || button.dataset.bbCoverReset;
        if (!items.has(id)) return;
        const current = overrides.get(id);
        if (!current) return;
        button.disabled = true;
        try {
          if (button.hasAttribute('data-bb-cover-reset')) {
            await recordOperation('readwrite', 'delete', id);
            if (disposed) return;
            overrides.delete(id);
            artwork(id);
            updateRow(id);
            message(id, L('Varsayılan kapak geri geldi', 'Original cover restored'));
          } else if (button.hasAttribute('data-bb-cover-fit')) {
            const fit = button.dataset.bbCoverFit === 'contain' ? 'contain' : 'cover';
            const rec = { ...current, fit, updatedAt: Date.now() };
            await recordOperation('readwrite', 'put', rec);
            if (disposed) return;
            overrides.set(id, rec);
            artwork(id);
            updateRow(id);
            message(id, L('✓ Görünüm kaydedildi', '✓ Display saved'));
          }
        } catch (error) {
          message(id, L('İşlem kaydedilemedi. Depolama alanını kontrol et.', 'Could not save. Check device storage.'), true);
        } finally {
          if (!disposed) updateRow(id);
        }
      });
    }

    recordOperation('readonly', 'all').then(all => {
      if (disposed) return;
      for (const rec of all || []) {
        if (!items.has(rec.id) || !(rec.blob instanceof Blob)) continue;
        overrides.set(rec.id, rec);
        artwork(rec.id);
      }
      if (owner && panel) {
        games.forEach(game => updateRow(game.id));
        if (switcher) switcher.disabled = false;
      }
    }).catch(() => {
      if (switcher && owner) switcher.disabled = false;
      if (panel && owner) {
        panel.insertAdjacentHTML('afterbegin', `<p class="bb-cover-storage-error">${L('Tarayıcı fotoğraf saklama alanına erişemiyor. Gizli sekme yerine normal Safari kullan.', 'Cannot access photo storage. Use a normal Safari tab, not private browsing.')}</p>`);
      }
    });

    return () => {
      disposed = true;
      for (const url of activeUrls.values()) URL.revokeObjectURL(url);
      activeUrls.clear();
    };
  }
  window.BABACovers = { mount };
})();
