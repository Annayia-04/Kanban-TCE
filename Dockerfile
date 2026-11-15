# syntax=docker/dockerfile:1
FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    KANBAN_DATA_DIR=/data

WORKDIR /app

# Aucune dependance a installer : on copie simplement l'application.
COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 4321
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
