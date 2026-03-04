## Ligue Kinshima - Tableau des scores

Site web interactif pour la competition martiale des clans de la Ligue Kinshima.

### Fichiers

- `index.html` : page publique (classement, graphiques, historique)
- `admin.html` : page admin dediee
- `styles.css` : theme Kinshima et mise en page
- `script.js` : logique metier (scores, saisons, graphes, admin, styles equipes)

### Fonctionnalites

- Page principale plus lisible et plus elegante
- Menu en haut avec lien admin discret
- Lien admin aussi en bas de page (petit format)
- Classement des clans par saison
- Graphique de progression dans le temps (saison active)
- Graphique global des points (toutes saisons)
- Horodatage des resultats en date + heure (minutes)
- Historique filtrable
- Resultats stockes dans une base separee (IndexedDB `kinshima-results-db`)
- Personnalisation equipe depuis admin:
  - Couleur d'equipe
  - Upload/remplacement de logo d'equipe
  - Suppression du logo
- Logos par defaut des 6 clans (dossier `logos/`)
- Gestion admin des clans/categories (ajout, renommage, suppression protegee)
- Protection anti brute-force: 5 erreurs consecutives -> blocage 5 minutes
- Saisons au format `LK26`, `LK27`, `LK28`...
- Donnees sauvegardees dans `localStorage`

### Mot de passe admin

- Mot de passe initial: `Kinshima-Admin-2026`
- Il peut etre change depuis le panneau admin

### Lancer

1. Ouvrir `index.html` pour la consultation publique.
2. Ouvrir `admin.html` pour la gestion admin (ou via le lien sur la page publique).
