/* Step-by-step worksheet engine for the residential and heat pump paths.
   A path is data: steps -> fields (with show conditions) + a review() that returns
   highlights, notes and a materials list. The engine renders, remembers, and sends. */
window.Wiz = function(P){
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const PHK = P.store + '-photos';
  let st; try{ st = JSON.parse(localStorage.getItem(P.store)) || null; }catch(e){ st = null; }
  st = st || {};
  st.v = st.v || {}; st.over = st.over || {}; st.extra = st.extra || []; st.cur = st.cur || 0;
  let photos; try{ photos = JSON.parse(localStorage.getItem(PHK)) || {}; }catch(e){ photos = {}; }
  const v = st.v;
  const save = () => { try{ localStorage.setItem(P.store, JSON.stringify(st)); }catch(e){} };
  const savePhotos = () => { try{ localStorage.setItem(PHK, JSON.stringify(photos)); return true; }catch(e){ return false; } };

  // seed visit fields
  const vi = EAVisit.info();
  const steps = P.steps.concat([{title:'Review & send', review:true}]);
  const allFields = [];
  steps.forEach(s => (s.fields || []).forEach(f => allFields.push(f)));
  allFields.forEach(f => { if(f.visit && !v[f.id] && vi[f.visit]) v[f.id] = vi[f.visit]; if(f.def !== undefined && v[f.id] === undefined) v[f.id] = f.def; });

  // ---------- render ----------
  const optList = o => o.map(x => Array.isArray(x) ? x : [x, x]);
  function fieldHtml(f, k){
    const lab = f.label ? `${f.label}${f.hint ? ` <span class="hint">(${f.hint})</span>` : ''}` : '';
    const id = 'f_' + f.id;
    switch(f.type){
      case 'h': return `<div class="fld" data-k="${k}"><h3 class="sh">${f.text}</h3></div>`;
      case 'note': return `<div class="fld callout${f.warn ? ' warn' : ''}" data-k="${k}">${f.text}</div>`;
      case 'calc': return `<div class="fld callout" data-k="${k}" data-calc="${k}"></div>`;
      case 'radio': case 'check':
        return `<fieldset class="fld" data-k="${k}"><legend>${lab}</legend><div class="opts${f.sm ? ' sm' : ''}">` +
          optList(f.opts).map(([val, t, sm]) => `<label class="opt"><input type="${f.type === 'radio' ? 'radio' : 'checkbox'}" name="${f.id}__${k}" value="${esc(val)}" data-id="${f.id}"><span><b>${t}</b>${sm ? `<small>${sm}</small>` : ''}</span></label>`).join('') +
          `</div></fieldset>`;
      case 'select':
        return `<div class="fld${f.half ? '' : ' full'}" data-k="${k}"><label class="f" for="${id}">${lab}</label><select id="${id}" data-id="${f.id}"><option value=""></option>` +
          optList(f.opts).map(([val, t]) => `<option value="${esc(val)}">${t}</option>`).join('') + `</select></div>`;
      case 'textarea':
        return `<div class="fld full" data-k="${k}"><label class="f" for="${id}">${lab}</label><textarea id="${id}" data-id="${f.id}" placeholder="${esc(f.ph || '')}"></textarea></div>`;
      case 'stepper':
        return `<div class="fld${f.half ? '' : ' full'}" data-k="${k}"><label class="f" for="${id}">${lab}</label><div class="stepper"><button type="button" data-step="${f.id}" data-d="-1" aria-label="Fewer">&minus;</button><input type="number" inputmode="numeric" min="0" id="${id}" data-id="${f.id}"><button type="button" data-step="${f.id}" data-d="1" aria-label="More">+</button></div></div>`;
      case 'rows':
        return `<div class="fld full" data-k="${k}"><label class="f">${lab}</label><div class="rows" id="rows_${f.id}"></div><button type="button" class="addbtn" data-add="${f.id}">+ ${f.add || 'Add'}</button></div>`;
      case 'photos':
        return `<div class="fld full" data-k="${k}"><label class="f">${lab}</label><label class="photo-add"><input type="file" accept="image/*" multiple data-photos="${f.id}">📷 ${f.btn || 'Add photos'}<small>${f.sub || 'Take a picture or choose from the camera roll'}</small></label><div class="photos" id="ph_${f.id}"></div></div>`;
      default:
        return `<div class="fld${f.half ? '' : ' full'}" data-k="${k}"><label class="f" for="${id}">${lab}</label><input type="${f.type || 'text'}" id="${id}" data-id="${f.id}"${f.type === 'number' ? ' inputmode="decimal" min="0"' : ''} placeholder="${esc(f.ph || '')}"${f.ac ? ` autocomplete="${f.ac}"` : ''}></div>`;
    }
  }
  const inGrid = f => !['h','note','radio','check','rows','photos','calc'].includes(f.type);
  const form = $('#form');
  let html = '';
  let fk = 0;
  const reg = [];
  steps.forEach((s, si) => {
    html += `<section class="step" data-s="${si}"><h2>${s.h || s.title}</h2>${s.lead ? `<p class="lead">${s.lead}</p>` : ''}`;
    if(s.review) html += `<div id="review"></div><div id="finish"></div><div id="more"></div>`;
    let open = false;
    (s.fields || []).forEach(f => {
      const k = fk++; reg[k] = f;
      if(inGrid(f) && !open){ html += '<div class="grid">'; open = true; }
      if(!inGrid(f) && open){ html += '</div>'; open = false; }
      html += fieldHtml(f, k);
    });
    if(open) html += '</div>';
    html += `<div class="nav"><button type="button" class="btn-s" data-nav="-1">Back</button><button type="button" class="btn-p" data-nav="1">${si === steps.length - 2 ? 'Review' : 'Next'}</button></div></section>`;
  });
  form.insertAdjacentHTML('beforeend', html);
  const secs = [...form.querySelectorAll('section.step')];

  // ---------- rows ----------
  function renderRows(id){
    const f = allFields.find(x => x.id === id), box = document.getElementById('rows_' + id);
    const rows = v[id] = v[id] || [];
    box.innerHTML = rows.map((r, i) => `<div class="rowcard"><div class="rh">${esc(f.rowLabel || 'Item')} ${i + 1}${r[f.cols[0].id] ? ' · ' + esc(labelOf(f.cols[0], r[f.cols[0].id])) : ''}</div><button type="button" class="rm" data-rmrow="${id}" data-i="${i}" aria-label="Remove">&times;</button><div class="rg">` +
      f.cols.map(c => `<div><label>${c.label}</label>${c.opts ? `<select data-row="${id}" data-i="${i}" data-c="${c.id}"><option value=""></option>${optList(c.opts).map(([val, t]) => `<option value="${esc(val)}"${r[c.id] == val ? ' selected' : ''}>${t}</option>`).join('')}</select>` : `<input type="${c.type || 'text'}" ${c.type === 'number' ? 'inputmode="decimal" min="0"' : ''} data-row="${id}" data-i="${i}" data-c="${c.id}" value="${esc(r[c.id] || '')}" placeholder="${esc(c.ph || '')}">`}</div>`).join('') +
      `</div></div>`).join('') || `<div class="hint">None added yet.</div>`;
  }
  // ---------- photos ----------
  function renderPhotos(id){
    const box = document.getElementById('ph_' + id); if(!box) return;
    box.innerHTML = (photos[id] || []).map((p, i) => `<div class="ph"><img src="${p.d}" alt=""><button type="button" class="rm" data-rmph="${id}" data-i="${i}" aria-label="Remove photo">&times;</button><input type="text" data-cap="${id}" data-i="${i}" value="${esc(p.c || '')}" placeholder="Caption"></div>`).join('');
  }
  function shrink(file){
    return new Promise(res => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const m = 1400, s = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .78)); };
      img.onerror = () => { URL.revokeObjectURL(u); res(null); };
      img.src = u;
    });
  }

  // ---------- values ----------
  function labelOf(f, val){
    if(!f.opts) return val;
    const o = optList(f.opts).find(x => String(x[0]) === String(val));
    return o ? String(o[1]).replace(/<[^>]+>/g, '') : val;
  }
  function pull(el){
    const id = el.dataset.id;
    if(el.type === 'checkbox') v[id] = [...el.closest('fieldset').querySelectorAll('input:checked')].map(x => x.value);
    else if(el.type === 'radio'){ if(el.checked) v[id] = el.value; }
    else v[id] = el.value;
    // the same question can live on two exclusive steps; keep the twins in step
    form.querySelectorAll(`[data-id="${id}"]`).forEach(o => { if(o === el) return; if(o.type === 'checkbox') o.checked = (v[id] || []).includes(o.value); else if(o.type === 'radio') o.checked = v[id] === o.value; else o.value = v[id] == null ? '' : v[id]; });
    const f = allFields.find(x => x.id === id);
    if(f && f.visit) EAVisit.save({[f.visit]: v[id]});
  }
  function push(){
    form.querySelectorAll('[data-id]').forEach(el => {
      const val = v[el.dataset.id];
      if(el.type === 'checkbox') el.checked = Array.isArray(val) && val.includes(el.value);
      else if(el.type === 'radio') el.checked = val === el.value;
      else el.value = val == null ? '' : val;
    });
    allFields.filter(f => f.type === 'rows').forEach(f => renderRows(f.id));
    allFields.filter(f => f.type === 'photos').forEach(f => renderPhotos(f.id));
  }
  const vis = (x) => !x.show || !!x.show(v);
  const visSteps = () => steps.map((s, i) => i).filter(i => vis(steps[i]));

  function update(){
    form.querySelectorAll('.fld[data-k]').forEach(el => { const f = reg[+el.dataset.k]; el.hidden = !vis(f); if(f.type === 'calc' && !el.hidden){ const h = f.html(v); el.innerHTML = h || ''; el.hidden = !h; } });
    form.querySelectorAll('.grid').forEach(g => { g.hidden = ![...g.children].some(c => !c.hidden); });
    tabs();
    if(steps[st.cur].review) review();
    save();
  }
  function tabs(){
    const vs = visSteps(), pos = Math.max(0, vs.indexOf(st.cur));
    $('#tabs').innerHTML = vs.map(i => `<button type="button" data-go="${i}" class="${i === st.cur ? 'on' : ''}">${steps[i].title}</button>`).join('');
    $('#barFill').style.width = ((pos + 1) / vs.length * 100) + '%';
    $('#stepCount').textContent = `Step ${pos + 1} of ${vs.length}`;
    secs.forEach((s, i) => { const b = s.querySelector('[data-nav="-1"]'); b.style.visibility = vs.indexOf(i) > 0 ? 'visible' : 'hidden'; const n = s.querySelector('[data-nav="1"]'); n.style.display = steps[i].review ? 'none' : ''; });
  }
  function go(i, scroll){
    if(!steps[i] || !vis(steps[i])) i = visSteps()[0];
    st.cur = i;
    secs.forEach((s, j) => s.classList.toggle('active', j === i));
    update();
    if(scroll !== false) form.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  }

  // ---------- review ----------
  function answers(){
    const out = [];
    steps.forEach(s => {
      if(s.review || !vis(s)) return;
      const rows = [];
      (s.fields || []).forEach(f => {
        if(!vis(f) || !f.id || ['h','note','calc'].includes(f.type)) return;
        const val = v[f.id], lab = (f.short || f.label || '').replace(/<[^>]+>/g, '');
        if(f.type === 'photos'){ const n = (photos[f.id] || []).length; if(n) rows.push([lab, n + ' photo' + (n > 1 ? 's' : '')]); return; }
        if(f.type === 'rows'){ (val || []).forEach((r, i) => { const t = f.cols.map(c => r[c.id] ? `${c.short || c.label}: ${labelOf(c, r[c.id])}${c.unit ? ' ' + c.unit : ''}` : '').filter(Boolean).join(' · '); if(t) rows.push([`${f.rowLabel || 'Item'} ${i + 1}`, t]); }); return; }
        if(val == null || val === '' || (Array.isArray(val) && !val.length)) return;
        const t = Array.isArray(val) ? val.map(x => labelOf(f, x)).join(', ') : labelOf(f, val) + (f.unit ? ' ' + f.unit : '');
        rows.push([lab, t]);
      });
      if(rows.length) out.push({title: s.title, rows});
    });
    return out;
  }
  function mats(){
    const R = P.review(v, {photos: id => (photos[id] || []).length});
    const groups = (R.mats || []).map(g => ({cat: g.cat, items: g.items.filter(Boolean).map(i => Object.assign({}, i, {qty: (i.key in st.over) ? st.over[i.key] : i.qty}))}));
    if(st.extra.length) groups.push({cat: 'Added on site', items: st.extra.map((e, i) => Object.assign({key: 'x' + i, extra: i}, e))});
    return {R, groups};
  }
  const fmtQ = q => (Math.round(q * 10) / 10).toString();
  function review(){
    const {R, groups} = mats();
    const A = answers();
    let h = '';
    if(R.hero && R.hero.length) h += `<div class="result-hero">${R.hero.map(([l, b, s]) => `<div><div class="label">${l}</div><div class="big">${b}</div>${s ? `<div class="sub">${s}</div>` : ''}</div>`).join('')}</div>`;
    if(R.notes && R.notes.length) h += `<ul class="notes">${R.notes.map(([k, t]) => `<li class="${k === 'info' ? 'info' : ''}">${t}</li>`).join('')}</ul>`;
    h += `<div class="group"><h3>Materials takeoff</h3><p class="hint" style="margin:0 0 8px">Starting quantities from your answers. Change any number; set 0 to drop a line.</p><table><thead><tr><th>Qty</th><th></th><th>Item</th></tr></thead><tbody>` +
      (groups.map(g => g.items.length ? `<tr><td colspan="3" style="font-weight:700;color:var(--navy);padding-top:14px">${esc(g.cat)}</td></tr>` + g.items.map(i => `<tr><td class="q"><input type="number" min="0" step="any" inputmode="decimal" value="${fmtQ(+i.qty || 0)}" ${i.extra !== undefined ? `data-xq="${i.extra}"` : `data-mq="${esc(i.key)}"`} aria-label="Quantity"></td><td class="u">${esc(i.unit || 'ea')}</td><td><b>${esc(i.name)}</b>${i.spec ? `<span class="spec">${esc(i.spec)}</span>` : ''}</td></tr>`).join('') : '').join('') || `<tr><td colspan="3" class="hint">Nothing yet. Answer the scope questions or add items below.</td></tr>`) +
      `</tbody></table><div class="addrow"><input type="text" id="xName" placeholder="Item"><input type="text" id="xSpec" placeholder="Size / spec"><input type="number" id="xQty" placeholder="Qty" min="0" inputmode="decimal"><input type="text" id="xUnit" placeholder="Unit"><button type="button" class="btn-s" id="xAdd">Add</button></div></div>`;
    h += A.map(g => `<div class="group"><h3>${esc(g.title)}</h3><table class="kv"><tbody>${g.rows.map(([k, t]) => `<tr><td>${esc(k)}</td><td>${esc(t)}</td></tr>`).join('')}</tbody></table></div>`).join('');
    let more = `<div class="send"><h3>Other ways to share</h3>
      <div class="toolbar"><button type="button" class="btn-s" id="copyBtn">Copy report</button><button type="button" class="btn-s" id="dlBtn">Download report</button></div>
      <div class="msg" id="msg"></div>
      <div class="toolbar" style="justify-content:space-between;border-top:1px solid var(--line);padding-top:12px"><a href="index.html" class="btn-s" style="text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;color:var(--ink)">+ Add another project to this visit</a><button type="button" class="btn-s" id="clrBtn">Clear this worksheet</button></div></div>`;
    const keep = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.mq;
    $('#review').innerHTML = h;
    $('#more').innerHTML = more;
    if(keep){ const el = $(`[data-mq="${keep}"]`); if(el){ el.focus(); const n = el.value.length; try{ el.setSelectionRange(n, n); }catch(e){} } }
  }
  function title(){ return `${v.customer || 'Client'} - ${P.title} Site Visit Details`; }
  function reportText(){
    const {R, groups} = mats();
    let t = `${P.title.toUpperCase()} — SITE VISIT\n${new Date().toLocaleDateString()}\n`;
    (R.hero || []).forEach(([l, b, s]) => { t += `${l}: ${String(b).replace(/<[^>]+>/g, '')}${s ? ' (' + String(s).replace(/<[^>]+>/g, '') + ')' : ''}\n`; });
    if(R.notes && R.notes.length) t += '\nNOTES & CHECKS\n' + R.notes.map(n => '- ' + n[1].replace(/<[^>]+>/g, '')).join('\n') + '\n';
    answers().forEach(g => { t += `\n${g.title.toUpperCase()}\n` + g.rows.map(([k, x]) => `${k}: ${x}`).join('\n') + '\n'; });
    t += '\nMATERIALS\n';
    groups.forEach(g => { const it = g.items.filter(i => +i.qty > 0); if(it.length) t += `[${g.cat}]\n` + it.map(i => `${fmtQ(+i.qty)} ${i.unit || 'ea'} — ${i.name}${i.spec ? ' (' + i.spec + ')' : ''}`).join('\n') + '\n'; });
    return t;
  }
  function reportHtml(withPhotos){
    const {R, groups} = mats();
    let o = `<h2>${esc(P.title)} — site visit</h2><p>${esc(new Date().toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}))}</p>`;
    if(R.hero && R.hero.length) o += '<p>' + R.hero.map(([l, b, s]) => `<b>${esc(l)}:</b> ${esc(String(b).replace(/<[^>]+>/g, ''))}${s ? ' — ' + esc(String(s).replace(/<[^>]+>/g, '')) : ''}`).join('<br>') + '</p>';
    if(R.notes && R.notes.length) o += '<h3>Notes &amp; checks</h3><ul>' + R.notes.map(n => `<li>${n[0] === 'info' ? 'ℹ️' : '⚠️'} ${esc(n[1].replace(/<[^>]+>/g, ''))}</li>`).join('') + '</ul>';
    answers().forEach(g => { o += `<h3>${esc(g.title)}</h3><table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse">` + g.rows.map(([k, x]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(x)}</td></tr>`).join('') + '</table>'; });
    o += '<h3>Materials</h3><table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse"><tr><th>Qty</th><th>Unit</th><th>Item</th><th>Size / spec</th></tr>';
    groups.forEach(g => { const it = g.items.filter(i => +i.qty > 0); if(it.length) o += `<tr><td colspan="4"><b>${esc(g.cat)}</b></td></tr>` + it.map(i => `<tr><td>${fmtQ(+i.qty)}</td><td>${esc(i.unit || 'ea')}</td><td>${esc(i.name)}</td><td>${esc(i.spec || '')}</td></tr>`).join(''); });
    o += '</table>';
    const all = Object.values(photos).flat();
    if(withPhotos && all.length) o += '<h3>Photos</h3>' + all.map(p => `<figure style="margin:0 0 14px"><img src="${p.d}" style="max-width:100%;border-radius:8px"><figcaption>${esc(p.c || '')}</figcaption></figure>`).join('');
    else if(all.length) o += `<p><i>${all.length} photo${all.length > 1 ? 's are' : ' is'} in the downloaded report file.</i></p>`;
    o += '<p><i>ElectricAce · 845.299.9635 · electricace.com</i></p>';
    return o;
  }
  function msg(t, k){ const m = $('#msg'); if(!m) return; m.style.display = t ? 'block' : 'none'; m.className = 'msg' + (k ? ' ' + k : ''); m.innerHTML = t || ''; }

  let dlApi = null;
  (async () => { try{ dlApi = await window.claude?.use?.('downloads'); }catch(e){} })();
  async function copy(){
    try{ await navigator.clipboard.writeText(reportText()); msg('Copied. Paste it into Jobber or an email.'); }
    catch(e){ msg('Copy was blocked here. Use Download report instead.', 'err'); }
  }
  async function download(){
    const page = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title())}</title><style>body{font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#1b2430;max-width:860px;margin:0 auto;padding:20px;line-height:1.45}h2{color:#0f1f33;border-bottom:4px solid #eeb500;padding-bottom:8px}h3{color:#17304f;text-transform:uppercase;font-size:14px;letter-spacing:.5px;margin-top:22px}table{width:100%;font-size:14px}td,th{border-color:#dde3ea;text-align:left}</style></head><body>${reportHtml(true)}</body></html>`;
    const name = (title().replace(/[^\w\- ]+/g, '').trim() || 'site-visit') + '.html';
    const blob = new Blob([page], {type: 'text/html'});
    try{
      if(dlApi) await dlApi.save({filename: name, data: blob});
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
      msg('Report saved: ' + esc(name));
    }catch(e){ msg('The download didn\'t go through. Try again, or use Copy report.', 'err'); }
  }

  // ---------- events ----------
  form.addEventListener('input', e => {
    const t = e.target;
    if(t.dataset.id){ pull(t); update(); return; }
    if(t.dataset.row){ const r = v[t.dataset.row][+t.dataset.i]; r[t.dataset.c] = t.value; update(); if(t.tagName === 'SELECT') renderRows(t.dataset.row); return; }
    if(t.dataset.cap){ photos[t.dataset.cap][+t.dataset.i].c = t.value; savePhotos(); return; }
    if(t.dataset.mq){ st.over[t.dataset.mq] = t.value === '' ? 0 : +t.value; save(); return; }
    if(t.dataset.xq){ st.extra[+t.dataset.xq].qty = +t.value || 0; save(); return; }
  });
  form.addEventListener('change', async e => {
    const t = e.target;
    if(t.dataset.id && (t.type === 'radio' || t.type === 'checkbox' || t.tagName === 'SELECT')){ pull(t); update(); }
    if(t.dataset.photos){
      const id = t.dataset.photos; photos[id] = photos[id] || [];
      for(const f of t.files){ const d = await shrink(f); if(d) photos[id].push({d, c: ''}); }
      t.value = ''; renderPhotos(id);
      if(!savePhotos()) document.getElementById('ph_' + id).insertAdjacentHTML('beforeend', '<div class="hint full" style="grid-column:1/-1">Too many photos to keep after this page closes. Send or download the report before leaving.</div>');
    }
  });
  form.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.nav){ const vs = visSteps(), p = vs.indexOf(st.cur) + (+b.dataset.nav); if(vs[p] !== undefined) go(vs[p]); return; }
    if(b.dataset.go){ go(+b.dataset.go); return; }
    if(b.dataset.step){ const id = b.dataset.step; v[id] = Math.max(0, (+v[id] || 0) + (+b.dataset.d)); document.getElementById('f_' + id).value = v[id]; update(); return; }
    if(b.dataset.add){ const f = allFields.find(x => x.id === b.dataset.add); v[f.id] = v[f.id] || []; v[f.id].push(Object.assign({}, f.newRow || {})); renderRows(f.id); update(); return; }
    if(b.dataset.rmrow){ v[b.dataset.rmrow].splice(+b.dataset.i, 1); renderRows(b.dataset.rmrow); update(); return; }
    if(b.dataset.rmph){ photos[b.dataset.rmph].splice(+b.dataset.i, 1); savePhotos(); renderPhotos(b.dataset.rmph); return; }
    if(b.id === 'xAdd'){ const n = $('#xName').value.trim(); if(!n) return; st.extra.push({name: n, spec: $('#xSpec').value.trim(), qty: +$('#xQty').value || 1, unit: $('#xUnit').value.trim() || 'ea'}); update(); return; }
    if(b.id === 'copyBtn') return copy();
    if(b.id === 'dlBtn') return download();
    if(b.id === 'clrBtn'){ $('#modal').classList.add('show'); return; }
  });
  $('#modalNo').onclick = () => $('#modal').classList.remove('show');
  $('#modalYes').onclick = () => { try{ localStorage.removeItem(P.store); localStorage.removeItem(PHK); }catch(e){} location.reload(); };
  form.addEventListener('submit', e => e.preventDefault());

  function finishData(){
    const {groups} = mats();
    const scope = P.summary ? P.summary(v) : '';
    return {
      path: P.title, title: title(), text: reportText(), html: reportHtml(false),
      requestTitle: `${P.title} site visit${scope ? ' — ' + scope : ''}${v.date ? ' (' + v.date + (v.prepby ? ', ' + v.prepby : '') + ')' : ''}`,
      photos: Object.values(photos).flat(),
      materials: groups.flatMap(g => g.items).filter(i => +i.qty > 0).map(i => ({name: i.name, spec: i.spec, qty: +i.qty, unit: i.unit || 'ea'})),
      visit: {customer: v.customer || '', phone: v.phone || '', email: v.email || '', address: v.address || '', date: v.date || '', prepby: v.prepby || ''}
    };
  }
  if(window.EASend) EASend.mount(document.getElementById('finish'), finishData);
  push();
  go(st.cur, false);
  EAVisit.bar(P.id);
};
/* Job info fields every new path starts with; tied to the shared visit. */
window.jobFields = (omit = []) => [
  {id:'customer', label:'Customer', half:true, visit:'customer', ac:'off'},
  {id:'phone', label:'Phone', type:'tel', half:true, visit:'phone'},
  {id:'email', label:'Email', type:'email', half:true, visit:'email'},
  {id:'jobno', label:'Job / request #', half:true, visit:'jobno'},
  {id:'address', label:'Site address', visit:'address', ph:'e.g., 12 Main St, Rhinebeck'},
  {id:'date', label:'Visit date', type:'date', half:true, visit:'date'},
  {id:'prepby', label:'Prepared by', type:'select', half:true, visit:'prepby', opts:['Nick','Rich','Luke','Scott','Mary','Aidan','Lauro']},
  {id:'utility', type:'radio', label:'Utility provider', visit:'utility', opts:['Central Hudson','NYSEG','National Grid','Orange & Rockland',['other','Other']]},
  {id:'meterNo', label:'Meter #', half:true, visit:'meterNo'},
  {id:'yearBuilt', label:'Year built', hint:'approx.', type:'number', half:true, visit:'yearBuilt'},
  {id:'propType', type:'radio', label:'Property type', visit:'propType', opts:[['sfh','Single-family'],['multi','Multi-family'],['condo','Condo / townhouse','HOA may need to approve'],['comm','Light commercial']]},
  {id:'occ', type:'radio', label:'Occupied during the work?', sm:true, opts:[['yes','Yes'],['no','Vacant'],['part','Partly']]}
].filter(f => !omit.includes(f.id));
/* small helpers the path files share */
window.inc = (a, x) => Array.isArray(a) && a.includes(x);
window.num = x => { const n = parseFloat(x); return isFinite(n) ? n : 0; };
