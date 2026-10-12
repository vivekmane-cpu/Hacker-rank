FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY web/package*.json ./web/

RUN npm install --workspace=server

COPY server ./server

WORKDIR /app/server
RUN npm run build

EXPOSE 4000
CMD ["npm", "start"]
