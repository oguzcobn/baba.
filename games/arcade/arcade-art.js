'use strict';

window.arcadeArt = (() => {
  const scene = new Image();
  scene.src = 'art/' + document.documentElement.dataset.arcade + '.webp';

  function backdrop(ctx, width, height, pan = 0, palette = '') {
    if (!scene.complete || !scene.naturalWidth) return;
    ctx.save();
    const scale = Math.max(width / scene.width, height / scene.height);
    const w = scene.width * scale;
    const h = scene.height * scale;
    if (palette) ctx.filter = palette;
    ctx.drawImage(scene, (width - w) * (0.5 + 0.38 * Math.sin(pan)), (height - h) * 0.72, w, h);
    ctx.filter = 'none';
    const shade = ctx.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, '#090a13aa');
    shade.addColorStop(0.34, '#090a1300');
    shade.addColorStop(0.72, '#090a1310');
    shade.addColorStop(1, '#090a13a0');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function bloom(ctx, x, y, radius, color) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function ring(ctx, x, y, radius, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  return { backdrop, bloom, ring };
})();
