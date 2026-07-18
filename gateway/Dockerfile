FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/event-bus ./packages/event-bus
COPY gateway ./gateway

RUN npm install

WORKDIR /app/gateway

EXPOSE 3000

CMD ["npm", "run", "dev"]
