# Single-container image: the Next.js app (Weather and Fuel Tracker) on one port.
# Build:  docker build -t tolg-content-generator .
# Run:    docker run -p 3000:3000 tolg-content-generator

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

CMD ["npm", "start"]
