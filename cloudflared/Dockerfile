FROM cloudflare/cloudflared:latest

# Tunnel « remotely managed » : la configuration (nom d'hôte public, origine)
# vit dans le tableau de bord Cloudflare Zero Trust, pas ici.
# Le jeton est fourni par la variable d'environnement TUNNEL_TOKEN.
ENTRYPOINT ["cloudflared", "tunnel", "--no-autoupdate", "run"]
