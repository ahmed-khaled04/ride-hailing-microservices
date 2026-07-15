FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/event-bus ./packages/event-bus
COPY trip-service ./trip-service


RUN npm install

WORKDIR /app/trip-service

EXPOSE 3002

CMD ["npm", "run", "dev"]
