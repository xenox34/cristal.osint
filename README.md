# OSINT Atlas

Annuaire statique de **363 outils OSINT** classés en **18 catégories** : recherche d’images, géolocalisation, réseaux sociaux, cybersécurité, archives, entreprises, sources françaises, etc.

Aucune dépendance, aucun build, aucun serveur : le site fonctionne en ouvrant simplement `index.html`.

## Fonctionnalités

- Recherche instantanée (insensible aux accents) dans les noms, descriptions et tags
- Filtres par catégorie et par niveau d’accès (gratuit, libre, freemium, payant)
- Tri par pertinence, ordre alphabétique ou catégorie
- Favoris enregistrés dans le navigateur (`localStorage`)
- Thème sombre / clair mémorisé
- Chargement progressif des cartes (60 par 60)
- Raccourcis clavier : `/` pour chercher, `Échap` pour effacer
- Bouton « Au hasard » pour découvrir un outil
- Responsive mobile et tablette
- Scores Lighthouse : 100 accessibilité, 100 bonnes pratiques, 100 SEO

## Structure

```
index.html    Structure et contenu éditorial
styles.css    Design, thèmes et responsive
data.js       Catégories + 363 outils (format compact)
app.js        Recherche, filtres, favoris, rendu
```

## Ajouter ou modifier un outil

Dans `data.js`, ajoutez une ligne au tableau `RAW_TOOLS` :

```js
["Nom de l’outil", "https://exemple.com", "image", "Description courte.", "tags, mots-clés", "Gratuit"],
```

Catégories disponibles : `methodo`, `social`, `people`, `contact`, `network`, `image`, `geo`, `archive`, `company`, `research`, `leaks`, `dark`, `transport`, `crypto`, `verify`, `toolbox`, `france`, `ai`.

Accès possibles : `Gratuit`, `Libre`, `Freemium`, `Payant`.

Pour rafraîchir le cache après une modification, incrémentez les `?v=` dans `index.html`.

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000>.

## Avertissement

Cet annuaire est pédagogique. Les outils référencés doivent être utilisés dans un cadre légal, légitime et proportionné, dans le respect de la vie privée et du RGPD. Pas de doxxing, pas d’accès non autorisé.
