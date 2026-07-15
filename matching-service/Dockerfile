FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/event-bus ./packages/event-bus
COPY matching-service ./matching-service


RUN npm install

WORKDIR /app/matching-service

EXPOSE 3003

CMD ["npm", "run", "dev"]
