FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/event-bus ./packages/event-bus
COPY location-service ./location-service

RUN npm install

WORKDIR /app/location-service

EXPOSE 3004

CMD ["npm", "run", "dev"]
