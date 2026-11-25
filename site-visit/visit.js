/* Shared visit state for every ElectricAce site-visit worksheet.
   One visit = one customer/address, any number of project paths. */
window.EAVisit = (function(){
  const K = 'ea-visit', P = 'ea-visit-projects';
  const PATHS = {
    residential: {t:'Residential electrical', href:'residential.html', stores:['ea-res-v1','ea-res-v1-photos']},
    generator:   {t:'Generator installation', href:'generator.html', stores:['ea-gen-materials-v2']},
    ev:          {t:'EV charging installation', href:'ev.html', stores:['ea-ev-plan-v1']},
    heatpump:    {t:'Heat pump installation', href:'heatpump.html', stores:['ea-hp-v1','ea-hp-v1-photos']}
  };
  const get = (k, d) => { try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } };
  const put = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const info = () => get(K, {});
  function save(patch){ const v = Object.assign(info(), patch); put(K, v); refreshBar(); return v; }
  function mark(id){ const p = get(P, {}); p[id] = p[id] || {started: Date.now()}; p[id].updated = Date.now(); put(P, p); }
  const projects = () => get(P, {});
  function reset(){
    try{
      localStorage.removeItem(K); localStorage.removeItem(P);
      Object.values(PATHS).forEach(p => p.stores.forEach(s => localStorage.removeItem(s)));
    }catch(e){}
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function whoHtml(){
    const v = info();
    const bits = [v.customer ? `<b>${esc(v.customer)}</b>` : '', esc(v.address || '')].filter(Boolean);
    return bits.length ? 'Visit: ' + bits.join(' · ') : 'New visit';
  }
  function refreshBar(){ const w = document.getElementById('eaWho'); if(w) w.innerHTML = whoHtml(); }
  /* Thin bar at the top of each path: back to the project picker + who this visit is for. */
  function bar(pathId){
    if(pathId) mark(pathId);
    if(document.getElementById('eaBar')) return;
    const st = document.createElement('style');
    st.textContent = '.eabar{background:#0f1f33;color:#fff;font:14px/1.4 Inter,system-ui,sans-serif}'+
      '.eabar>div{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:8px 16px;flex-wrap:wrap}'+
      '.eabar a{color:#fff;text-decoration:none;font-weight:700;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:99px;background:rgba(255,255,255,.12)}'+
      '.eabar a:hover{background:rgba(255,255,255,.22)}'+
      '.eabar .who{color:#c9d5e3;flex:1;min-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.eabar .who b{color:#eeb500}'+
      '.eabar .pth{font-weight:700;color:#eeb500}'+
      '.eabar button.clr{font:inherit;font-weight:700;color:#fff;background:transparent;border:1.5px solid rgba(255,255,255,.35);border-radius:99px;padding:7px 14px;cursor:pointer;min-height:40px}'+
      '.eabar button.clr:hover{background:rgba(255,255,255,.12)}'+
      '.eamodal{position:fixed;inset:0;background:rgba(15,31,51,.5);display:none;align-items:center;justify-content:center;padding:20px;z-index:9999;font:15px/1.5 Inter,system-ui,sans-serif}'+
      '.eamodal.show{display:flex}.eamodal>div{background:#fff;color:#1b2430;border-radius:14px;padding:22px;max-width:400px;width:100%}'+
      '.eamodal p{margin:0 0 16px}.eamodal .r{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}'+
      '.eamodal button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:12px 18px;cursor:pointer;min-height:44px}'+
      '.eamodal .no{background:#eef2f6;color:#1b2430}.eamodal .yes{background:#eeb500;color:#1b1404}';
    document.head.appendChild(st);
    const b = document.createElement('div');
    b.className = 'eabar'; b.id = 'eaBar';
    b.innerHTML = `<div>${pathId ? '<a href="index.html">&#8592; All projects</a>' : ''}<span class="pth">${esc(PATHS[pathId] ? PATHS[pathId].t : '')}</span><span class="who" id="eaWho"></span><button type="button" class="clr" id="eaClr">Clear &amp; start over</button></div>`;
    document.body.insertBefore(b, document.body.firstChild);
    const m = document.createElement('div');
    m.className = 'eamodal'; m.id = 'eaModal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div><p><b>Clear everything and start over?</b><br>This erases the customer info and all four project worksheets on this device. Send or download anything you need first.</p><div class="r"><button type="button" class="no">Cancel</button><button type="button" class="yes">Clear &amp; start over</button></div></div>';
    document.body.appendChild(m);
    document.getElementById('eaClr').onclick = () => { m.classList.add('show'); m.querySelector('.no').focus(); };
    m.querySelector('.no').onclick = () => m.classList.remove('show');
    m.addEventListener('click', e => { if(e.target === m) m.classList.remove('show'); });
    m.querySelector('.yes').onclick = () => { reset(); location.href = 'index.html'; };
    refreshBar();
  }
  /* Tie a page's own inputs to the visit: fill when empty, write back when typed.
     map = {visitKey: elementId | 'radio:name'}  */
  function link(map, fire){
    const v = info();
    Object.entries(map).forEach(([k, ref]) => {
      if(ref.startsWith('radio:')){
        const name = ref.slice(6), radios = [...document.querySelectorAll(`input[type=radio][name="${name}"]`)];
        if(!radios.length) return;
        if(v[k] && !radios.some(r => r.checked)){ const r = radios.find(r => r.value === v[k]); if(r){ r.checked = true; if(fire) r.dispatchEvent(new Event('change', {bubbles:true})); } }
        radios.forEach(r => r.addEventListener('change', () => { if(r.checked) save({[k]: r.value}); }));
        return;
      }
      const el = document.getElementById(ref); if(!el) return;
      if(v[k] && !el.value){ el.value = v[k]; if(fire){ el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); } }
      const w = () => save({[k]: el.value});
      el.addEventListener('input', w); el.addEventListener('change', w);
    });
  }
  return {PATHS, info, save, mark, projects, reset, bar, link, esc};
})();
