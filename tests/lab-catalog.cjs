const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('js/lab.js', 'utf8');
new vm.Script(source, { filename: 'js/lab.js' });
const projects = [
  ['voxcpm2-turkce-ses-tasarimi', 'voice'],
  ['crisperwhisper-turkce-kelime-zamani', 'voice'],
  ['z-image-turbo-pascal-4gb', 'image'],
  ['wan22-pascal-4gb', 'video'],
  ['dubworld', 'video'],
  ['ozel-uzak-masaustu', 'remote']
];

for (const lang of ['tr', 'en']) {
  const root = {
    isConnected: true,
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => ({})
  };
  const context = {
    root,
    I18N: { lang, locale: lang === 'tr' ? 'tr-TR' : 'en-GB' },
    App: { user: () => null },
    localStorage: { getItem: () => '[]' }
  };
  vm.runInNewContext(source + '\nLab.open(root);', context, { filename: 'js/lab.js' });
  const html = root.innerHTML;
  assert.match(html, /id="labExternalCatalog"/);
  assert.equal((html.match(/data-catalog-group=/g) || []).length, 4);
  for (const [slug, category] of projects) {
    const href = 'https://github.com/alexturkey/' + slug;
    assert.equal(html.split('href="' + href + '"').length - 1, 1, 'Missing or duplicate link: ' + slug);
    const section = html.match(new RegExp('<div class="bb-open-catalog-section" data-catalog-group="' + category + '">([\\s\\S]*?)</div>\\s*</div>'))?.[1];
    assert.ok(section && section.includes(href), 'Incorrect catalogue category: ' + slug);
  }
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length >= 6, true);
  assert.ok(html.includes(lang === 'tr' ? 'Ses ve konuşma' : 'Voice and transcription'));
  assert.ok(html.includes(lang === 'tr' ? 'Uzak erişim' : 'System and remote access'));
  assert.ok(html.includes('https://chatgpt.com/'), 'Existing LAB tools were removed');
}
console.log('LAB catalogue: six unique GitHub projects, four groups, Turkish/English and original tools OK');
