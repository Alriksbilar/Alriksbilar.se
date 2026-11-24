"""Uppdaterar sökmotordata för alriksbilar.se.

Kör från sajtens rotmapp:  python3 verktyg/seo.py

- Skriver om sitemap.xml utifrån artiklar.json
- Lägger in/uppdaterar strukturerad data (JSON-LD) på startsidan, artikellistan,
  privatleasingsidan och varje artikel som finns i artiklar.json
Skriptet går att köra hur många gånger som helst; det ersätter bara blocket
<script type="application/ld+json" id="seo-data">…</script>.
"""
import json, re, html, pathlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://alriksbilar.se"
IDAG = datetime.date.today().isoformat()

PERSON = {
    "@type": "Person", "@id": SITE + "/#alrik", "name": "Alrik Söderlind",
    "url": SITE + "/", "image": SITE + "/img/bakom-kameran.jpg",
    "jobTitle": "Bilskribent och youtubare",
    "description": "Bilskribent sedan 1980-talet: biltestare på Teknikens Värld och 30 år på auto motor & sport, varav 25 som chefredaktör. Driver sedan 2024 YouTube-kanalen Alriks Bilar.",
    "sameAs": [
        "https://www.youtube.com/@alriksbilar",
        "https://www.youtube.com/@AlriksCars",
        "https://www.instagram.com/alriksoderlind",
        "https://www.linkedin.com/in/alrik-s%C3%B6derlind-9759b028/",
    ],
}
ORG = {
    "@type": "Organization", "@id": SITE + "/#kanal", "name": "Alriks Bilar", "url": SITE + "/",
    "logo": {"@type": "ImageObject", "url": SITE + "/img/logo-alriks-bilar.png"},
    "founder": {"@id": PERSON["@id"]},
    "sameAs": ["https://www.youtube.com/@alriksbilar", "https://www.youtube.com/@AlriksCars",
               "https://www.instagram.com/alriksoderlind"],
}
WEBSITE = {"@type": "WebSite", "@id": SITE + "/#webbplats", "url": SITE + "/", "name": "Alriks Bilar",
           "inLanguage": "sv-SE", "publisher": {"@id": ORG["@id"]}}


def meta(s, namn):
    m = re.search(r'<meta (?:name|property)="%s" content="([^"]*)"' % re.escape(namn), s)
    return html.unescape(m.group(1)) if m else ""


def brodsmulor(*steg):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(steg)]}


def skriv_jsonld(fil, graf):
    s = fil.read_text(encoding="utf-8")
    block = '<script type="application/ld+json" id="seo-data">%s</script>' % json.dumps(
        {"@context": "https://schema.org", "@graph": graf}, ensure_ascii=False)
    s = re.sub(r'<script type="application/ld\+json"[^>]*>.*?</script>\n?', "", s, flags=re.S)
    s = s.replace("</head>", block + "\n</head>", 1)
    fil.write_text(s, encoding="utf-8")


artiklar = json.loads((ROOT / "artiklar.json").read_text(encoding="utf-8"))["artiklar"]

# Startsidan
skriv_jsonld(ROOT / "index.html", [WEBSITE, ORG, PERSON])

# Artiklar
for a in artiklar:
    fil = ROOT / "artiklar" / a["slug"] / "index.html"
    if not fil.exists():
        continue
    s = fil.read_text(encoding="utf-8")
    url = f"{SITE}/artiklar/{a['slug']}/"
    bild = meta(s, "og:image") or SITE + a["bild"]
    art = {
        "@type": "Article", "@id": url + "#artikel", "headline": a["rubrik"],
        "description": meta(s, "description") or a["ingress"], "image": [bild],
        "datePublished": a["datum"], "dateModified": a.get("uppdaterad", a["datum"]),
        "inLanguage": "sv-SE", "articleSection": a["kategori"], "mainEntityOfPage": url,
        "author": {"@id": PERSON["@id"], "@type": "Person", "name": PERSON["name"], "url": PERSON["url"]},
        "publisher": {"@id": ORG["@id"]},
    }
    graf = [art]
    if a.get("film"):
        vid = a["film"]
        graf.append({
            "@type": "VideoObject", "@id": url + "#film", "name": a["rubrik"], "description": a["ingress"],
            "thumbnailUrl": [f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg", f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"],
            "uploadDate": a.get("filmdatum", a["datum"]), "embedUrl": f"https://www.youtube-nocookie.com/embed/{vid}",
            "contentUrl": f"https://www.youtube.com/watch?v={vid}", "inLanguage": "sv-SE",
            "author": {"@id": PERSON["@id"]}, "publisher": {"@id": ORG["@id"]},
        })
        art["video"] = {"@id": url + "#film"}
    graf += [brodsmulor(("Alriks Bilar", SITE + "/"), ("Artiklar", SITE + "/artiklar/"), (a["rubrik"], url)), ORG, PERSON]
    skriv_jsonld(fil, graf)

# Artikellistan
lista = ROOT / "artiklar" / "index.html"
skriv_jsonld(lista, [
    {"@type": "CollectionPage", "@id": SITE + "/artiklar/", "url": SITE + "/artiklar/", "name": "Artiklar – Alriks Bilar",
     "inLanguage": "sv-SE", "isPartOf": {"@id": WEBSITE["@id"]},
     "mainEntity": {"@type": "ItemList", "itemListElement": [
         {"@type": "ListItem", "position": i + 1, "url": f"{SITE}/artiklar/{a['slug']}/", "name": a["rubrik"]}
         for i, a in enumerate(artiklar)]}},
    brodsmulor(("Alriks Bilar", SITE + "/"), ("Artiklar", SITE + "/artiklar/")), WEBSITE, ORG])
# Vanliga länkar för sökmotorer som inte kör JavaScript
s = lista.read_text(encoding="utf-8")
lankar = "".join(f'<li><a href="/artiklar/{a["slug"]}/">{html.escape(a["rubrik"])}</a></li>' for a in artiklar)
ny = f'<noscript id="seo-lankar"><ul>{lankar}</ul></noscript>'
s = re.sub(r'<noscript id="seo-lankar">.*?</noscript>', ny, s, flags=re.S) if 'id="seo-lankar"' in s else s.replace("</body>", ny + "\n</body>", 1)
lista.write_text(s, encoding="utf-8")

# Privatleasing
skriv_jsonld(ROOT / "privatleasing" / "index.html", [
    {"@type": "WebPage", "@id": SITE + "/privatleasing/", "url": SITE + "/privatleasing/",
     "name": "Billigast att privatleasa – på riktigt", "inLanguage": "sv-SE", "dateModified": IDAG,
     "isPartOf": {"@id": WEBSITE["@id"]}, "author": {"@id": PERSON["@id"]}},
    brodsmulor(("Alriks Bilar", SITE + "/"), ("Privatleasing", SITE + "/privatleasing/")), WEBSITE, ORG, PERSON])

# Sitemap
senast = max(a["datum"] for a in artiklar)
rader = [f"  <url><loc>{SITE}/</loc><lastmod>{IDAG}</lastmod></url>",
         f"  <url><loc>{SITE}/artiklar/</loc><lastmod>{senast}</lastmod></url>",
         f"  <url><loc>{SITE}/privatleasing/</loc><lastmod>{IDAG}</lastmod></url>"]
for a in artiklar:
    bild = f"\n    <image:image><image:loc>{SITE}{a['bild']}</image:loc></image:image>" if a.get("bild") else ""
    rader.append(f"  <url><loc>{SITE}/artiklar/{a['slug']}/</loc><lastmod>{a.get('uppdaterad', a['datum'])}</lastmod>{bild}</url>")
(ROOT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + "\n".join(rader) + "\n</urlset>\n",
    encoding="utf-8")
print(f"Klart: {len(artiklar)} artiklar, sitemap och strukturerad data uppdaterade.")
