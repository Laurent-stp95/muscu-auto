"""Construit data/data.js depuis data/liste.json (exercices choisis par Laurent) + données wger (CC-BY-SA) + médias de l'API wger.de.

liste.json fait foi : nom français, zone, rôle, matériel, consignes, risques. wger fournit muscles, licence, images, vidéos.
Images copiées dans img/, à la racine du dépôt (appli utilisable hors-ligne). Vidéos laissées sur wger.de : 20 à 60 Mo chacune, trop lourdes.
Descriptions : `desc` de liste.json, sinon descriptions-fr.json ({id: texte}, traduit depuis l'anglais wger).

Usage : python3 data/extract.py [chemin du clone wger, défaut ~/wger]
"""
import json
import subprocess
import sys
from pathlib import Path

WGER = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'wger'
FIX = WGER / 'wger/exercises/fixtures'
EN = 2

HERE = Path(__file__).parent  # data/ : liste.json, descriptions-fr.json, data.js
IMG = HERE.parent / 'img'  # chemins « img/… » de data.js, relatifs à index.html
liste = json.loads((HERE / 'liste.json').read_text())
descriptions_fr = json.loads((HERE / 'descriptions-fr.json').read_text())
licenses = {l['pk']: l['fields']['short_name'] for l in json.load(open(WGER / 'wger/core/fixtures/licenses.json'))}
base = {row['pk']: row['fields'] for row in json.load(open(FIX / 'exercise-base-data.json'))}
english = {row['fields']['exercise']: row['fields'] for row in json.load(open(FIX / 'translations.json'))
           if row['model'] == 'exercises.translation' and row['fields']['language'] == EN}


def api(resource):
    # ponytail: une seule page de 1000 (383 images, 78 vidéos en 2026), suivre 'next' si ça dépasse
    # curl plutôt qu'urllib : le Python de python.org n'a pas les certificats racine du Mac
    out = subprocess.run(['curl', '-sf', f'https://wger.de/api/v2/{resource}/?limit=1000'], check=True, capture_output=True)
    return json.loads(out.stdout)['results']


def fetch(url, stem):
    """Télécharge une fois ; wger sert parfois du JPEG ou du GIF derrière un nom en .png, l'extension suit le contenu."""
    found = list(IMG.glob(f'{stem}.*'))
    if found:
        return found[0]
    tmp = IMG / stem
    subprocess.run(['curl', '-sfo', str(tmp), url], check=True)
    mime = subprocess.run(['file', '-b', '--mime-type', str(tmp)], capture_output=True, text=True).stdout.strip()
    return tmp.rename(tmp.with_suffix({'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp'}[mime]))


images, videos = api('exerciseimage'), api('video')
IMG.mkdir(exist_ok=True)
exos = []
for item in liste:
    i = item['id']
    f, t = base[i], english.get(i, {})
    imgs = sorted((x for x in images if x['exercise_uuid'] == f['uuid']), key=lambda x: not x['is_main'])[:2]
    files = [fetch((x.get('thumbnails') or {}).get('medium') or x['image'], f'{i}-{n}') for n, x in enumerate(imgs)]
    # Vidéo la plus légère, h264 d'abord (lisible partout) ; hevc lisible sur iPhone.
    vid = min((v for v in videos if v['exercise_uuid'] == f['uuid']), key=lambda v: (v['codec'] != 'h264', v['size']), default=None)
    exos.append({
        **item,
        'mus': item.get('mus', f['muscles']),
        'mus2': item.get('mus2', f['muscles_secondary']),
        'desc': item.get('desc') or descriptions_fr.get(str(i), ''),
        'img': [f'img/{p.name}' for p in files],
        'imgBy': ', '.join(sorted({x['license_author'] for x in imgs if x['license_author']})),
        'vid': vid and vid['video'],
        'vidMb': vid and round(vid['size'] / 1e6),
        'lic': licenses.get(t.get('license'), 'CC-BY-SA'),
        'author': t.get('license_author', ''),
    })

missing = [e['id'] for e in exos if not e['img']]
assert not missing, f'exercices sans image : {missing}'
used = {Path(p).name for e in exos for p in e['img']}
for p in IMG.iterdir():
    if p.name not in used:
        p.unlink()  # exercice retiré de liste.json

out = HERE / 'data.js'
out.write_text(
    '// Généré par extract.py depuis liste.json et wger (https://wger.de), licences par exercice. Ne pas éditer.\n'
    f'const EXOS = {json.dumps(exos, ensure_ascii=False)};\n'
    "(typeof self !== 'undefined' ? self : globalThis).EXOS = EXOS; // pour les modules ES (src/common.js) ; le service worker lit la constante\n")
print(f'{len(exos)} exercices, {len(used)} images, {sum(1 for e in exos if e["vid"])} vidéos -> {out.name}')
