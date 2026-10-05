# Fiscale — Méthodologie fiscale

Page web pédagogique en français pour une formation proposée par le Cabinet GOBEX. Le parcours traite de la revue fiscale dans le contexte général et béninois, en 7 séquences, avec une présentation responsive, des illustrations, des infographies et un classeur de revue fiscale sécurisé.

## Lancer en local

Le projet nécessite Node.js 18 ou une version plus récente.

```bash
npm install
npm run dev
```

`npm run server` lance également le même serveur sécurisé. Puis ouvrir [http://localhost:4173](http://localhost:4173).

### Mode développement

`npm run dev` active volontairement un contournement local de l’authentification : la page de connexion est automatiquement sautée et un utilisateur fictif « Développement local » est affiché. Le classeur reste en lecture seule et aucun participant ni mot de passe n’est nécessaire pour travailler sur l’interface.

Le contournement est limité au script de développement et est refusé lorsque `NODE_ENV=production`. Pour tester l’authentification réelle, utiliser `npm run server` sans `AUTH_BYPASS=true`.

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
      "passwordHash": "scrypt$16384$8$1$..."
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
- des mots de passe vérifiés avec `scrypt` et une comparaison résistante au timing ;
- une limitation à 5 tentatives par couple adresse IP / email sur une fenêtre de 15 minutes ;
- des routes protégées pour le contenu pédagogique du classeur ;
- aucun accès statique direct à `private/` ou `config/`.

Routes principales :

- `POST /api/login` — ouvrir une session avec un email et un mot de passe ;
- `GET /api/session` — vérifier la session courante ;
- `POST /api/logout` — fermer la session ;
- `GET /api/dossier` — récupérer le contenu du classeur après authentification.

Le classeur est volontairement en lecture seule : cette première version ne permet ni import de documents réels, ni ajout, ni modification, ni persistance de checklist.

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
- `classeur.css` — styles de l'authentification, de la navigation et de la lecture seule.
- `classeur.js` — connexion, session, déconnexion, recherche, navigation et rendu.
- `server.mjs` — serveur Node natif, API d'authentification et protection des ressources.
- `private/dossier-data.json` — 24 rubriques et 7 sous-rubriques pédagogiques, servies uniquement via l'API protégée.
- `config/participants.example.json` — modèle à copier pour préparer la liste des participants.
- `scripts/hash-password.mjs` — générateur de hash `scrypt`.
