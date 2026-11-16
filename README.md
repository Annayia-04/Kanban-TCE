# Flowboard — Kanban d'équipe avec extraction de user stories

[![CI](https://github.com/Annayia-04/Kanban-TCE/actions/workflows/ci.yml/badge.svg)](https://github.com/Annayia-04/Kanban-TCE/actions/workflows/ci.yml)
[![Image Docker](https://github.com/Annayia-04/Kanban-TCE/actions/workflows/docker.yml/badge.svg)](https://github.com/Annayia-04/Kanban-TCE/actions/workflows/docker.yml)
[![Release](https://github.com/Annayia-04/Kanban-TCE/actions/workflows/release.yml/badge.svg)](https://github.com/Annayia-04/Kanban-TCE/actions/workflows/release.yml)

Un Kanban d'équipe **local** : tu déposes un compte rendu de réunion, l'outil en extrait les
actions, les transforme en **user stories** et les **assigne aux personnes concernées**.
Tu retrouves ensuite tout dans un **backlog** filtrable par **version (v1, v2…)** et par
**statut** (À faire, En cours, À review, Fait).

Aucune dépendance à installer, aucune base de données, aucune clé API obligatoire.

```bash
npm start
# → http://127.0.0.1:4321
```

---

## Ce que fait l'application

### 1. Import d'un compte rendu
- Glisser-déposer un fichier **.txt, .md, .docx, .odt ou .pdf**, ou coller le texte.
- Formats `.doc` (ancien Word) non pris en charge → enregistrer en `.docx`.
- Les PDF scannés (images) ne contiennent pas de texte : utiliser le copier-coller.

### 2. Extraction des actions
Le moteur local analyse le texte en français (et les comptes rendus en anglais) et détecte :
- les **verbes d'action** (`doit`, `va`, `il faut`, `créer`, `finaliser`, `corriger`, `prévoir`…) ;
- le **responsable** : nom cité, alias, `@prénom`, préfixe `Marie : …`, `— Thomas`, `(Thomas)`,
  `Responsable : …`, `Qui : …`, ou héritage de la ligne précédente ;
- la **version** : `v1`, `v2`, `v3.1`, `MVP`, `phase 2` → rattachée automatiquement à la version existante ;
- l'**échéance** : `avant vendredi`, `pour le 12/11`, `fin du mois`, `sprint 4`, `Échéance : …` ;
- la **priorité** : `urgent`, `critique`, `bloquant` → haute ; `nice to have`, `si possible` → basse ;
- les **doublons** avec le backlog existant (similarité de titre).

Formats de CR reconnus :
- listes à puces (`-`, `•`, `1.`, `→`…) et **cases à cocher** (`- [ ]`, `- [x]`) ;
- **tableaux** Markdown (`| Action | Responsable | Échéance |`) et tableaux collés depuis Word/Excel
  (colonnes séparées par des tabulations) ;
- blocs multi-lignes `Action : … / Responsable : … / Échéance : … / Priorité : … / Version : …`,
  y compris en puces (`- Qui : Thomas`) ;
- **user stories déjà rédigées** : « En tant que… je veux… afin de… » (FR) et « As a… I want… » (EN) ;
- paragraphes de prose (« Thomas devra livrer l'écran d'inscription avant vendredi »).

Les **décisions**, l'**ordre du jour**, la liste des **participants** et les formules de politesse
sont écartés pour éviter les faux positifs.

Chaque proposition est présentée avec un **indice de confiance** et sa **phrase source**
(ligne + section), que tu peux corriger avant import.

**Rien n'est détecté ?** Le bouton **Diagnostic** (écran de revue, ou fiche d'un compte rendu)
affiche chaque ligne analysée avec la raison pour laquelle elle a été retenue ou écartée.
C'est le moyen le plus rapide de voir si le fichier a bien été lu (PDF scanné, `.doc` ancien…).

### 3. Revue et import
- Écran de revue : coche/décoche, renomme, réassigne, change version/priorité/statut.
- Un clic sur **Importer dans le backlog** crée les US avec des clés `US-1`, `US-2`…

### 4. Kanban
- 4 colonnes : **À faire · En cours · À review · Fait**.
- Glisser-déposer pour changer de statut et réordonner.
- Filtres globaux : recherche plein texte, version, personne.
- Carte : clé, version, tags, priorité (bordure), échéance, points, avatars.

### 5. Backlog
- Toutes les US, groupées par version, avec statut modifiable en ligne.
- Tri par clé, compteurs d'US et de points par version.

### 6. Équipe
- Membres, rôles, emails et **alias** (les alias améliorent la reconnaissance dans les CR).
- Statistiques par personne (À faire / En cours / Review / Fait).

### 7. Données
- Tout est stocké dans `data/db.json` (créé au premier lancement, avec une démo en local).
- En production, `KANBAN_SEED=empty` démarre avec un projet vide (voir **Déployer l'image**).
- **Export / Import** JSON depuis la barre latérale (sauvegarde, partage, versionnage).
- Le bouton `…` sur le projet permet de réinitialiser la démo (désactivé en production).

---

## Vote d'équipe sur les US sans version

Une user story sans **version** n'est pas encore qualifiée : on ne sait pas si elle part en v1,
v2 ou plus tard. L'écran **Qualification** (barre latérale) permet à l'équipe de trancher par un
vote anonyme :

- **Pour** ajoute une voix au compteur « pour », **Contre** au compteur « contre » ;
- le **score** affiché est `pour − contre` ; la file est triée du score le plus haut au plus bas ;
- les compteurs sont **anonymes** (aucun compte, aucun vote nominatif) et partagés par toute
  l'équipe — chaque clic compte ;
- **Qualifier en…** attribue une version : l'US sort du vote et rejoint le backlog ;
- une US déjà qualifiée (version assignée) ne peut plus recevoir de votes : l'API répond `409` ;
- l'icône ↻ remet les compteurs à zéro.

Le vote est aussi disponible dans la fiche d'une US (drawer), et le score apparaît sur les cartes
du tableau ainsi que dans la colonne *Version* du backlog tant que l'US n'est pas qualifiée.

---

## Suggestions signées et boîte à idées

Le vote reste **anonyme**, mais tout ce qui est *écrit* par un membre est **signé** : c'est
l'identité transmise par le SSO (en-tête email) qui fait foi. Deux endroits pour proposer :

### 1. Suggestions sur une US existante

Dans la fiche d'une US (drawer, y compris depuis l'écran **Qualification**), un bloc
**Suggestions** liste les remarques de l'équipe, chacune avec son auteur, sa date et son texte :

- tout membre connecté peut ajouter une suggestion (3 à 1000 caractères, 50 maximum par US) ;
- **seul l'auteur peut supprimer sa propre suggestion** — le lien *Supprimer* n'apparaît que sur
  les siennes, et l'API répond `403` sinon ;
- les suggestions restent visibles après la qualification de l'US (elles documentent la décision).

Un compteur 💬 sur la ligne de vote indique le nombre de suggestions.

### 2. Boîte à idées

L'écran **Idées** (barre latérale) sert aux US qui n'existent pas encore :

- **Proposer une idée** : titre + détail, signés de l'auteur ;
- l'équipe **vote pour/contre** avec les mêmes compteurs anonymes que les US (score `pour − contre`,
  tri par score) ;
- **Promouvoir** transforme l'idée en user story **sans version** (elle arrive en Qualification,
  taguée `idée`), avec l'auteur de l'idée comme propriétaire ; une idée ne peut être promue qu'une
  fois et son vote est alors clos (`409`) ;
- **seul l'auteur peut supprimer son idée** (ses votes partent avec).

Si l'US issue d'une idée est supprimée, l'idée redevient ouverte et votable.

### 3. Qui peut supprimer une US ?

Chaque US créée porte l'email de son auteur (`createdBy`) : création manuelle, import de CR ou
promotion d'idée. La règle est appliquée **côté serveur** :

| Cas | Suppression |
|---|---|
| US créée par moi | ✅ oui |
| US créée par un autre membre | ❌ `403` (bouton désactivé dans l'interface) |
| US sans auteur (démo, données importées avant cette version) | ✅ par tout le monde |

La modification (titre, statut, version…) reste ouverte à toute l'équipe.

### 4. Mode local (sans SSO)

Sans identité, l'application reste utilisable en **consultation** : les suggestions et les idées
sont visibles avec leurs auteurs, mais les formulaires sont remplacés par un rappel
« Connecte-toi via le SSO… » et les boutons *Proposer / Promouvoir / Supprimer* sont désactivés.
Le vote pour/contre, lui, continue de fonctionner puisqu'il est anonyme.

Pour tester en local, lance l'application en mode proxy derrière un petit proxy qui injecte
l'en-tête (voir **Déploiement derrière un SSO**) :

```bash
KANBAN_AUTH_MODE=proxy KANBAN_AUTH_DOMAINS=studio.fr npm start
# puis, via le proxy : x-auth-request-email: marie@studio.fr
```

---

## Activer l'IA (optionnel)

Par défaut, l'extraction est **100 % locale et hors ligne**. Pour une extraction sémantique
(meilleure compréhension des formulations implicites), branche un modèle compatible
`chat/completions` :

```bash
# OpenAI
KANBAN_LLM_API_KEY=sk-... KANBAN_LLM_MODEL=gpt-4o-mini npm start

# Ollama en local (aucune clé nécessaire)
KANBAN_LLM_BASE_URL=http://localhost:11434/v1 KANBAN_LLM_MODEL=llama3.1 npm start

# LM Studio, vLLM, Mistral, OpenRouter… même principe
KANBAN_LLM_BASE_URL=https://openrouter.ai/api/v1 KANBAN_LLM_API_KEY=... KANBAN_LLM_MODEL=... npm start
```

En cas d'échec de l'IA, l'analyse locale reprend automatiquement (un bandeau l'indique).
Le moteur actif est affiché en bas de la barre latérale.

### Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `4321` | Port HTTP |
| `HOST` | `127.0.0.1` | Mettre `0.0.0.0` pour exposer sur le réseau local |
| `KANBAN_DATA_DIR` | `./data` | Dossier de stockage |
| `KANBAN_SEED` | `demo` (image Docker : `empty`) | Données du premier lancement : `demo` ou `empty` (production) |
| `KANBAN_LLM_API_KEY` | — | Clé API du fournisseur |
| `KANBAN_LLM_BASE_URL` | `https://api.openai.com/v1` | Endpoint compatible OpenAI |
| `KANBAN_LLM_MODEL` | `gpt-4o-mini` | Modèle utilisé |
| `KANBAN_AUTH_MODE` | `none` | `none`, `proxy` (SSO) ou `basic` (secours sans SSO) |
| `KANBAN_AUTH_HEADER` | `x-auth-request-email` | En-tête posé par le proxy d'authentification |
| `KANBAN_AUTH_DOMAINS` | — | Domaines autorisés, séparés par des virgules (`studio.fr,autre.fr`) |
| `KANBAN_BASIC_USERS` | — | Comptes du mode `basic` : `email:motdepasse,email:motdepasse` |

---

## Déploiement derrière un SSO

L'application n'embarque pas de gestion de comptes : elle est faite pour être placée **derrière
le SSO de l'entreprise** (Azure AD/Entra ID, Google Workspace, Okta, Keycloak…), via un proxy
d'authentification. Le proxy authentifie l'utilisateur puis transmet son identité dans un en-tête
HTTP ; Flowboard refuse toute requête sans cet en-tête.

### 1. Mode proxy (recommandé)

```bash
KANBAN_AUTH_MODE=proxy \
KANBAN_AUTH_HEADER=x-auth-request-email \
KANBAN_AUTH_DOMAINS=monentreprise.fr \
HOST=0.0.0.0 PORT=4321 npm start
```

- `KANBAN_AUTH_MODE=proxy` : accès refusé (401) si l'en-tête est absent ; 403 si le domaine ne
  correspond pas à `KANBAN_AUTH_DOMAINS`.
- L'utilisateur connecté apparaît en bas de la barre latérale.
- `GET /healthz` reste public (sonde de disponibilité).

> ⚠️ En mode proxy, le port de l'application **ne doit pas être exposé** publiquement : seul le
> proxy doit pouvoir l'atteindre (`127.0.0.1` ou réseau Docker privé). Sinon n'importe qui peut
> forger l'en-tête.

### 2. Exemple nginx + oauth2-proxy

```nginx
location / {
    auth_request /oauth2/auth;
    error_page 401 = /oauth2/sign_in;

    auth_request_set $user $upstream_http_x_auth_request_email;
    proxy_set_header X-Auth-Request-Email $user;

    proxy_pass http://127.0.0.1:4321;
}
```

### 3. Exemple Cloudflare Access

Cloudflare Access ajoute `Cf-Access-Authenticated-User-Email` ; configure le tunnel vers
l'application et lance :

```bash
KANBAN_AUTH_MODE=proxy KANBAN_AUTH_HEADER=cf-access-authenticated-user-email npm start
```

### 4. Autres proxys

| Proxy | En-tête typique |
|---|---|
| oauth2-proxy | `X-Auth-Request-Email` |
| Cloudflare Access | `Cf-Access-Authenticated-User-Email` |
| Traefik forward-auth / Authelia | `Remote-Email` (à configurer) |
| En-tête maison | `X-Forwarded-User` (à configurer) |

Sans `KANBAN_AUTH_MODE`, l'application reste **ouverte** : c'est le mode par défaut pour un usage
local, à ne pas utiliser en production.

### 5. Mode `basic` (secours sans proxy SSO)

Si tu n'as pas encore de SSO mais que l'application doit être en ligne, `KANBAN_AUTH_MODE=basic`
protège l'accès par une authentification HTTP Basic, avec **un compte par membre** :

```bash
KANBAN_AUTH_MODE=basic \
KANBAN_BASIC_USERS='marie@studio.fr:motdepasse1,thomas@studio.fr:motdepasse2' \
KANBAN_AUTH_DOMAINS=studio.fr \
npm start
```

- l'**email est l'identité** : suggestions, idées et propriété des US fonctionnent exactement comme
  avec le SSO (l'utilisateur voit son nom dans la barre latérale) ;
- le navigateur affiche sa fenêtre de connexion native (challenge `WWW-Authenticate`), il n'y a
  pas d'écran de login à coder ;
- `KANBAN_AUTH_DOMAINS` filtre les emails autorisés ;
- en cas d'absence de comptes configurés, l'application répond `503`.

> C'est un mode de transition : pas de MFA, pas de révocation centralisée, mots de passe partagés
> dans une variable d'environnement. Dès qu'un proxy SSO est disponible, passe en `proxy`.

---

## CI / CD

### Intégration continue (`.github/workflows/ci.yml`)

À chaque push sur `main`/`dev` et à chaque pull request :

| Job | Contenu |
|---|---|
| **Moteur & formats** | `npm test` sur Node 18, 20 et 22 : extraction (13 formats de CR), lecture `.docx`/`.pdf`, API vote / suggestions / idées, mode production vide |
| **Parcours UI** | démarre le serveur, puis Chrome headless rejoue le parcours complet (tableau, drawer, backlog, analyse, diagnostic, qualification, idées, thème sombre, mobile) et échoue à la moindre erreur JS |

### Livraison continue (`.github/workflows/docker.yml`)

À chaque push, une image Docker multi-arch (`linux/amd64`, `linux/arm64`) est construite et publiée sur GitHub Container Registry :

```
ghcr.io/annayia-04/kanban-tce:main    # dernière version de main
ghcr.io/annayia-04/kanban-tce:dev     # dernière version de dev
ghcr.io/annayia-04/kanban-tce:staging # image de staging (branche dev)
ghcr.io/annayia-04/kanban-tce:sha-…   # commit précis
ghcr.io/annayia-04/kanban-tce:1.2.3   # release (v1.2.3)
ghcr.io/annayia-04/kanban-tce:1.2     # dernière 1.2.x
ghcr.io/annayia-04/kanban-tce:latest  # dernière release stable
```

Les pull requests construisent l'image sans la publier (validation du `Dockerfile`).

### Releases (`.github/workflows/release.yml`)

Deux façons de publier une version :

**1. Depuis GitHub** — onglet *Actions → Release → Run workflow* : choisir `patch`, `minor` ou
`major`, la branche (`main` par défaut) et éventuellement *pré-release*. Le workflow :

1. lance `npm test` (garde-fou) ;
2. incrémente la version dans `package.json` et commit `chore(release): vX.Y.Z` ;
3. crée le tag annoté `vX.Y.Z` et pousse commit + tag ;
4. construit et publie l'image avec les tags `X.Y.Z`, `X.Y`, `sha-…`, `latest` et la branche ;
5. publie la **release GitHub** avec les notes générées automatiquement.

**2. Par tag git** — `git tag v1.2.3 && git push origin v1.2.3` : même image et même release, sans
modifier `package.json`. Une version contenant un suffixe (`v1.3.0-rc.1`) est automatiquement
marquée pré-release et ne met pas à jour `latest`.

> Le commit de release est poussé avec le `GITHUB_TOKEN` : GitHub ne relance donc pas CI/Docker
> sur ce push. C'est voulu — le workflow de release lance les tests lui-même et publie l'image.
> Si la branche `main` est protégée, autorise le bot `github-actions[bot]` à pousser (ou lance le
> workflow depuis une branche non protégée).

### Déployer l'image

L'image publiée démarre **sans données de démonstration** (`KANBAN_SEED=empty`) : c'est la version
de production. Le mode démo reste disponible avec `KANBAN_SEED=demo` (c'est ce que fait le
staging).

```bash
# production — projet vide, port 4321
docker compose pull
docker compose up -d

# staging — démo complète, port 4322, volume séparé
docker compose -f compose.staging.yaml pull
docker compose -f compose.staging.yaml up -d
```

Pour tester les deux modes **sans Docker** (dossiers de données séparés, aucun risque pour la
démo locale) :

```bash
npm run start:prod      # http://127.0.0.1:4321 — projet vide, données dans data-prod/
npm run start:staging   # http://127.0.0.1:4322 — démo, données dans data-staging/
```

| | Production (`compose.yaml`) | Staging (`compose.staging.yaml`) |
|---|---|---|
| Image | `main` / release | `staging` (branche `dev`) |
| Premier lancement | **aucune donnée** (`KANBAN_SEED=empty`) | démo complète (`KANBAN_SEED=demo`) |
| Réinitialisation démo | refusée (`403`) | bouton actif |
| Port local | `127.0.0.1:4321` | `127.0.0.1:4322` |
| Volume | `flowboard-data` | `flowboard-staging-data` |

En production, les boutons **Réinitialiser la démo** et **Charger l'exemple** sont masqués, et
`POST /api/reset` répond `403` : les données réelles ne peuvent pas être écrasées par la démo.

Les données vivent dans le volume `/data` (`db.json`). Conséquences pour l'hébergement :

- **une seule instance** doit écrire dans le volume (pas de scale horizontal) ;
- le volume doit être **persistant**, sinon tout est perdu au redéploiement ;
- sauvegarde = export JSON depuis la barre latérale, ou copie du volume.

L'image prépare elle-même le volume `/data` (droits de l'utilisateur `node`) avant de lancer
l'application : elle fonctionne donc aussi avec un volume monté par une plateforme (Railway,
Render) sans réglage de permissions.

#### Où héberger ?

1. **VPS + Docker Compose** (recommandé) : 2 Go de RAM suffisent, un nom de domaine, HTTPS via
   Caddy/nginx et le SSO via oauth2-proxy. Les deux fichiers compose peuvent cohabiter sur la
   même machine (ports 4321 et 4322) derrière deux domaines (`kanban.…` et `staging.kanban.…`).
2. **PaaS avec disque persistant** (Render, Railway, Fly.io…) : déploie l'image
   `ghcr.io/annayia-04/kanban-tce:main`, monte un volume sur `/data`, garde **1 instance** et
   pointe le healthcheck sur `/healthz`. Ajoute les variables `KANBAN_AUTH_MODE=proxy`, etc.
3. **Serveur maison + Cloudflare Tunnel** : simple pour une équipe, l'accès restant protégé par
   Cloudflare Access.

À éviter : les plateformes **serverless** (Vercel, Netlify Functions…) — l'application écrit un
fichier JSON et garde l'état en mémoire, il lui faut un disque persistant et un processus unique.

#### Render (blueprint fourni)

`render.yaml` décrit les **deux** services : `flowboard` (prod, `KANBAN_SEED=empty`) et
`flowboard-staging` (branche `dev`, `KANBAN_SEED=demo`), chacun avec un disque de 1 Go.

1. Pousser le dépôt sur GitHub avec les branches `main` et `dev`.
2. Render → **New → Blueprint**, choisir le dépôt : Render lit `render.yaml`.
3. Renseigner les variables secrètes demandées :
   - `KANBAN_BASIC_USERS` = `marie@studio.fr:motdepasse1,thomas@studio.fr:motdepasse2`
   - `KANBAN_AUTH_DOMAINS` = `studio.fr`
4. **Apply** : l'URL de prod ressemble à `https://flowboard.onrender.com`, le staging à
   `https://flowboard-staging.onrender.com`. HTTPS et le domaine `onrender.com` sont fournis.
5. Vérifier `https://…/healthz` → `{"ok":true,…}`.

> Les disques Render nécessitent le plan **Starter** (environ 7 $/service/mois). Sans disque,
> `db.json` est perdu à chaque redéploiement.

#### Railway (Dockerfile fourni)

1. **New Project → Deploy from GitHub repo** : Railway détecte le `Dockerfile` (et `railway.json`).
2. **Settings → Source** : choisis la branche à déployer (`main` en prod, `dev` en staging).
3. Variables : `KANBAN_SEED=empty`, `KANBAN_AUTH_MODE=basic`, `KANBAN_BASIC_USERS=…`,
   `KANBAN_AUTH_DOMAINS=…`, `KANBAN_DATA_DIR=/data`. Ne fixe pas `PORT` : Railway le fournit.
4. **Volume** → monter sur `/data` (1 Go suffit).
5. **Settings → Networking → Generate Domain** : HTTPS fourni, aucune configuration DNS.
6. Staging : **New Environment → staging** (ou dupliquer le service), brancher `dev`, passer
   `KANBAN_SEED=demo` et utiliser un volume distinct (les volumes sont propres à chaque
   environnement).

Dans les deux cas, l'accès est protégé par le mode `basic` tant qu'il n'y a ni domaine ni SSO :
le navigateur demande l'email et le mot de passe configurés dans `KANBAN_BASIC_USERS`. Ajoute un
domaine et un proxy SSO plus tard, sans changer les données.

> ⚠️ Le staging contient des données de démo et autorise leur réinitialisation : ne l'expose pas
> publiquement sans authentification. Le plus simple est de le placer derrière le même SSO que la
> production, avec un domaine séparé.

### Déploiement automatique (optionnel)

Le job `deploy` du workflow Docker ne s'active que si la variable de dépôt `DEPLOY_HOST` existe.
Il se connecte en SSH et exécute `docker compose pull && docker compose up -d` sur le serveur.
Le job `deploy-staging` fait de même sur la branche `dev`, avec `compose.staging.yaml`.

| Type | Nom | Rôle |
|---|---|---|
| Variable | `DEPLOY_HOST` | Hôte SSH de production (active le job) |
| Variable | `DEPLOY_USER` | Utilisateur SSH (défaut `deploy`) |
| Variable | `DEPLOY_PATH` | Dossier du `compose.yaml` (défaut `/opt/flowboard`) |
| Secret | `DEPLOY_SSH_KEY` | Clé privée SSH autorisée sur le serveur |
| Variable | `STAGING_HOST` | Hôte SSH du staging (active le job sur `dev`) |
| Variable | `STAGING_USER` | Utilisateur SSH du staging (défaut `deploy`) |
| Variable | `STAGING_PATH` | Dossier du `compose.staging.yaml` (défaut `/opt/flowboard-staging`) |
| Secret | `STAGING_SSH_KEY` | Clé privée SSH du staging |

Sans ces réglages, le pipeline reste purement CI + publication d'image.

---

## Structure

```
server.js              Serveur HTTP + API REST (aucune dépendance)
lib/store.js           Persistance JSON et normalisation des US
lib/extract.js         Moteur d'extraction local (français / anglais)
lib/llm.js             Couche IA optionnelle
lib/office.js          Extraction de texte .docx / .odt / .pdf
lib/zip.js             Lecteur ZIP minimal (pour .docx/.odt)
lib/seed.js            Données de démonstration + état vide de production
public/                Interface (HTML/CSS/JS vanilla, sans build)
scripts/               Tests du moteur et de l'interface (Chrome headless)
exemples/              Comptes rendus d'exemple
data/db.json           Données (générées)
Dockerfile             Image de production (démarre vide)
compose.yaml           Production (volume + variables SSO)
compose.staging.yaml   Staging (démo, port 4322, volume séparé)
render.yaml            Blueprint Render (prod + staging)
railway.json           Configuration Railway (Dockerfile + healthcheck)
.github/workflows/     CI (tests) et CD (image GHCR)
```

### API

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/state` | État complet |
| `PATCH` | `/api/project` | Nom / sprint / description |
| `POST` | `/api/analyze` | `{ text }` ou `{ filename, fileBase64 }` → candidats |
| `POST` | `/api/reports/:id/import` | Crée les US depuis les candidats |
| `GET`/`DELETE` | `/api/reports/:id` | Détail / suppression |
| `GET` | `/api/reports/:id/diagnose` | Journal d'analyse (lignes retenues / écartées + raisons) |
| `POST`/`PATCH`/`DELETE` | `/api/stories[/:id]` | User stories |
| `POST` | `/api/stories/:id/vote` | Vote pour/contre sur une US sans version — `{ value: 1 \| -1 \| 0 }` |
| `POST` | `/api/stories/:id/suggestions` | Suggestion signée sur une US — `{ text }` (SSO requis) |
| `DELETE` | `/api/stories/:id/suggestions/:sid` | Supprime sa suggestion (SSO requis) |
| `POST` | `/api/stories/reorder` | `{ status, ids }` |
| `POST`/`DELETE` | `/api/ideas[/:id]` | Boîte à idées signée (SSO requis) |
| `POST` | `/api/ideas/:id/vote` | Vote pour/contre sur une idée — `{ value: 1 \| -1 \| 0 }` |
| `POST` | `/api/ideas/:id/promote` | Promeut l'idée en US sans version (SSO requis) |
| `POST`/`PATCH`/`DELETE` | `/api/members[/:id]` | Équipe |
| `POST`/`DELETE` | `/api/versions[/:id]` | Versions |
| `GET` | `/api/export` · `POST /api/import` | Sauvegarde / restauration |
| `POST` | `/api/reset` | Réinitialise la démo |

---

## Raccourcis clavier

| Touche | Action |
|---|---|
| `/` | Rechercher |
| `N` | Nouvelle user story |
| `Échap` | Fermer le panneau / la modale |

## Tests

```bash
npm test           # extraction (13 formats) + .docx/.pdf + API vote, suggestions, idées et droits, avec assertions
npm run test:ui    # parcours complet dans Chrome headless (serveur démarré à côté)
```

Les tests sortent en code 1 au moindre échec : ils servent aussi de garde-fous en CI.

## Notes

- Pas d'authentification intégrée : l'outil est prévu pour un usage local, un réseau de confiance,
  ou derrière le SSO d'entreprise (voir **Déploiement derrière un SSO**).
- L'image Docker démarre **vide** (production) ; `KANBAN_SEED=demo` restaure le jeu de démo, et
  le staging l'active par défaut.
- Les données ne quittent la machine que si tu actives un modèle IA distant.
- `npm start` suffit : aucune étape de build, aucun `npm install`.
