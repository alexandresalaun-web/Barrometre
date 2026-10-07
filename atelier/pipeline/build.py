#!/usr/bin/env python3
"""Assemble l'application.
  artifact/index.html : contenu de page pour la publication dans Claude (tout embarqué, aucune requête sortante)
  site/               : application web installable (index.html, sw.js, manifeste, icônes, etude.html, d/)
  work/art/           : copie d'essai de la version Claude, avec le squelette que la publication ajoute
Usage : build.py [police]   (police : une clé de POLICES ; « plex », IBM Plex Sans, choisie par Alex le 6 octobre 2026)"""
import base64, io, json, pathlib, re, sys, hashlib
from PIL import Image, ImageDraw
RACINE = pathlib.Path(__file__).resolve().parent.parent
SRC = RACINE.parent / "barrometre-src"
RES = RACINE / "ressources"          # dossier autonome (dépôt GitHub) : les quelques fichiers tiers nécessaires, sans node_modules
G = RACINE / "gabarit"
NM = RACINE / "polices/node_modules"
lis = lambda p: pathlib.Path(p).read_text(encoding="utf-8")

def face(nom, chemin, graisses, base=NM):
    local = RES / pathlib.Path(chemin).name
    b = base64.b64encode((local if local.exists() else base / chemin).read_bytes()).decode()
    return f'@font-face{{font-family:"{nom}";font-style:normal;font-weight:{graisses};font-display:swap;src:url(data:font/woff2;base64,{b}) format("woff2")}}\n'
def statique(nom, paquet, fichier, graisses=(400, 500, 600, 700)):
    return "".join(face(nom, f"@fontsource/{paquet}/files/{fichier}-latin-{g}-normal.woff2", g) for g in graisses)
# clé : (libellé, familles du texte, familles des titres, fonction qui rend les @font-face)
POLICES = {
    "systeme": ("Police du téléphone", "", "", lambda: ""),
    "roboto": ("Roboto", '"Roboto",', '"Roboto",', lambda: face("Roboto", "@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2", "100 900")),
    "plex": ("IBM Plex Sans", '"IBM Plex Sans",', '"IBM Plex Sans",', lambda: face("IBM Plex Sans", "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2", "100 700")),
    "barlow": ("Barlow", '"Barlow",', '"Barlow Semi Condensed","Barlow",', lambda: statique("Barlow", "barlow", "barlow") + statique("Barlow Semi Condensed", "barlow-semi-condensed", "barlow-semi-condensed", (600, 700))),
    "source": ("Source Sans 3", '"Source Sans 3",', '"Source Sans 3",', lambda: face("Source Sans 3", "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2", "200 900")),
    "fira": ("Fira Sans", '"Fira Sans",', '"Fira Sans",', lambda: statique("Fira Sans", "fira-sans", "fira-sans")),
    "figtree": ("Figtree", '"Figtree",', '"Figtree",', lambda: face("Figtree", "@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2", "300 900")),
}
sur = lambda s: s.replace("</script", "<\\/script").replace("<!--", "<\\!--")
index = lis(RACINE / "site/d/index.json").replace("</", "<\\/")
quagga = sur(lis(RES / "quagga.min.js" if (RES / "quagga.min.js").exists() else SRC / "lib/node_modules/@ericblade/quagga2/dist/quagga.min.js"))
moteur = sur(lis(RACINE / "pipeline/moteur.js"))
app = "\n".join(lis(G / f) for f in ("app-1-base.js", "app-2-rayon.js", "app-3-produit.js"))
assert "/*__INDEX__*/null" in app and "/*__EN_LIGNE__*/false" in app
css0 = lis(G / "style.css"); assert "/*__FAMILLE__*/" in css0 and "/*__FAMILLE_TITRE__*/" in css0
def page(en_ligne, police="plex"):
    _, texte, titre, faces = POLICES[police]
    css = css0.replace("/*__FAMILLE__*/", texte).replace("/*__FAMILLE_TITRE__*/", titre)
    a = app.replace("/*__INDEX__*/null", index).replace("/*__EN_LIGNE__*/false", "true" if en_ligne else "false")
    return (f"<title>Le Barromètre</title>\n<style>\n{faces()}{css}</style>\n{lis(G / 'corps.html')}\n"
            f"<script>{quagga}</script>\n<script>{moteur}</script>\n<script>\n{sur(a)}\n</script>\n")
SQUELETTE = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n'

if __name__ == "__main__":
    police = sys.argv[1] if len(sys.argv) > 1 else "plex"
    (RACINE / "artifact").mkdir(exist_ok=True)
    (RACINE / "artifact/index.html").write_text(page(False, police), encoding="utf-8")
    ART = RACINE / "work/art"; ART.mkdir(parents=True, exist_ok=True)
    (ART / "index.html").write_text(SQUELETTE + page(False, police) + "</body></html>", encoding="utf-8")
    # ----- Site web installable -----
    S = RACINE / "site"
    def icone(t, marge=0.0):
        """Étiquette jaune au code-barres, sur fond marine."""
        im = Image.new("RGB", (t, t), "#0C2247"); d = ImageDraw.Draw(im); m = t * (0.16 + marge); c = t - 2 * m
        d.rounded_rectangle([m, m, t - m, t - m], radius=c * 0.2, fill="#F5B90A")
        u = c / 100; x = m + 20 * u
        for w, g in [(6, 4), (3, 4), (8, 3), (3, 6), (6, 3), (3, 4), (8, 4), (3, 3), (6, 0)]:
            d.rectangle([x, m + 24 * u, x + w * u - 1, m + 76 * u], fill="#0C2247"); x += (w + g) * u
        return im
    icone(192).save(S / "icone-192.png", optimize=True); icone(512).save(S / "icone-512.png", optimize=True); icone(512, 0.08).save(S / "icone-masque-512.png", optimize=True); icone(180).save(S / "icone-180.png", optimize=True)
    json.dump({"name": "Le Barromètre", "short_name": "Barromètre", "description": "Le relevé de rayon instantané : marques, composition, promesses des packs, d'après Open Food Facts.", "lang": "fr", "start_url": "./", "scope": "./", "display": "standalone", "orientation": "portrait", "background_color": "#E3EAF2", "theme_color": "#0C2247",
               "icons": [{"src": "icone-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "icone-512.png", "sizes": "512x512", "type": "image/png"}, {"src": "icone-masque-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]},
              open(S / "manifest.webmanifest", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    tete = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="description" content="Le relevé de rayon instantané : qui occupe un rayon alimentaire, ce que contiennent ses produits, ce que promettent les packs. Données Open Food Facts.">\n'
            '<meta name="theme-color" content="#0C2247">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Barromètre">\n'
            '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icone-192.png">\n<link rel="apple-touch-icon" href="icone-180.png">\n'
            '<style>[hidden]{display:none!important}</style>\n</head>\n<body>\n')
    corps = page(True, police)
    # Politique de sécurité : seuls les trois scripts de la page s'exécutent (empreintes), rien ne se charge d'ailleurs que du site lui-même et d'Open Food Facts.
    empreintes = " ".join("'sha256-" + base64.b64encode(hashlib.sha256(m.encode("utf-8")).digest()).decode() + "'" for m in re.findall(r"<script>(.*?)</script>", corps, re.S))
    csp = (f"default-src 'none'; script-src {empreintes}; style-src 'unsafe-inline'; font-src data:; img-src 'self' data: blob: https://*.openfoodfacts.org; "
           "connect-src 'self' https://world.openfoodfacts.org; manifest-src 'self'; worker-src 'self'; media-src 'self' blob: mediastream:; base-uri 'none'; form-action 'none'; object-src 'none'")
    tete = tete.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n<meta name="referrer" content="no-referrer">\n', 1)
    html = tete + corps + "</body>\n</html>\n"
    (S / "index.html").write_text(html, encoding="utf-8")
    (S / ".nojekyll").write_text("", encoding="utf-8")   # GitHub Pages : servir les fichiers tels quels, sans étape de construction
    # Service worker : la coquille est mise en cache à l'installation, les données au fil de l'usage
    version = hashlib.sha1((html + lis(S / "d/index.json")).encode("utf-8")).hexdigest()[:10]
    (S / "sw.js").write_text(lis(G / "sw.js").replace("__VERSION__", version), encoding="utf-8")
    # L'étude d'origine (rayon barres chocolatées), page annexe
    def rep(h, a, b):
        assert h.count(a) == 1, (h.count(a), a[:70]); return h.replace(a, b)
    F = SRC / "fonts/node_modules/@fontsource-variable"
    polices_etude = face("Source Serif 4", "source-serif-4/files/source-serif-4-latin-opsz-normal.woff2", "200 900", F) + face("Libre Franklin", "libre-franklin/files/libre-franklin-latin-wght-normal.woff2", "100 900", F)
    et = lis(RES / "etude-gabarit.html" if (RES / "etude-gabarit.html").exists() else SRC / "gabarit.html").replace("/*__POLICES__*/", polices_etude).replace("/*__DONNEES__*/null", lis(RES / "etude-donnees.json" if (RES / "etude-donnees.json").exists() else SRC / "data.json").replace("</", "<\\/"))
    et = rep(et, '<span class="logo">Le <i>Barr</i>omètre</span>', '<a class="logo" href="index.html" style="color:inherit;text-decoration:none" aria-label="Le Barromètre, retour à l\'application">Le <i>Barr</i>omètre</a>')
    et = rep(et, '<small id="date-releve"></small>', '<small id="date-releve"></small><a class="vers-app" href="index.html">Ouvrir l\'application : tous les rayons</a>')
    et = rep(et, "</style>", ".vers-app{font-size:.875rem;font-weight:600;white-space:nowrap}\n@media (max-width:719px){.bandeau small{display:none}}\n@media (min-width:720px){.bandeau small{margin-left:auto}}\n</style>")
    (S / "etude.html").write_text(et, encoding="utf-8")
    for f in (RACINE / "artifact/index.html", S / "index.html", S / "etude.html"): print(f.relative_to(RACINE), round(f.stat().st_size / 1024), "Ko")
