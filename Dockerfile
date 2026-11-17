FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    KANBAN_DATA_DIR=/data \
    KANBAN_SEED=empty

WORKDIR /app

# su-exec permet de démarrer en root (pour préparer le volume de données),
# puis de repasser sur l'utilisateur node avant de lancer l'application.
RUN apk add --no-cache su-exec

# Aucune dependance a installer : on copie simplement l'application.
COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data \
    && chown -R node:node /data /app

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
