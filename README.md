# LIGUE KINSHIMA

## Tableau des Scores des Clans

<p align="center">
  <img src="logos/Alphanos.png" alt="Alphanos" width="42" />
  <img src="logos/Arturok.png" alt="Arturok" width="42" />
  <img src="logos/Bragnir.png" alt="Bragnir" width="42" />
  <img src="logos/O-Tsuyujin.png" alt="O-Tsuyujin" width="42" />
  <img src="logos/Seklan.png" alt="Seklan" width="42" />
  <img src="logos/Son-Enma.png" alt="Son-Enma" width="42" />
</p>

<p align="center">
  Classements, progression des points, historique officiel des affrontements et panneau d'administration.
</p>

---

## Apercu

- Page publique `index.html`:
  - classement par saison
  - visualisation des points
  - historique filtrable
- Page admin `admin.html`:
  - saisie des resultats
  - gestion des clans et categories
  - gestion individuelle des resultats (modifier/supprimer)
  - pagination des resultats
  - export CSV (Excel compatible)

---

## Stack et Donnees

- UI: `HTML`, `CSS`, `JavaScript` vanilla
- Resultats: `IndexedDB` via `db.js`
  - base: `kinshima-results-db`
  - store: `results`
- Config applicative (hors resultats): `localStorage`

---

## Structure

- `index.html`: vue publique
- `admin.html`: panneau admin
- `styles.css`: theme Kinshima (nuit / royal / or)
- `script.js`: logique metier et UI
- `db.js`: persistence des resultats
- `logos/`: logos des clans

---

## Securite Admin

- Mot de passe initial: `Kinshima-Admin-2026`
- Blocage anti brute-force: `5` erreurs consecutives => blocage `5` minutes

---

## Demarrage

1. Ouvrir `index.html`.
2. Aller sur `admin.html` via le lien en bas de page pour la gestion.

---

## Export CSV

Depuis le panneau admin:

- ouvrir `Gestion des resultats individuels`
- cliquer `Exporter CSV`
- ouvrir le fichier telecharge dans Excel ou LibreOffice

---

Copyright Kinshima 2026
