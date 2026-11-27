// Klavye + fare + (basit) dokunmatik giriş
export class Input {
  constructor(el) {
    this.keys = new Set(); this.pressed = new Set(); this.mouse = { x: 0, y: 0, nx: 0, ny: 0, down: false, right: false, clicked: false };
    this.touch = { active: false, mx: 0, mz: 0, btn: new Set(), tapped: new Set() };
    addEventListener('keydown', e => { if (e.repeat) return; const k = e.key.toLowerCase(); this.keys.add(k); this.pressed.add(k); if ([' ', 'arrowup', 'arrowdown', 'tab'].includes(k)) e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; this.mouse.nx = this.mouse.x / r.width * 2 - 1; this.mouse.ny = -(this.mouse.y / r.height) * 2 + 1; this.mouse.moved = true; });
    el.addEventListener('mousedown', e => { if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; } if (e.button === 2) this.mouse.right = true; });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.right = false; });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  down(...ks) { return ks.some(k => this.keys.has(k) || this.touch.btn.has(k)); }
  hit(...ks) { return ks.some(k => this.pressed.has(k) || this.touch.tapped.has(k)); }
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; this.touch.tapped.clear(); }
}
