// "Läs också" – visar upp till tre andra artiklar, samma kategori först.
(() => {
  const mal = document.getElementById('relaterat');
  if (!mal) return;
  const slug = location.pathname.split('/').filter(Boolean)[1];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const datum = d => new Date(d).toLocaleDateString('sv-SE', {day:'numeric', month:'long', year:'numeric'});
  fetch('/artiklar.json').then(r => r.json()).then(d => {
    const alla = d.artiklar || [];
    const denna = alla.find(a => a.slug === slug);
    const ovriga = alla.filter(a => a.slug !== slug);
    const kat = denna ? denna.kategori : null;
    const urval = [...ovriga.filter(a => a.kategori === kat), ...ovriga.filter(a => a.kategori !== kat)].slice(0, 3);
    if (!urval.length) return;
    mal.innerHTML = `<h2>Läs också</h2><div class="art-lista">${urval.map(a => `
      <a class="art-kort" href="/artiklar/${esc(a.slug)}/">
        <img src="${esc(a.bild)}" alt="" loading="lazy">
        <div class="ak"><div class="ad">${datum(a.datum)} · ${esc(a.kategori)}</div><h3>${esc(a.rubrik)}</h3><p>${esc(a.ingress)}</p></div>
      </a>`).join('')}</div>`;
  }).catch(() => {});
})();
