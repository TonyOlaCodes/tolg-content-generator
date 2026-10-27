# Single-container image: Next.js client + the authoritative game server on one port.
# Build:  docker build -t elephant-in-the-room .
# Run:    docker run -p 3000:3000 elephant-in-the-room

FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# install everything (the build needs devDependencies such as next and tsx)
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

EXPOSE 3000

# main.ts serves the built Next.js app and hosts the game socket on /ws
CMD ["npx", "tsx", "main.ts"]
