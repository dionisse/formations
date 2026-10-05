# Fiscale — Méthodologie fiscale

Page web pédagogique en français pour une formation proposée par le Cabinet GOBEX. Le parcours traite de la revue fiscale dans le contexte général et béninois, en 7 séquences, avec une présentation responsive, des illustrations, des infographies et un classeur de revue fiscale qui sert de point d’accès aux fichiers des dossiers.

## Lancer en local

Le projet nécessite Node.js 18 ou une version plus récente.

```bash
npm install
npm run dev
```

`npm run server` lance également ce serveur. Puis ouvrir [http://localhost:4173](http://localhost:4173).

### Mode développement

En environnement local, la page de connexion est automatiquement sautée par défaut : un utilisateur fictif « Développement local » est affiché et aucun participant ni mot de passe n’est nécessaire pour travailler sur l’interface. Les fonctions d’ajout et de gestion des fichiers sont disponibles.

Pour réactiver ponctuellement l’authentification en local :

```bash
AUTH_BYPASS=false npm run server
```

Le contournement est automatiquement refusé lorsque `NODE_ENV=production`. En production, lancer le serveur avec `NODE_ENV=production` et HTTPS.

Le serveur écoute par défaut sur `0.0.0.0:4173`. Le port peut être modifié :

```bash
PORT=8080 npm run server
```

> Le serveur sécurisé remplace le serveur statique Python utilisé pour la seule page de présentation. Il sert également l'API d'authentification et le classeur protégé.

## Configurer les participants

La liste des participants n'est pas suivie dans Git. Pour créer la configuration locale :

```bash
cp config/participants.example.json config/participants.json
```

Pour chaque participant, générer un hash de mot de passe sans enregistrer le mot de passe en clair dans le fichier :

```bash
npm run hash-password -- "UnMotDePasseFortEtUnique"
```

Puis compléter `config/participants.json` :

```json
{
  "participants": [
    {
      "email": "participant@entreprise.bj",
      "name": "Nom du participant",
      "passwordHash": "pbkdf2$100000$64$..."
    }
  ]
}
```

Le champ `passwordHash` doit contenir la valeur produite par la commande précédente. Les adresses sont normalisées en minuscules lors de la connexion. Le fichier `config/participants.json` est ignoré par Git et doit être remplacé par la liste réelle avant toute diffusion.

Une configuration de démonstration locale peut être présente dans le checkout (`demo@fiscale.local`). Elle sert uniquement aux tests et ne constitue pas une liste de participants réelle.

## Utilisation sécurisée

En production, lancer le serveur derrière HTTPS et activer le cookie sécurisé :

```bash
NODE_ENV=production COOKIE_SECURE=true npm run server
```

Le serveur fournit :

- des sessions aléatoires conservées côté serveur, avec cookie `HttpOnly`, `SameSite=Lax` et expiration après 8 heures ;
- des mots de passe vérifiés avec `PBKDF2` et une comparaison résistante au timing ;
- une limitation à 5 tentatives par couple adresse IP / email sur une fenêtre de 15 minutes ;
- des routes protégées pour le contenu et les opérations sur les fichiers du classeur ;
- aucun accès statique direct à `private/`, `storage/` ou `config/` ;
- un stockage local des fichiers dans `storage/`, exclu de Git et non exposé comme ressource statique.

Routes principales :

- `POST /api/login` — ouvrir une session avec un email et un mot de passe ;
- `GET /api/session` — vérifier la session courante ;
- `POST /api/logout` — fermer la session ;
- `GET /api/dossier` — récupérer les rubriques et les fichiers du dossier ;
- `POST /api/files?folderId=01` — ajouter un fichier dans une rubrique ;
- `GET /api/files/:id` — consulter un fichier ;
- `PATCH /api/files/:id` — renommer un fichier ou le déplacer dans une autre rubrique ;
- `PUT /api/files/:id` — remplacer le contenu d’un fichier ;
- `DELETE /api/files/:id` — supprimer un fichier.

Le classeur est une interface de classement et d’accès aux fichiers du dossier. Les fichiers sont conservés localement, avec une limite de 25 Mo par fichier. L’interface permet de les ajouter, consulter, renommer, remplacer et supprimer.

## Vérifier et construire

```bash
npm run build
```

Le build Vite vérifie les pages et ressources de présentation. Pour tester le serveur sécurisé, lancer `npm run server`, puis vérifier une connexion avec un participant configuré. Sans session, `/api/dossier` doit répondre `401`; après connexion, il doit répondre `200`.

## Contenu du dépôt

- `index.html` — page principale et parcours en 7 séquences ; le lien vers le classeur se trouve dans Séquence 03.
- `styles.css` — direction artistique, illustrations, infographies et responsive design.
- `script.js` — navigation mobile, accordéons, rail de progression et QCM.
- `classeur.html` — page de connexion et shell du classeur.
- `classeur.css` — styles de l'authentification, de la navigation et de la bibliothèque de fichiers.
- `classeur.js` — connexion, session, déconnexion, recherche, navigation et rendu.
- `server.mjs` — serveur Node natif, API d'authentification et protection des ressources.
- `private/dossier-data.json` — 24 rubriques et 7 sous-rubriques pédagogiques, servies uniquement via l'API protégée.
- `storage/` — index et contenu des fichiers de dossiers, créé automatiquement et ignoré par Git.
- `config/participants.example.json` — modèle à copier pour préparer la liste des participants.
- `scripts/hash-password.mjs` — générateur de hash `PBKDF2`.
