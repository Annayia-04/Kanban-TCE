# Service `cloudflared`

Ce dossier ne contient pas l'application : c'est le **connecteur** entre Cloudflare et
Flowboard. Il s'exécute comme un second service Railway (ou un conteneur à côté de
`compose.yaml`), et permet de rendre Flowboard accessible uniquement à travers Cloudflare
Access, sans exposer de port public.

```
navigateur → Cloudflare Access (code par email) → tunnel → kanban-tce.railway.internal:8080
```

## Variables

| Variable | Rôle |
|---|---|
| `TUNNEL_TOKEN` | Jeton du tunnel, copié depuis Cloudflare Zero Trust → Networks → Tunnels |

Le nom d'hôte public et l'origine (`http://kanban-tce.railway.internal:8080`) se configurent
dans le tableau de bord Cloudflare, dans l'onglet **Public Hostname** du tunnel.

## Déploiement Railway

```bash
railway add --service cloudflared
railway variable set TUNNEL_TOKEN=… --service cloudflared --skip-deploys
railway up cloudflared --service cloudflared
```

Le service n'a besoin ni de volume ni de domaine public. Voir le README principal, section
« Cloudflare Access (sans SSO Google) », pour la procédure complète.
