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

## Authentification Google

L’identification et l’inscription des participants se font exclusivement avec Google. En production, créer un client OAuth de type **Application Web** dans Google Cloud, activer les APIs nécessaires et déclarer l’URL de rappel.

Variables d’environnement nécessaires :

```bash
GOOGLE_CLIENT_ID="votre-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="votre-secret-google"
GOOGLE_REDIRECT_URI="https://votre-domaine.bj/auth/google/callback"
NODE_ENV=production
COOKIE_SECURE=true
```

En local :

```bash
GOOGLE_CLIENT_ID="..." \\
GOOGLE_CLIENT_SECRET="..." \\
GOOGLE_REDIRECT_URI="http://localhost:4173/auth/google/callback" \\
npm run server
```

Au premier accès, Google crée automatiquement le compte local dans `storage/users.json`. Le serveur demande uniquement les informations d’identité `openid email profile` pour cette étape. L’intégration Google Drive fera l’objet d’une autorisation séparée et progressive. Le serveur ne conserve pas de mot de passe Google. Les secrets OAuth ne doivent jamais être ajoutés au dépôt ni transmis dans le navigateur.

Le mode de développement sans configuration Google utilise encore l’utilisateur fictif `Développement local`. Pour tester le parcours Google en local, désactiver le contournement :

```bash
AUTH_BYPASS=false GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." npm run server
```

## Utilisation sécurisée

En production, lancer le serveur derrière HTTPS et activer le cookie sécurisé :

```bash
NODE_ENV=production COOKIE_SECURE=true npm run server
```

Le serveur fournit :

- des sessions aléatoires conservées côté serveur, avec cookie `HttpOnly`, `SameSite=Lax` et expiration après 8 heures ;
- une identification Google via OAuth 2.0 et une inscription automatique au premier accès ;
- des routes protégées pour le contenu et les opérations sur les fichiers du classeur ;
- aucun accès statique direct à `private/`, `storage/` ou `config/` ;
- un stockage local des fichiers dans `storage/`, exclu de Git et non exposé comme ressource statique.

Routes principales :

- `GET /auth/google` — commencer l’identification Google ;
- `GET /auth/google/callback` — recevoir la réponse OAuth et ouvrir la session ;
- `GET /api/session` — vérifier la session courante ;
- `POST /api/logout` — fermer la session ;
- `GET /api/dossier` — récupérer les rubriques et les fichiers du dossier ;
- `POST /api/files?folderId=01` — ajouter un fichier dans une rubrique ;
- `GET /api/files/:id` — consulter un fichier ;
- `PATCH /api/files/:id` — renommer un fichier ou le déplacer dans une autre rubrique ;
- `PUT /api/files/:id` — remplacer le contenu d’un fichier ;
- `DELETE /api/files/:id` — supprimer un fichier.

Le classeur est une interface de classement et d’accès aux fichiers du dossier. Les fichiers sont conservés localement, avec une limite de 25 Mo par fichier. L’interface permet de les ajouter, consulter, renommer, remplacer et supprimer. Pour chaque fichier, le serveur enregistre un chemin local relatif, par exemple `storage/dossier-files/<identifiant>.pdf`, puis le bouton « Consulter » ouvre la copie locale via le serveur.

Un navigateur ne transmet pas le chemin absolu du fichier original présent sur l’ordinateur et ne peut pas ouvrir librement un chemin `file://` pour des raisons de sécurité. Le fonctionnement retenu conserve donc une copie locale gérée par le serveur et l’ouvre dans le navigateur ; selon le type de fichier, le navigateur l’affiche ou le télécharge avec l’application associée.

## Vérifier et construire

```bash
npm run build
```

Le build Vite vérifie les pages et ressources de présentation. Pour tester le serveur sécurisé, lancer `AUTH_BYPASS=false npm run server` avec la configuration Google. Sans session, `/api/dossier` doit répondre `401`; après connexion Google, il doit répondre `200`.

## Contenu du dépôt

- `index.html` — page principale et parcours en 7 séquences ; le lien vers le classeur se trouve dans Séquence 03.
- `styles.css` — direction artistique, illustrations, infographies et responsive design.
- `script.js` — navigation mobile, accordéons, rail de progression et QCM.
- `classeur.html` — page de connexion et shell du classeur.
- `classeur.css` — styles de l'authentification, de la navigation et de la bibliothèque de fichiers.
- `classeur.js` — connexion, session, déconnexion, recherche, navigation et rendu.
- `server.mjs` — serveur Node natif, API d'authentification et protection des ressources.
- `private/dossier-data.json` — 24 rubriques et 7 sous-rubriques pédagogiques, servies uniquement via l'API protégée.
- `storage/` — utilisateurs Google, index et contenu des fichiers de dossiers, créé automatiquement et ignoré par Git.
- `scripts/` — scripts utilitaires conservés pour les opérations de maintenance.

### Mode développeur du parcours pédagogique

Pour consulter toutes les séquences et leurs questionnaires sans les valider, ouvrir la page avec le paramètre local suivant :

```text
http://localhost:4173/?mode=developer
```

Ce mode affiche explicitement « Accès développeur », désactive la clôture des séquences et n’écrit pas de validations supplémentaires dans `fiscale-guided-sequences-v1`. Le parcours normal reste séquentiel pour les autres visiteurs. Ce mécanisme côté navigateur est un outil de développement et ne constitue pas un contrôle d’accès de production.

### Reprise du parcours et certificat

La progression des séquences et la séquence en cours sont conservées dans le stockage local du navigateur (`fiscale-guided-sequences-v1` et `fiscale-guided-current-v1`). Les informations du participant, l’aperçu et l’état de confirmation du règlement utilisent des clés séparées (`fiscale-certificate-profile-v1` et `fiscale-certificate-state-v1`) afin de reprendre la demande sur le même appareil.

Le bouton de règlement ouvre le prestataire dans une nouvelle fenêtre sans afficher son adresse dans l’interface. L’application ne prétend pas vérifier un paiement côté client : elle attend une confirmation manuelle dans le flux avant d’activer le bouton de téléchargement. Le bouton PDF ouvre la boîte d’impression du navigateur avec une feuille dédiée au certificat ; choisir « Enregistrer au format PDF ». Une intégration de retour serveur ou de webhook du prestataire sera nécessaire pour une validation financière automatisée en production.

### Validation manuelle des certificats par WhatsApp

Le parcours propose désormais un bouton WhatsApp qui ouvre une conversation préremplie avec le code du certificat et les informations saisies. Le participant doit joindre manuellement son reçu de paiement dans WhatsApp au numéro `+229 0190895323`, car un navigateur ne peut pas joindre automatiquement un fichier local à une conversation WhatsApp.

Après réception du message, le cabinet ouvre l’espace développeur avec `?mode=developer`, renseigne le code et le nom reçus, puis choisit `Enregistrer en attente`, `Valider le certificat` ou `Révoquer le certificat`. Les décisions sont conservées côté serveur dans `storage/certificates.json` (fichier ignoré par Git). Le bouton de téléchargement du participant reste bloqué tant que le statut serveur n’est pas `validated`.

En production, l’accès aux API de gestion des certificats est réservé aux utilisateurs listés dans la variable `DEVELOPER_EMAILS`, séparés par des virgules. En local, `AUTH_BYPASS=true` permet de tester l’espace développeur.
