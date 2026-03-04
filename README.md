# Ligue Kinshima

## Tableau des scores des clans

Interface web de suivi des affrontements Kinshima: classement, progression dans le temps, historique detaille, et administration securisee.

---

## Identite Visuelle des Clans

| Clan       | Logo                                     |
| ---------- | ---------------------------------------- |
| Alphanos   | ![Logo Alphanos](logos/Alphanos.png)     |
| Arturok    | ![Logo Arturok](logos/Arturok.png)       |
| Bragnir    | ![Logo Bragnir](logos/Bragnir.png)       |
| O-Tsuyujin | ![Logo O-Tsuyujin](logos/O-Tsuyujin.png) |
| Seklan     | ![Logo Seklan](logos/Seklan.png)         |
| Son-Enma   | ![Logo Son-Enma](logos/Son-Enma.png)     |

---

## Fonctionnalites Principales

- Classement des clans par saison
- Visualisation de la progression des points (saison active)
- Visualisation des points globaux (toutes saisons)
- Historique filtrable (saison, clan, categorie)
- Horodatage precis des resultats (`date + heure + minutes`)
- Lien admin en bas de la page publique

## Administration

- Saisie des resultats depuis `admin.html`
- Gestion individuelle des resultats:
  - modification apres saisie
  - suppression individuelle
  - pagination (taille de page configurable)
  - export CSV (compatible Excel)
- Gestion des clans:
  - ajout, renommage, suppression protegee
  - personnalisation couleur et logo
- Gestion des categories:
  - ajout, renommage, suppression protegee
- Securite:
  - authentification admin
  - protection anti brute-force (`5` erreurs -> blocage `5` minutes)

## Stockage des Donnees

- Resultats: base separee **IndexedDB** (`kinshima-results-db`, store `results`) via `db.js`
- Donnees d'application (config, styles, securite): `localStorage`
- Export des resultats en `.csv` disponible depuis l'admin

---

## Structure du Projet

- `index.html`: page publique
- `admin.html`: panneau d'administration
- `styles.css`: theme visuel (ambiance Kinshima: nuit, royal, or)
- `script.js`: logique interface/metier
- `db.js`: persistence des resultats (IndexedDB)
- `logos/`: logos des clans

---

## Acces Admin

- Mot de passe initial: `Kinshima-Admin-2026`
- Le mot de passe peut etre modifie dans le panneau admin

---

## Demarrage

1. Ouvrir `index.html` pour la consultation publique.
2. Ouvrir `admin.html` pour la gestion admin.
