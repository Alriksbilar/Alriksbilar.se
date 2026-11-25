// "Läs också" – visar upp till tre andra artiklar, de mest närliggande först.
// Poäng: samma märke 3, samma ämne 1, samma kategori 1. Lika poäng: nyast först.
// Märken/ämnen kommer från fälten "marken" och "amnen" i artiklar.json; saknas
// "marken" letas kända märken upp i rubrik och ingress.
(() => {
  const mal = document.getElementById('relaterat');
  if (!mal) return;
  const slug = location.pathname.split('/').filter(Boolean)[1];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const datum = d => new Date(d).toLocaleDateString('sv-SE', {day:'numeric', month:'long', year:'numeric'});
  const KANDA = ['Volvo','Polestar','Geely','Lynk','Zeekr','BMW','Mini','Mercedes','Audi','Volkswagen','VW','Skoda','Seat','Cupra','Porsche',
    'Toyota','Lexus','Kia','Hyundai','Tesla','BYD','MG','Leapmotor','Xpeng','Nio','Renault','Dacia','Peugeot','Citroën','Opel','Fiat',
    'Ford','Nissan','Honda','Mazda','Subaru','Suzuki','Jaguar','Land Rover','Bentley','Ferrari','Lamborghini','Koenigsegg'];
  const sma = a => (a || []).map(x => String(x).toLowerCase());
  const marken = a => {
    if (Array.isArray(a.marken)) return sma(a.marken);
    const t = `${a.rubrik} ${a.ingress}`;
    return sma(KANDA.filter(m => new RegExp(`(^|[^\\wåäö])${m}([^\\wåäö]|$)`, 'i').test(t)));
  };
  fetch('/artiklar.json').then(r => r.json()).then(d => {
    const alla = d.artiklar || [];
    const denna = alla.find(a => a.slug === slug) || {};
    const dm = marken(denna), da = sma(denna.amnen);
    const poang = a => {
      const m = marken(a).filter(x => dm.includes(x)).length;
      const t = sma(a.amnen).filter(x => da.includes(x)).length;
      return m * 3 + t + (a.kategori && a.kategori === denna.kategori ? 1 : 0);
    };
    const urval = alla.filter(a => a.slug !== slug)
      .map(a => ({a, p: poang(a)}))
      .sort((x, y) => y.p - x.p || String(y.a.datum).localeCompare(String(x.a.datum)))
      .slice(0, 3).map(x => x.a);
    if (!urval.length) return;
    mal.innerHTML = `<h2>Läs också</h2><div class="art-lista">${urval.map(a => `
      <a class="art-kort" href="/artiklar/${esc(a.slug)}/">
        <img src="${esc(a.bild)}" alt="" loading="lazy">
        <div class="ak"><div class="ad">${datum(a.datum)} · ${esc(a.kategori)}</div><h3>${esc(a.rubrik)}</h3><p>${esc(a.ingress)}</p></div>
      </a>`).join('')}</div>`;
  }).catch(() => {});
})();
