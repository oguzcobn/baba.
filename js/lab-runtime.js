'use strict';
/* BABA. LAB. — authenticated localhost model runner.
   This client never sends data to an external inference provider; jobs run only
   when the user installs and starts the BABA. local companion on their device. */
const BABALocalAI = (() => {
  const ENDPOINT = 'http://127.0.0.1:8767';
  const tools = [
    {id:'voice',tr:'Seslendirme',en:'Speech synthesis',hintTr:'Türkçe metin yaz ve kurulu VoxCPM2 ile seslendir.',hintEn:'Narrate text using your installed VoxCPM2 engine.'},
    {id:'image',tr:'Görsel üretimi',en:'Image generation',hintTr:'Bir görsel tarif et; kurulu Z-Image Turbo ile üret.',hintEn:'Describe a picture and generate it with installed Z-Image Turbo.'},
    {id:'video',tr:'Video üretimi',en:'Video generation',hintTr:'Bir sahne tarif et; kurulu Wan 2.2 ile kısa video üret.',hintEn:'Describe a scene and generate a short clip with installed Wan 2.2.'},
    {id:'transcribe',tr:'Ses → Metin',en:'Speech to text',hintTr:'Ses kaydı yükle; CrisperWhisper kelime zamanlı metne dönüştürsün.',hintEn:'Upload audio and get word-timed transcription with CrisperWhisper.'},
    {id:'dub',tr:'Video dublaj',en:'Video dubbing',hintTr:'Video yükle; DubWorld ile başka dilde dublaj oluştur.',hintEn:'Upload a video and dub it with DubWorld.'},
    {id:'remote',tr:'Uzak masaüstü',en:'Remote desktop',hintTr:'Kurulu RustDesk masaüstü uygulamasını kendi bilgisayarında aç.',hintEn:'Open the installed RustDesk desktop client on your own computer.'}
  ];
  const source = {
    voice:'https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi',
    image:'https://github.com/alexturkey/z-image-turbo-pascal-4gb',
    video:'https://github.com/alexturkey/wan22-pascal-4gb',
    transcribe:'https://github.com/alexturkey/crisperwhisper-turkce-kelime-zamani',
    dub:'https://github.com/alexturkey/dubworld',
    remote:'https://github.com/alexturkey/ozel-uzak-masaustu'
  };
  const T = (tr,en) => I18N.lang === 'en' ? en : tr;
  const escape = (v) => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let auth = '';
  try { auth = sessionStorage.getItem('baba-local-ai-token') || ''; } catch (_) {}
  let current = 'voice', models = {}, online = false, active = null, poll = null;
  let message = '', status = 'disconnected';
  const context = () => ({token:auth});

  function markup(){
    return '<section class="baba-ai-workspace" id="babaAiWorkspace" aria-label="'+escape(T('Yerel yapay zekâ modelleri','Local AI models'))+'">'+
      '<div class="baba-ai-head"><div><p class="eyebrow">'+escape(T('GERÇEK MODEL ÇALIŞTIRICI','REAL MODEL RUNNER'))+'</p><h2>'+escape(T('AI Stüdyo.','AI Studio.'))+'</h2><p>'+escape(T('Modelini bilgisayarına kur; BABA. içinden işlem başlat ve çıktını indir. Model çalışmıyorsa sonuç üretilmiş gibi gösterilmez.','Install a model on your computer; run it from BABA. and download the result. No fake outputs.'))+'</p></div><span class="baba-ai-state" data-ai-state>'+escape(T('Bağlantı yok','Disconnected'))+'</span></div>'+
      '<div class="baba-ai-connect"><label>'+escape(T('Bilgisayardaki yardımcı servis erişim anahtarı','Local bridge access token'))+' <input data-ai-token type="password" autocomplete="off" placeholder="'+escape(T('Terminalde gösterilen anahtar','Token printed in terminal'))+'" value="'+escape(auth)+'"></label><button class="pill" type="button" data-ai-connect>'+escape(T('Bilgisayara bağlan','Connect to computer'))+'</button><a href="https://github.com/oguzcobn/baba./tree/main/local-ai" target="_blank" rel="noopener noreferrer">'+escape(T('Kurulum rehberi ↗','Setup guide ↗'))+'</a></div>'+
      '<p class="baba-ai-security">'+escape(T('Veriler sadece kendi cihazındaki 127.0.0.1 servisine gönderilir; modeller GitHub Pages üzerinde çalışmaz. Erişim anahtarı yalnızca bu tarayıcı oturumunda tutulur.','Data is sent only to the 127.0.0.1 service on your device; models do not run on GitHub Pages. The access token is kept for this browser session only.'))+'</p>'+
      '<div class="baba-ai-tabs" role="group" aria-label="'+escape(T('AI modeli','AI engine'))+'">'+tools.map(item=>'<button type="button" data-ai-tool="'+item.id+'" class="'+(item.id===current?'active':'')+'" aria-pressed="'+(item.id===current)+'">'+escape(T(item.tr,item.en))+'</button>').join('')+'</div>'+
      '<div class="baba-ai-runner"><div class="baba-ai-modelstatus" data-ai-modelstatus></div><p data-ai-hint></p>'+
      '<label class="baba-ai-field" data-ai-text-wrap>'+escape(T('Metin / Sahne tarifi','Text / scene prompt'))+'<textarea data-ai-text maxlength="4000" rows="4" placeholder="'+escape(T('Buraya yaz...','Type here...'))+'"></textarea></label>'+
      '<label class="baba-ai-field" data-ai-voice-wrap>'+escape(T('Hazır ses','Installed voice'))+'<input data-ai-voice value="hazir/belgesel_hanim" spellcheck="false"></label>'+
      '<label class="baba-ai-field" data-ai-file-wrap>'+escape(T('Ses veya video dosyası','Audio or video file'))+'<input data-ai-file type="file"></label>'+
      '<label class="baba-ai-field" data-ai-lang-wrap>'+escape(T('Dil kodu','Language code'))+'<input data-ai-lang value="tr" maxlength="8" pattern="[a-z-]+"></label>'+
      '<label class="baba-ai-field" data-ai-frames-wrap>'+escape(T('Video uzunluğu','Video length'))+'<select data-ai-frames><option value="49">2 sn (49 kare)</option><option value="121">5 sn (121 kare)</option></select></label>'+
      '<div class="baba-ai-actions"><button class="pill" type="button" data-ai-start>'+escape(T('Modeli çalıştır','Run model'))+'</button><a data-ai-repo target="_blank" rel="noopener noreferrer">'+escape(T('Kaynak ve kurulum ↗','Source and installation ↗'))+'</a></div>'+
      '<p role="status" aria-live="polite" class="baba-ai-feedback" data-ai-message></p>'+
      '<div class="baba-ai-results" data-ai-results></div></div></section>';
  }
  async function request(path, options={}) {
    const headers={'X-Baba-Token':auth};
    if(options.body && !(options.body instanceof Blob)) headers['Content-Type']='application/json';
    const r=await fetch(ENDPOINT+path,{...options,cache:'no-store',headers:{...headers,...options.headers},credentials:'omit'});
    let body; try {body=await r.json();}catch(e){throw Error('HTTP '+r.status);}
    if(!r.ok) throw Error(body.error || ('HTTP '+r.status));
    return body;
  }
  function setStatus(root){
    if(!root.isConnected)return;
    const el=root.querySelector('[data-ai-state]');
    if(el){el.textContent=online?T('Bağlı','Connected'):T('Bağlı değil','Not connected');el.classList.toggle('connected',online);}
    const item=tools.find(i=>i.id===current);
    const avail=!!models[current];
    const msg=root.querySelector('[data-ai-modelstatus]');
    if(msg)msg.textContent=!online?T('Önce yerel yardımcı servise bağlan.','Connect to the local companion first.'):(avail?T('Model kurulu · Kullanıma hazır','Engine installed · Ready'):T('Bu motor bilgisayarında henüz kurulu veya yapılandırılmış değil.','This engine is not installed/configured on your computer.'));
    const button=root.querySelector('[data-ai-start]');
    if(button){button.disabled=!online||!avail||status==='running';button.textContent=current==='remote'?T('RustDesk aç','Open RustDesk'):T('Modeli çalıştır','Run model');}
    const note=root.querySelector('[data-ai-message]');if(note)note.textContent=message;
    const hint=root.querySelector('[data-ai-hint]');if(hint)hint.textContent=T(item.hintTr,item.hintEn);
  }
  function updateTool(root) {
    root.querySelectorAll('[data-ai-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.aiTool===current);b.setAttribute('aria-pressed',String(b.dataset.aiTool===current));});
    const show=(selector,on)=>{const e=root.querySelector(selector);if(e)e.hidden=!on;};
    show('[data-ai-text-wrap]', ['voice','image','video'].includes(current));
    show('[data-ai-voice-wrap]',current==='voice');
    show('[data-ai-file-wrap]',current==='transcribe'||current==='dub');
    show('[data-ai-lang-wrap]',current==='transcribe'||current==='dub');
    show('[data-ai-frames-wrap]',current==='video');
    const file=root.querySelector('[data-ai-file]');
    if(file)file.accept=current==='dub'?'video/mp4,video/webm,video/quicktime,.mkv,.mov,.mp4,.webm':'audio/*,video/mp4,video/webm,.m4a,.flac,.ogg';
    const link=root.querySelector('[data-ai-repo]');if(link)link.href=source[current];
    setStatus(root);
  }
  async function connect(root) {
    auth=root.querySelector('[data-ai-token]').value.trim();
    try {sessionStorage.setItem('baba-local-ai-token',auth);} catch(_){}
    try {
      const answer=await request('/status');models=answer.models||{};online=true;
      message=T('Yerel model servisi bağlandı.','Connected to local model runner.');
    } catch(e){online=false;models={};message=T('Bağlantı kurulamadı. Servisi başlatıp anahtarı gir: ','Could not connect. Start the local companion and enter the token: ')+e.message;}
    updateTool(root);
  }
  async function send(root){
    const tool=current;
    if(!online||!models[tool])return;
    if(tool==='remote'){
      if(!confirm(T('RustDesk kendi bilgisayarında açılsın mı?','Open RustDesk on your computer?')))return;
      try {await request('/remote/open',{method:'POST',body:JSON.stringify({})});message=T('RustDesk açıldı.','RustDesk started.');}catch(e){message=e.message;}
      setStatus(root);return;
    }
    status='running';message=T('İş hazırlanıyor...','Preparing job...');setStatus(root);
    try {
      let response;
      if(tool==='transcribe'||tool==='dub'){
        const file=root.querySelector('[data-ai-file]').files[0];if(!file)throw Error(T('Önce dosya seç.','Choose a file first.'));
        if(file.size>512*1024*1024)throw Error(T('En fazla 512 MB yüklenebilir.','Maximum upload 512 MB.'));
        const lang=root.querySelector('[data-ai-lang]').value.trim()||'tr';
        const query='?tool='+encodeURIComponent(tool)+'&language='+encodeURIComponent(lang)+'&filename='+encodeURIComponent(file.name);
        response=await request('/upload'+query,{method:'POST',body:file,headers:{'Content-Type':'application/octet-stream'}});
      }else{
        const text=root.querySelector('[data-ai-text]').value.trim();if(!text)throw Error(T('Metin veya sahne tarifi yaz.','Enter text or a scene prompt.'));
        response=await request('/jobs',{method:'POST',body:JSON.stringify({tool,text,voice:root.querySelector('[data-ai-voice]').value.trim(),frames:Number(root.querySelector('[data-ai-frames]').value)})});
      }
      active=response.id;message=T('İş başladı. Tamamlandığında çıktıyı buradan indirebilirsin.','Job started. Download the output when complete.');setStatus(root);
      check(root);
      if(poll)clearInterval(poll);
      poll=setInterval(()=>{if(!root.isConnected){clearInterval(poll);poll=null;return;}check(root);},3500);
    }catch(e){status='idle';message=e.message;setStatus(root);}
  }
  async function download(id,name){
    const response=await fetch(ENDPOINT+'/jobs/'+encodeURIComponent(id)+'/download?name='+encodeURIComponent(name),{headers:{'X-Baba-Token':auth},credentials:'omit'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name.split('/').pop();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function check(root){
    if(!active||!root.isConnected)return;
    try{
      const data=await request('/jobs/'+encodeURIComponent(active));
      const view=root.querySelector('[data-ai-results]');
      if(view){
        view.replaceChildren();
        const p=document.createElement('p');p.textContent=T('Durum: ','Status: ')+(data.state||'');view.appendChild(p);
        if(data.error){const e=document.createElement('p');e.textContent=data.error;view.appendChild(e);}
        const list=(data.files||[]).filter(f=>!f.name.endsWith('.json')||f.name.includes('kelimeler'));
        for(const item of list.slice(0,30)){
          const b=document.createElement('button');b.type='button';b.className='baba-ai-download';b.textContent=T('İndir: ','Download: ')+item.name;
          b.onclick=()=>download(data.id,item.name).catch(err=>{message=err.message;setStatus(root);});view.appendChild(b);
        }
        if(data.log){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=T('İş günlüğünü göster','Show job log');const pre=document.createElement('pre');pre.textContent=data.log;details.append(summary,pre);view.appendChild(details);}
      }
      if(data.state==='failed'||data.state==='completed'){
        status='idle';message=data.state==='completed'?T('İş tamamlandı. Sonuçlar aşağıda.','Job finished. Results below.'):T('İş başarısız. Günlüğe bak.','Job failed. Check the log.');
        if(poll){clearInterval(poll);poll=null;}
        setStatus(root);
      }
    }catch(e){message=e.message;setStatus(root);}
  }
  function mount(root){
    if(!root||!root.isConnected)return;
    const area=root.querySelector('#babaAiWorkspace');if(!area)return;
    area.querySelector('[data-ai-connect]').onclick=()=>connect(root);
    area.querySelector('[data-ai-start]').onclick=()=>send(root);
    area.querySelectorAll('[data-ai-tool]').forEach(b=>b.onclick=()=>{current=b.dataset.aiTool;updateTool(root);});
    updateTool(root);
    if(active)check(root);
  }
  return {markup,mount,context};
})();
window.BABALocalAI = BABALocalAI;