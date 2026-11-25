/* "Finish this visit": sends the worksheet to the office through Web3Forms.
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
      sending = true; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Sending…'; say('');
      try{
        let photoNote = '';
        const photos = (d.photos || []).map(p => ({blob: p.blob || blobOf(p.d), name: p.c || 'photo'})).filter(p => p.blob);
        if(photos.length){
          try{
            const fd = new FormData(); Object.entries(fields).forEach(([k, x]) => fd.append(k, x));
            let total = 0, k = 0;
            photos.forEach((p, i) => { if(total + p.blob.size < 4.8e6){ total += p.blob.size; k++; fd.append('attachment' + (i + 1), p.blob, (p.name || 'photo').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 40) + '-' + (i + 1) + '.jpg'); } });
            await post(fd, true);
            photoNote = k < photos.length ? ` ${k} of ${photos.length} photos attached (size limit); download the report for the rest.` : ` ${k} photo${k > 1 ? 's' : ''} attached.`;
          }catch(e1){
            await post(JSON.stringify(Object.assign({}, fields, {'Photos': photos.length + ' taken (not attached); download the report to send them'})), false);
            photoNote = ' Photos couldn\'t be attached; use Download report to send them.';
          }
        } else await post(JSON.stringify(fields), false);
        say('✅ Sent to the office.' + esc(photoNote));
        btn.textContent = 'Sent'; sending = false; return;
      }catch(e){
        const href = 'mailto:' + OFFICE + '?subject=' + encodeURIComponent(d.title) + '&body=' + encodeURIComponent(text.slice(0, 1800) + (text.length > 1800 ? '\n\n(Report continues; full copy attached or pasted.)' : ''));
        say(`Couldn't reach the office form${navigator.onLine === false ? ' (no signal)' : ''}. Try again when you have signal, or <a href="${esc(href)}">email it instead</a> to ${esc(OFFICE)}. Use <b>Copy report</b> or <b>Download report</b> to include the full version.`, true);
      }
      sending = false; btn.disabled = false; btn.textContent = 'Send to the office';
    });
    return box;
  }
  return {mount};
})();
