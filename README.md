# Flowboard — Kanban d'équipe avec extraction de user stories

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
- Tout est stocké dans `data/db.json` (créé au premier lancement, avec une démo).
- **Export / Import** JSON depuis la barre latérale (sauvegarde, partage, versionnage).
- Le bouton `…` sur le projet permet de réinitialiser la démo.

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
| `KANBAN_LLM_API_KEY` | — | Clé API du fournisseur |
| `KANBAN_LLM_BASE_URL` | `https://api.openai.com/v1` | Endpoint compatible OpenAI |
| `KANBAN_LLM_MODEL` | `gpt-4o-mini` | Modèle utilisé |
| `KANBAN_AUTH_MODE` | `none` | `proxy` pour exiger un utilisateur SSO (voir ci-dessous) |
| `KANBAN_AUTH_HEADER` | `x-auth-request-email` | En-tête posé par le proxy d'authentification |
| `KANBAN_AUTH_DOMAINS` | — | Domaines autorisés, séparés par des virgules (`studio.fr,autre.fr`) |

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

---

## CI / CD

### Intégration continue (`.github/workflows/ci.yml`)

À chaque push sur `main`/`dev` et à chaque pull request :

| Job | Contenu |
|---|---|
| **Moteur & formats** | `npm test` sur Node 18, 20 et 22 : extraction (13 formats de CR), lecture `.docx`/`.pdf`, assertions sur les résultats |
| **Parcours UI** | démarre le serveur, puis Chrome headless rejoue le parcours complet (tableau, drawer, backlog, analyse, diagnostic, thème sombre, mobile) et échoue à la moindre erreur JS |

### Livraison continue (`.github/workflows/docker.yml`)

À chaque push, une image Docker multi-arch (`linux/amd64`, `linux/arm64`) est construite et publiée sur GitHub Container Registry :

```
ghcr.io/annayia-04/kanban-tce:main    # dernière version de main
ghcr.io/annayia-04/kanban-tce:dev     # dernière version de dev
ghcr.io/annayia-04/kanban-tce:sha-…   # commit précis
ghcr.io/annayia-04/kanban-tce:1.2.3   # tag git v1.2.3
```

Les pull requests construisent l'image sans la publier (validation du `Dockerfile`).

### Déployer l'image

```bash
docker compose pull
docker compose up -d
```

`compose.yaml` monte un volume `flowboard-data` sur `/data` et n'expose le port que sur
`127.0.0.1:4321` — le proxy d'authentification reste devant (voir la section SSO).

### Déploiement automatique (optionnel)

Le job `deploy` du workflow Docker ne s'active que si la variable de dépôt `DEPLOY_HOST` existe.
Il se connecte en SSH et exécute `docker compose pull && docker compose up -d` sur le serveur.

| Type | Nom | Rôle |
|---|---|---|
| Variable | `DEPLOY_HOST` | Hôte SSH (active le job) |
| Variable | `DEPLOY_USER` | Utilisateur SSH (défaut `deploy`) |
| Variable | `DEPLOY_PATH` | Dossier du `compose.yaml` (défaut `/opt/flowboard`) |
| Secret | `DEPLOY_SSH_KEY` | Clé privée SSH autorisée sur le serveur |

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
lib/seed.js            Données de démonstration
public/                Interface (HTML/CSS/JS vanilla, sans build)
scripts/               Tests du moteur et de l'interface (Chrome headless)
exemples/              Comptes rendus d'exemple
data/db.json           Données (générées)
Dockerfile             Image de production
compose.yaml           Déploiement (volume + variables SSO)
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
| `POST` | `/api/stories/reorder` | `{ status, ids }` |
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
npm test           # moteur d'extraction (13 formats) + .docx/.pdf, avec assertions
npm run test:ui    # parcours complet dans Chrome headless (serveur démarré à côté)
```

Les tests sortent en code 1 au moindre échec : ils servent aussi de garde-fous en CI.

## Notes

- Pas d'authentification intégrée : l'outil est prévu pour un usage local, un réseau de confiance,
  ou derrière le SSO d'entreprise (voir **Déploiement derrière un SSO**).
- Les données ne quittent la machine que si tu actives un modèle IA distant.
- `npm start` suffit : aucune étape de build, aucun `npm install`.
