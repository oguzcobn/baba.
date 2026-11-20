const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = 'games/ates-ve-su/index.html';
const src = fs.readFileSync(path, 'utf8');
const match = src.match(/const LEVELS = (\[[\s\S]*?\]);\s*const cv = /);
assert.ok(match, 'Forest Temple level data must be present');
const levels = JSON.parse(match[1]);
assert.equal(levels.length, 5, 'Forest Temple must have five stages');
assert.ok(src.includes('ch.vy = -620'), 'Jump must clear 80-pixel stair height');
assert.ok(src.includes('ch.safe = { x: ch.x, y: ch.y }'), 'Safe checkpoints must be recorded');
assert.ok(src.includes('ch.invuln = 1.5'), 'Hazard respawn must have a grace period');
assert.ok(src.includes('hintTimer'), 'Hint system required');
assert.ok(!src.includes("failLevel('Ateş Çocuk"), 'Hazards should respawn instead of showing the fail overlay');
for (const [i, level] of levels.entries()) {
  assert.ok(level.hint.length > 20, 'Missing level hint: ' + i);
  assert.equal(level.fire.y + 38, 558);
  assert.equal(level.water.y + 38, 558);
  assert.ok(level.walls.some(w => w[1] === 560 && w[2] === 960), 'Ground missing');
  const platforms = level.walls.filter(w => w[1] < 560 && w[1] > 30).sort((a,b) => b[1]-a[1]);
  assert.ok(platforms.length >= 6, 'Need a visible sequence of stair platforms: ' + i);
  let previous = {x: 24, y:560, w:330};
  for (const step of platforms) {
    const height = previous.y - step[1];
    assert.ok(height > 0 && height <= 110, `Stage ${i+1} unreachable rise: ${height}`);
    assert.ok(step[0] <= previous.x + previous.w + 110 &&
      previous.x <= step[0] + step[2] + 110, 'Horizontal jump gap too wide: ' + i);
    previous = {x:step[0],y:step[1],w:step[2]};
  }
  for (const kind of ['fire','water']) {
    const door = level.doors[kind];
    assert.ok(door.y+54 >= platforms.at(-1)[1], 'Exit door must be reachable: ' + i);
  }
  for (const pool of level.pools) {
    assert.ok(!['acid','water','lava'].includes(pool.type) || pool.w < 200, 'Keep early stages forgiving');
  }
}
assert.equal(levels[0].pools.length,0,'First level must be a safe tutorial');
assert.ok(levels[0].movers.length===0,'First level must not require puzzle switches');
console.log('Fire and Water: five progressively designed, reachable levels; checkpoints and recovery OK');
