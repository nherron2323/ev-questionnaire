/* "Finish this visit": sends the worksheet to the office through Web3Forms.
   Every send attaches the report as its own PDF plus every photo; if they don't fit in one
   Web3Forms submission (~5 MB), the photos continue in extra submissions ("photos 2 of 3").
   Attachments need an active Web3Forms Pro plan on the access key below.
   Meant to run on electricace.com, where the page can reach api.web3forms.com. */
window.EASend = (function(){
  const OFFICE = 'sitevisits@electricace.com';
  const W3F_KEY = '6f6e872b-b34d-487d-ad10-d4fd262dc2c5';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CSS = `
  .eas{margin-top:26px;background:#f8fafc;border:1px solid #dde3ea;border-radius:14px;padding:20px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b2430;text-align:left}
  .eas *{box-sizing:border-box;min-width:0}
  .eas h3{margin:0 0 4px;font-size:18px}.eas .lead{color:#5d6b7c;font-size:14px;margin:0 0 14px}
  .eas label.l{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
  .eas textarea{width:100%;min-height:80px;padding:10px 12px;border:1.5px solid #dde3ea;border-radius:10px;font:inherit;font-size:16px;resize:vertical;background:#fff;color:#1b2430}
  .eas textarea:focus{outline:none;border-color:#eeb500;box-shadow:0 0 0 3px rgba(238,181,0,.2)}
  .eas .go{font:inherit;font-weight:700;border:0;border-radius:10px;padding:14px 22px;cursor:pointer;background:#eeb500;color:#1b1404;min-height:48px;width:100%;font-size:16px;margin-top:12px}
  .eas .go:hover{background:#d39f00}.eas .go:disabled{opacity:.6;cursor:default}
  .eas .go:focus-visible{outline:3px solid rgba(238,181,0,.55);outline-offset:2px}
  .eas .msg{display:none;margin-top:12px;font-size:14px;border-radius:10px;padding:10px 12px;background:#e9f8f1;color:#145c40}
  .eas .msg.err{background:#fdecea;color:#9a2a1a}.eas .msg a{color:inherit;font-weight:700}
  .eas .hint{color:#5d6b7c;font-size:12.5px}
  .eas .spin{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:easr .8s linear infinite;vertical-align:-2px;margin-right:8px}
  @keyframes easr{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.eas .spin{animation:none}}`;

  async function post(body, isForm){
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), isForm ? 45000 : 15000);
    const res = await fetch('https://api.web3forms.com/submit', {method:'POST', ...(isForm ? {} : {headers:{'Content-Type':'application/json', Accept:'application/json'}}), body, signal: ctrl.signal});
    clearTimeout(t);
    const j = await res.json().catch(() => ({}));
    if(!res.ok || j.success === false) throw new Error(j.message || 'HTTP ' + res.status);
    return j;
  }
  function blobOf(dataUrl){
    try{ const [h, b] = dataUrl.split(','); const bin = atob(b); const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], {type: (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg'}); }catch(e){ return null; }
  }

  /* ---------- attachments ---------- */
  // Web3Forms takes about 5 MB per submission, so photos are packed into as many submissions as needed.
  const BUDGET = 4.4e6;
  const safeName = s => (String(s || 'file').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60)) || 'file';
  async function toBlob(p){
    if(p.blob) return p.blob;
    if(p.d) return blobOf(p.d);
    if(p.url){ try{ const r = await fetch(p.url); if(r.ok) return await r.blob(); }catch(e){} }
    return null;
  }
  // Re-encode a photo as a JPEG no wider/taller than max px.
  function shrinkBlob(blob, max, q){
    return new Promise(res => {
      const u = URL.createObjectURL(blob), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); c.toBlob(b => res(b && b.size < blob.size ? b : blob), 'image/jpeg', q);
      };
      img.onerror = () => { URL.revokeObjectURL(u); res(blob); };
      img.src = u;
    });
  }
  async function gatherFiles(d){
    const out = [], list = (d.photos || []).slice();
    for(const x of (d.extra || [])){ try{ const r = typeof x === 'function' ? await x() : x; if(r) list.push(r); }catch(e){} }
    let i = 0;
    for(const p of list){
      let b = await toBlob(p); if(!b) continue;
      const png = (p.type || b.type) === 'image/png';
      if(!png && b.size > 900e3) b = await shrinkBlob(b, 1600, 0.8);
      i++; out.push({blob: b, name: String(i).padStart(2, '0') + '-' + safeName(p.c || p.name || 'photo') + (png ? '.png' : '.jpg')});
    }
    return out;
  }

  /* ---------- report PDF (jsPDF) ---------- */
  const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  let pdfLib = null;
  function loadPdf(){
    if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if(pdfLib) return pdfLib;
    pdfLib = new Promise((res, rej) => {
      const sc = document.createElement('script'); sc.src = JSPDF; sc.async = true;
      sc.onload = () => window.jspdf ? res(window.jspdf.jsPDF) : rej(new Error('jsPDF missing'));
      sc.onerror = () => { pdfLib = null; sc.remove(); rej(new Error('jsPDF failed to load')); };
      document.head.appendChild(sc);
    });
    return pdfLib;
  }
  // The built-in PDF font only covers Latin-1, so swap out symbols it can't draw.
  const SUBS = {'—':'-','–':'-','‘':"'",'’':"'",'“':'"','”':'"','…':'...','•':'-','·':'-','→':'->','←':'<-','≤':'<=','≥':'>=','≈':'~','✓':'[x]','✔':'[x]','✅':'[x]','☐':'[ ]','☑':'[x]','✗':'x','❌':'x','⚠':'!','′':"'",'″':'"',' ':' '};
  const latin = s => String(s == null ? '' : s).replace(/[^\x00-\xff]/gu, c => SUBS[c] != null ? SUBS[c] : '').replace(/\r/g, '');
  async function reportPdf(d, text){
    const jsPDF = await loadPdf();
    const doc = new jsPDF({unit: 'pt', format: 'letter'}), W = 612, H = 792, M = 48, CW = W - M * 2;
    const v = d.visit || {};
    let y = 0, page = 1;
    const head = () => {
      doc.setFillColor(15, 31, 51); doc.rect(0, 0, W, 64, 'F');
      doc.setFillColor(238, 181, 0); doc.rect(0, 64, W, 4, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('ElectricAce', M, 30);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(latin('Site visit report - ' + (d.path || '')), M, 47);
      doc.text('845.299.9635 - electricace.com', W - M, 47, {align: 'right'});
      doc.setTextColor(27, 36, 48); y = 92;
    };
    const foot = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(93, 107, 124); doc.text(latin(d.title || ''), M, H - 24); doc.text('Page ' + page, W - M, H - 24, {align: 'right'}); doc.setTextColor(27, 36, 48); };
    const room = h => { if(y + h > H - 48){ foot(); doc.addPage(); page++; head(); } };
    head();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.splitTextToSize(latin(d.title || 'Site visit'), CW).forEach(l => { room(20); doc.text(l, M, y); y += 19; });
    y += 4; doc.setFontSize(10);
    [['Customer', v.customer], ['Service address', v.address], ['Phone', v.phone], ['Email', v.email], ['Visit date', v.date], ['Prepared by', v.prepby]]
      .filter(r => r[1]).forEach(([k, x]) => { room(15); doc.setFont('helvetica', 'bold'); doc.text(k + ':', M, y); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(latin(x), CW - 100)[0], M + 100, y); y += 14; });
    y += 6; doc.setDrawColor(221, 227, 234); doc.line(M, y, W - M, y); y += 18;
    for(const raw of latin(text).split('\n')){
      const line = raw.replace(/\s+$/, '');
      if(!line.trim()){ y += 7; continue; }
      const isHead = /^[^a-z]{3,}$/.test(line.trim()) && /[A-Z]/.test(line) && line.trim().length < 70;
      const isRule = /^[=\-_*]{4,}$/.test(line.trim());
      if(isRule){ room(10); doc.line(M, y - 4, W - M, y - 4); y += 6; continue; }
      if(isHead){ y += 4; room(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(15, 31, 51); doc.text(line.trim(), M, y); y += 5; doc.setDrawColor(238, 181, 0); doc.line(M, y, M + 40, y); doc.setDrawColor(221, 227, 234); y += 13; doc.setTextColor(27, 36, 48); continue; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const ind = (line.match(/^\s*/) || [''])[0].length * 4;
      doc.splitTextToSize(line.trim(), CW - ind).forEach(l => { room(14); doc.text(l, M + ind, y); y += 13.5; });
    }
    foot();
    return doc.output('blob');
  }
  let n = 0;
  function mount(anchor, getData, opts){
    opts = opts || {};
    if(!document.getElementById('easCss')){ const st = document.createElement('style'); st.id = 'easCss'; st.textContent = CSS; document.head.appendChild(st); }
    const id = 'easNote' + (++n);
    const box = document.createElement('div'); box.className = 'eas';
    box.innerHTML = `<h3>Finish this visit</h3><p class="lead">Sends everything on this worksheet to the office (${esc(OFFICE)}).</p>
      <label class="l" for="${id}">Note for the office <span class="hint">(optional)</span></label>
      <textarea id="${id}" placeholder="Anything the estimator should know first"></textarea>
      <button type="button" class="go">Send to the office</button>
      <div class="msg" role="status"></div>`;
    if(opts.before) anchor.parentNode.insertBefore(box, anchor); else if(opts.after) anchor.insertAdjacentElement('afterend', box); else anchor.appendChild(box);
    const btn = box.querySelector('.go'), msg = box.querySelector('.msg'), note = box.querySelector('textarea');
    const say = (h, err) => { msg.style.display = h ? 'block' : 'none'; msg.className = 'msg' + (err ? ' err' : ''); msg.innerHTML = h || ''; };
    let sending = false;
    btn.addEventListener('click', async () => {
      if(sending) return;
      const d = getData(), v = d.visit;
      const text = (note.value.trim() ? 'NOTE FROM THE INSTALLER\n' + note.value.trim() + '\n\n' : '') + d.text;
      const fields = {
        access_key: W3F_KEY, subject: d.title, from_name: 'ElectricAce site visit · ' + d.path,
        name: v.customer || '—', email: v.email || OFFICE, replyto: v.email || OFFICE, phone: v.phone || '—',
        'Project': d.path, 'Service address': v.address || '—', 'Visit date': v.date || '—', 'Prepared by': v.prepby || '—',
        message: text, botcheck: ''
      };
      sending = true; btn.disabled = true; say('');
      const busy = t => { btn.innerHTML = '<span class="spin"></span>' + esc(t); };
      try{
        busy('Preparing report PDF…');
        const pdfName = safeName((v.customer || 'Client') + ' ' + d.path + ' Site Visit Report') + '.pdf';
        let report;
        try{ report = {blob: await reportPdf(d, text), name: pdfName}; }
        catch(e0){ try{ pdfLib = null; report = {blob: await reportPdf(d, text), name: pdfName}; }catch(e1){ throw new Error('pdf'); } }

        busy('Preparing photos…');
        let files = await gatherFiles(d);
        // Any single photo too big for one submission gets squeezed until it fits.
        for(const f of files){ let q = 0.72, m = 1400; while(f.blob.size > BUDGET - report.blob.size && m >= 600){ f.blob = await shrinkBlob(f.blob, m, q); m -= 200; q -= 0.06; } }

        // Pack: submission 1 = report PDF + as many photos as fit; then more submissions for the rest.
        const batches = [[report]]; let room = BUDGET - report.blob.size;
        for(const f of files){
          if(f.blob.size <= room){ batches[batches.length - 1].push(f); room -= f.blob.size; }
          else { batches.push([f]); room = BUDGET - f.blob.size; }
        }
        const N = batches.length, nPhotos = files.length;
        let pn = 0;
        for(let b = 0; b < N; b++){
          busy(N > 1 ? `Sending ${b + 1} of ${N}…` : 'Sending…');
          const fd = new FormData();
          const f2 = b === 0 ? Object.assign({}, fields, {'Attachments': `Report PDF + ${nPhotos} photo${nPhotos === 1 ? '' : 's'}` + (N > 1 ? ` across ${N} emails` : '')})
            : Object.assign({}, fields, {subject: `${d.title} (photos ${b + 1} of ${N})`, message: `More photos for ${d.title}. The report PDF is attached to email 1 of ${N}.`});
          if(N > 1 && b === 0) f2.subject = `${d.title} (1 of ${N})`;
          Object.entries(f2).forEach(([k, x]) => fd.append(k, x));
          batches[b].forEach(f => fd.append(f === report ? 'report_pdf' : 'photo_' + (++pn), f.blob, f.name));
          let tries = 0;
          for(;;){ try{ await post(fd, true); break; }catch(err){ if(++tries >= 2 || (navigator.onLine === false)) throw Object.assign(err, {part: b + 1, of: N}); await new Promise(r => setTimeout(r, 2500)); } }
        }
        say('✅ Sent to the office with the report PDF' + (nPhotos ? ` and ${nPhotos} photo${nPhotos > 1 ? 's' : ''}` : '') + (N > 1 ? ` (${N} emails, so every photo fits)` : '') + '.');
        btn.textContent = 'Sent'; sending = false; return;
      }catch(e){
        if(e && e.message === 'pdf'){
          say('Couldn\'t build the report PDF (the PDF tool didn\'t load; this usually means no signal). Nothing was sent. Press <b>Send to the office</b> again when you have signal.', true);
          sending = false; btn.disabled = false; btn.textContent = 'Send to the office'; return;
        }
        if(e && e.part > 1){
          say(`Email 1${e.part > 2 ? '–' + (e.part - 1) : ''} of ${e.of} went through, but the rest of the photos didn't. Press <b>Send to the office</b> again when you have signal (the office may get the first part twice), or text the remaining photos to 845.299.9635.`, true);
          sending = false; btn.disabled = false; btn.textContent = 'Send to the office'; return;
        }
        const href = 'mailto:' + OFFICE + '?subject=' + encodeURIComponent(d.title) + '&body=' + encodeURIComponent(text.slice(0, 1800) + (text.length > 1800 ? '\n\n(Report continues; full copy attached or pasted.)' : ''));
        say(`Couldn't reach the office form${navigator.onLine === false ? ' (no signal)' : ''}. Try again when you have signal, or <a href="${esc(href)}">email it instead</a> to ${esc(OFFICE)}. Use <b>Copy report</b> or <b>Download report</b> to include the full version.`, true);
      }
      sending = false; btn.disabled = false; btn.textContent = 'Send to the office';
    });
    return box;
  }
  return {mount};
})();
