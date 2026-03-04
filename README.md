## Ligue Kinshima - Tableau des scores

Site web interactif pour la competition martiale des clans de la Ligue Kinshima.

### Fichiers

- `index.html` : interface publique + panneau admin
- `styles.css` : theme inspire de l'univers Kinshima
- `script.js` : logique scores/saisons/admin/equipes/categories/securite

### Fonctionnalites

- Vue publique du classement et de l'historique
- Panneau admin protege par mot de passe pour:
  - Ajouter des scores
  - Renommer un clan
  - Ajouter un clan
  - Supprimer un clan (bloque si des scores existent pour ce clan)
  - Renommer une categorie
  - Ajouter une categorie
  - Supprimer une categorie (bloquee si des scores existent pour cette categorie)
  - Changer le mot de passe admin
- Protection anti brute-force: 5 erreurs consecutives bloquent la connexion pendant 5 minutes
- Saisons au format `LK26`, `LK27`, `LK28`...
- Lien externe vers `https://www.kinshima.com`
- Donnees sauvegardees dans `localStorage`

### Mot de passe admin

- Mot de passe initial: `Kinshima-Admin-2026`
- Il peut etre change depuis le panneau admin

### Lancer

1. Ouvrir `index.html` dans un navigateur.
2. Utiliser le panneau admin pour saisir les scores au fil de la saison.
