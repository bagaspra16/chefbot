# ChefBot API + static frontend
FROM node:20-alpine
RUN apk add --no-cache curl

WORKDIR /app

# API dependencies
COPY api/package.json ./
RUN npm install --omit=dev

# API and frontend (context is project root)
COPY api/server.js api/domain.js ./
COPY index.html app.js styles.css ./public/

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "server.js"]
