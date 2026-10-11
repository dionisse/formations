# Fiscale — Méthodologie fiscale

Page web pédagogique en français pour une formation proposée par le Cabinet GOBEX. Le parcours traite de la revue fiscale dans le contexte général et béninois, en 7 séquences, avec une présentation responsive, des illustrations, des infographies et un classeur de revue fiscale qui sert de point d’accès aux fichiers des dossiers.

## Lancer en local

Le projet nécessite Node.js 22 ou une version plus récente.

```bash
npm install
npm run dev
```

`npm run server` lance également ce serveur. Puis ouvrir [http://localhost:4173](http://localhost:4173).

## Compte participant du parcours — Supabase et Google

La page `/connexion.html` accueille les participants et affiche, après connexion, leur catalogue de formations. Le bouton **Connexion** de la page principale ouvre également l’accès Google ; Supabase Auth crée le compte lors de la première connexion, sans mot de passe Fiscale. Le catalogue est déclaré sous forme de liste dans `plateforme.js` : chaque formation possède sa propre version, son lien et sa progression. Ajouter un parcours consiste à ajouter une entrée au catalogue et à lui associer sa version de formation.

Pour la formation fiscale actuelle, la progression et les réponses aux QCM sont synchronisées avec le compte et restent aussi sauvegardées localement si le réseau ou Supabase est indisponible. Chaque ligne distante est propre au couple participant (`user_id`) et formation (`course_version`). Le parcours reprend la progression locale du participant sur cet appareil lorsqu’elle est disponible.

Le classeur (`classeur.html`) réutilise désormais cette même session Supabase Google : il n’y a plus de second OAuth Google géré par le serveur Node. L’ancien chemin `/auth/google` reste temporairement disponible comme alias vers le classeur, sans émettre de session séparée. Le serveur valide le jeton Supabase puis vérifie côté serveur le droit de la formation avant chaque lecture ou modification des dossiers.

### Configuration du projet Supabase

1. Connecter ce projet au projet Supabase voulu dans Bolt et appliquer, dans l’ordre, `supabase/migrations/20261009000000_participant_accounts.sql` puis `supabase/migrations/20261009120000_paid_course_entitlements.sql` dans le SQL Editor (ou avec Supabase CLI). Cela crée les profils, la progression multi-formations, les demandes de paiement, leurs règles RLS et le journal des décisions.
2. Dans Supabase, activer **Authentication → Providers → Google**. Renseigner le Client ID et le Client Secret OAuth Google. Autoriser l’inscription de nouveaux utilisateurs pour que le premier accès crée leur compte.
3. Dans Google Cloud, ajouter comme URI de redirection autorisée l’URL de callback fournie par Supabase, de la forme `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Dans **Authentication → URL Configuration**, définir l’URL du site et autoriser les pages de retour Google, notamment `http://localhost:4173/connexion.html`, `/classeur.html` et `/admin.html` en local, ainsi que leurs versions `https://votre-domaine/...` en production et les URL de prévisualisation Bolt utilisées.
5. Renseigner l’URL du projet et sa clé **anon/publishable** dans `.env` ou dans les variables d’environnement de Bolt :

```bash
cp .env.example .env
# Remplacer les exemples par l’URL Supabase et la clé publique du projet.
```

Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont injectées dans le site au build. `npm run server` lit également ces variables depuis l’environnement ou `.env` pour fournir la configuration publique à `/api/public-config`. Le SDK JavaScript Supabase est installé via npm et servi localement ; l’authentification ne dépend donc pas d’un CDN tiers.

La clé publique est destinée au navigateur. **Ne jamais utiliser ni exposer la clé `service_role`**. Les tables de profils et de progression ont la sécurité RLS activée ; la progression est identifiée par `(user_id, course_version)`. Les droits de formation sont également séparés par participant et par formation : un participant peut demander un accès en attente, mais ne peut ni confirmer ni révoquer son propre paiement. Seul l’administrateur vérifié `godwingobex@gmail.com` peut modifier ces statuts. Le serveur contrôle ce droit avant chaque accès au classeur, à son API et aux fichiers ; masquer un lien dans l’interface ne constitue pas la protection.

La confirmation du paiement est manuelle : le participant ouvre une demande liée à son compte, transmet le reçu à GOBEX sur WhatsApp, puis l’administrateur confirme ou refuse l’accès dans `/admin.html`. Une confirmation active uniquement la formation indiquée. Chaque décision est journalisée. Le contrôle d’administration est également appliqué par RLS et côté serveur ; une adresse affichée par le navigateur ne suffit pas.

La progression et les brouillons de QCM restent sauvegardés localement, avec une clé par participant et formation ; ils sont aussi synchronisés entre appareils. Le conflit entre appareils est résolu au chargement par `last_saved_at`, par formation. La migration précédente convertit aussi l’ancienne clé de progression `user_id` seule en clé composite.

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

## Connexion au classeur et administration des paiements

Le classeur utilise le compte Google déjà ouvert avec Supabase Auth. Le serveur Node ne reçoit pas de Client Secret Google et ne crée plus de session Google indépendante. Il vérifie le jeton Supabase auprès de Supabase Auth, puis interroge les droits de la formation avec le jeton du participant et les politiques RLS.

En production, définir dans l’environnement serveur les variables publiques Supabase (`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`), ainsi que :

```bash
COURSE_VERSIONS="formation-fiscale-v1"
NODE_ENV=production
```

Le serveur et la migration RLS réservent l’administration à l’adresse Google vérifiée `godwingobex@gmail.com`. Cette adresse n’est pas paramétrable par une variable d’environnement. La clé `service_role` n’est jamais requise dans le navigateur ni dans cette configuration.

Le participant connecté peut ouvrir une demande d’accès en attente et envoyer son reçu via WhatsApp. Seul l’administrateur peut confirmer le paiement dans `/admin.html`. La vérification de l’entitlement protège le contenu de `/api/dossier` et toutes les opérations `/api/files`; les comptes non payés reçoivent une réponse `402`, les comptes non connectés une réponse `401`. L’administrateur peut gérer les demandes même sans entitlement de participant.

En local, `AUTH_BYPASS=true` (valeur par défaut de `npm run dev`) simule un compte administrateur et un accès payé pour travailler sur les interfaces. Ce bypass est automatiquement désactivé avec `NODE_ENV=production`; pour tester les refus d’accès, lancer `AUTH_BYPASS=false npm run server`.

## Utilisation sécurisée

En production, lancer le serveur derrière HTTPS avec `NODE_ENV=production`. Le serveur valide le jeton Bearer auprès de Supabase Auth à chaque opération protégée ; il n’émet pas de session Google Node ni de cookie d’authentification indépendant. Les clés privées ne sont pas transmises au navigateur. Les ressources de `private/` et `storage/` ne sont jamais servies comme fichiers statiques.

Routes principales :

- `GET /api/public-config` — transmettre uniquement l’URL Supabase et la clé publique ;
- `GET /api/session` — vérifier le compte et son statut d’accès à la formation ;
- `GET /api/entitlements` et `POST /api/entitlements/request` — consulter ou demander son propre accès ;
- `GET /api/admin/entitlements` et `PATCH /api/admin/entitlements/:id` — lister et décider les demandes (administrateur uniquement) ;
- `GET /api/admin/entitlement-events` — consulter le journal des décisions (administrateur uniquement) ;
- `GET /api/dossier` — récupérer le dossier après confirmation du règlement ;
- `POST /api/files?folderId=01` — ajouter un fichier après confirmation ;
- `GET /api/files/:id` — consulter un fichier après confirmation ;
- `PATCH /api/files/:id` — renommer ou déplacer un fichier après confirmation ;
- `PUT /api/files/:id` — remplacer un fichier après confirmation ;
- `DELETE /api/files/:id` — supprimer un fichier après confirmation.

Les fichiers sont conservés localement dans `storage/`, avec une limite de 25 Mo. Les opérations de lecture et d’écriture revalident le droit de la formation côté serveur.

Le classeur est une interface de classement et d’accès aux fichiers du dossier. Les fichiers sont conservés localement, avec une limite de 25 Mo par fichier. L’interface permet de les ajouter, consulter, renommer, remplacer et supprimer. Pour chaque fichier, le serveur enregistre un chemin local relatif, par exemple `storage/dossier-files/<identifiant>.pdf`, puis le bouton « Consulter » ouvre la copie locale via le serveur.

Un navigateur ne transmet pas le chemin absolu du fichier original présent sur l’ordinateur et ne peut pas ouvrir librement un chemin `file://` pour des raisons de sécurité. Le fonctionnement retenu conserve donc une copie locale gérée par le serveur et l’ouvre dans le navigateur ; selon le type de fichier, le navigateur l’affiche ou le télécharge avec l’application associée.

## Classeur en ligne : fonctions serverless

Le classeur fonctionne en ligne sur Vercel sans stockage de données : le contenu pédagogique payant est **embarqué dans la fonction** `api/dossier` et n’est servi qu’après vérification de l’accès côté serveur. Le dossier `api/` contient les routes portées depuis `server.mjs` :

- `GET /api/public-config` — URL et clé publique Supabase ;
- `GET /api/session` — compte connecté et statut d’accès ;
- `GET /api/entitlements` et `POST /api/entitlements/request` — consulter ou demander son accès ;
- `GET /api/dossier` — contenu du dossier après confirmation du règlement ;
- `GET /api/drive-token` — état de la liaison Google Drive du participant ;
- `POST /api/drive-token` — accès temporaire (1 heure) au Drive du participant, et enregistrement du jeton hors ligne ;
- `DELETE /api/drive-token` — retrait de la liaison.

`api/_lib/shared.mjs` reprend la vérification du jeton Supabase et le contrôle des droits par formation ; `api/_lib/dossier-data.mjs` est généré depuis `private/dossier-data.json` par `scripts/prepare-serverless-data.mjs` (appelé automatiquement avant `npm run dev`, `npm run server` et `npm run build`).

En ligne, les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` doivent être définies dans les réglages du projet Vercel, comme pour le build du site.

**Ce qui reste au serveur Node** : `server.mjs` conserve l’ensemble des routes, y compris les certificats et l’administration des paiements. Les fichiers ne passent plus par lui en ligne : ils vont dans le Google Drive du participant (voir ci-dessous), ce qui supprime la limite de 4,5 Mo par requête des fonctions Vercel.

## Fichiers du participant : Google Drive

Aucun document n’est hébergé sur le serveur : les pièces du dossier sont déposées **dans le Google Drive du participant**, dans un dossier « Fiscale — Dossier » créé à la première utilisation. L’application demande la portée `drive.file`, qui ne donne accès qu’aux fichiers qu’elle crée elle-même — jamais au reste du Drive. Comme le téléversement part du navigateur vers Google, ni Vercel ni Supabase ne transportent les documents.

Fonctionnement :

1. à la connexion, `participant-auth.js` demande `access_type=offline` et `prompt=consent`, puis confie le jeton hors ligne à `POST /api/drive-token` ;
2. ce jeton est conservé dans la table `participant_drive_tokens`, protégée par RLS (chaque participant n’accède qu’à sa propre ligne) ; le secret client Google, lui, ne quitte jamais le serveur ;
3. `drive.js` échange ce jeton contre un accès d’une heure, puis écrit et lit directement dans le Drive : envoi, remplacement, renommage, ouverture et suppression, ainsi qu’un sommaire lisible `dossier-index.json` ;
4. `classeur.js` bascule automatiquement : serveur local (`npm run server`) ou Drive du participant en ligne, selon `filesSource` renvoyé par `/api/dossier`.

### Mise en service (côté Google et Supabase)

1. **Google Cloud → Écran de consentement OAuth** : ajouter la portée `https://www.googleapis.com/auth/drive.file`, puis **publier l’application**. En mode « Test », Google expire les autorisations au bout de 7 jours ; une application non vérifiée reste limitée à 100 utilisateurs, ce qui suffit pour démarrer.
2. **Supabase** : appliquer la migration `supabase/migrations/20261011120000_participant_drive_tokens.sql`.
3. **Vercel → Réglages → Variables d’environnement** : ajouter `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (ce sont les identifiants du client OAuth déjà utilisé par Supabase Auth).

Les participants qui s’étaient connectés avant cette mise en service doivent se reconnecter une fois : le classeur affiche un bandeau « Relier mon Google Drive » dans ce cas.

## Vérifier et construire

Aucun déploiement n’est nécessaire pour contrôler l’ensemble :

```bash
npm test
```

- `scripts/test-api-functions.mjs` exécute chaque fonction serverless (refus sans jeton `401`, `402` sans règlement, méthode refusée `405`, réponse complète en mode développement) ;
- `scripts/test-drive-module.mjs` exécute `drive.js` dans un contexte isolé face à un faux Google Drive et vérifie le cycle complet : création du dossier, envoi, sommaire, remplacement, renommage, ouverture et suppression.


```bash
npm run build
```

Le build Vite inclut les pages d’accueil, de connexion participant, d’administration, de découverte Perfecto et le classeur (`classeur.html`). Pour tester les refus d’accès, lancer le serveur avec Supabase configuré et `AUTH_BYPASS=false` : sans jeton, `/api/dossier` doit répondre `401`; un participant sans règlement confirmé doit recevoir `402`; un participant payé ou l’administrateur vérifié doit recevoir `200`. Ces vérifications réelles nécessitent un projet Supabase configuré.

## Contenu du dépôt

- `index.html` — page principale, accès au compte participant et parcours en 7 séquences ; le lien vers le classeur se trouve en Séquence 03.
- `connexion.html` — connexion Google et catalogue du participant.
- `plateforme.css` / `plateforme.js` — interface responsive du catalogue et reprise de formation ; `COURSE_CATALOG` est le point d’extension pour les prochains parcours.
- `admin.html` / `admin.css` / `admin.js` — console protégée de confirmation des paiements et journal des décisions.
- `vite.config.js` — build multipage de la page principale, de l’espace participant et de l’administration.
- `styles.css` — direction artistique, illustrations, infographies et responsive design de la page principale.
- `script.js` — navigation mobile, accordéons, rail de progression, QCM et synchronisation de progression Supabase par participant et formation.
- `participant-auth.js` — compte participant, connexion Google et déconnexion via Supabase Auth.
- `supabase-env.js` — injection des seules valeurs publiques Supabase au build.
- `supabase/migrations/` — profils, progression par participant/formation, droits de paiement, journal d’audit et politiques RLS.
- `scripts/prepare-supabase-vendor.mjs` — copie locale du SDK Supabase pour le serveur et le build.
- `classeur.html` — page d’accès conditionnel et interface du classeur.
- `classeur.css` — styles de la connexion, de l’état de paiement et de la bibliothèque de fichiers.
- `classeur.js` — session Supabase, demande d’accès, recherche, navigation et rendu du classeur.
- `server.mjs` — serveur Node natif, vérification des JWT Supabase et contrôle des droits par formation.
- `api/` — fonctions serverless de Vercel (session, accès, dossier embarqué, liaison Google Drive) et leur socle `api/_lib/`.
- `drive.js` — fichiers du classeur dans le Google Drive du participant.
- `scripts/prepare-serverless-data.mjs` — génération du dossier embarqué pour les fonctions.
- `scripts/test-api-functions.mjs` — banc d’essai des fonctions serverless.
- `scripts/test-drive-module.mjs` — banc d’essai du module Drive face à un faux Google Drive.
- `private/dossier-data.json` — 24 rubriques et 7 sous-rubriques pédagogiques, servies uniquement après validation côté serveur.
- `storage/` — index, certificats et contenu des fichiers de dossiers ; créé automatiquement et ignoré par Git.
- `scripts/` — scripts utilitaires conservés pour les opérations de maintenance.

### Choix de la formation sur la page d’accueil

La page d’accueil s’ouvre sur le catalogue GOBEX : le parcours d’une formation ne s’affiche qu’après son choix par le participant, connecté ou non, car un participant peut suivre plusieurs formations. Le choix est mémorisé par navigateur (`fiscale-home-selected-courses-v1`) et le catalogue reste accessible à tout moment pour changer de formation ; la carte concernée indique alors « Reprendre la formation ».

Les liens directs vers le contenu d’un parcours — `/#programme`, `/#sequence-03`, les ancres du programme ou de l’évaluation — ouvrent d’eux-mêmes la formation concernée : l’espace participant, le classeur et la navigation continuent donc de fonctionner sans détour. Sans JavaScript, la page affiche le parcours complet comme auparavant.

### Mode développeur du parcours pédagogique

Le mode développeur du parcours est réservé à l’administrateur connecté avec le compte Google autorisé ; sur ordinateur, `?mode=developer` ne fait que demander l’affichage du mode après vérification serveur. Une URL ou une valeur `localStorage` ne suffit pas. Sur mobile, le mode reste désactivé même avec ce paramètre ; si la fenêtre devient mobile ou passe en paysage pendant une session développeur, l’accès est coupé pour cette session. L’administration des paiements se fait séparément dans `/admin.html`.

### Reprise du parcours et certificat

La progression, la séquence en cours et les brouillons de QCM sont conservés localement avec une clé propre à la version de chaque formation et, après connexion, au participant. Les anciennes clés locales sont lues pour préserver les données déjà enregistrées ; les prochaines sauvegardes utilisent le format versionné. Les informations du participant, l’aperçu et l’état de confirmation du règlement utilisent des clés séparées (`fiscale-certificate-profile-v1` et `fiscale-certificate-state-v1`) afin de reprendre la demande sur le même appareil.

Le bouton de règlement ouvre le prestataire dans une nouvelle fenêtre sans afficher son adresse dans l’interface. L’application ne prétend pas vérifier un paiement côté client : elle attend une confirmation manuelle dans le flux avant d’activer le bouton de téléchargement. Le bouton PDF ouvre la boîte d’impression du navigateur avec une feuille dédiée au certificat ; choisir « Enregistrer au format PDF ». Une intégration de retour serveur ou de webhook du prestataire sera nécessaire pour une validation financière automatisée en production.

### Validation manuelle des certificats par WhatsApp

Le parcours propose désormais un bouton WhatsApp qui ouvre une conversation préremplie avec le code du certificat et les informations saisies. Le participant doit joindre manuellement son reçu de paiement dans WhatsApp au numéro `+229 0190895323`, car un navigateur ne peut pas joindre automatiquement un fichier local à une conversation WhatsApp.

Après réception du message, le cabinet ouvre l’espace développeur sur ordinateur avec `?mode=developer`, renseigne le code et le nom reçus, puis choisit `Enregistrer en attente`, `Valider le certificat` ou `Révoquer le certificat`. Les décisions sont conservées côté serveur dans `storage/certificates.json` (fichier ignoré par Git). Le bouton de téléchargement du participant reste bloqué tant que le statut serveur n’est pas `validated`.

En production, les API de gestion des certificats et des règlements sont réservées à l’administrateur Supabase vérifié (par défaut `godwingobex@gmail.com`). Le contrôle est fait côté serveur ; le compte et les décisions restent audités. En local, `AUTH_BYPASS=true` permet de tester les interfaces sur ordinateur.

### Protection de copie du contenu

La page de formation et le classeur bloquent la sélection de texte, le menu contextuel, le glisser-déposer d’images et les raccourcis `Ctrl/Cmd+A`, `Ctrl/Cmd+C` et `Ctrl/Cmd+X`, sur ordinateur comme sur mobile. Les champs de formulaire restent sélectionnables et utilisables. Cette protection limite la copie directe depuis l’interface, mais une protection côté navigateur ne peut pas empêcher un utilisateur déterminé d’utiliser les outils de développement, le code source ou une capture d’écran.
