FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/event-bus ./packages/event-bus
COPY notification-service ./notification-service

RUN npm install

WORKDIR /app/notification-service

EXPOSE 3005

CMD ["npm", "run", "dev"]
