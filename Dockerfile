FROM node:16-alpine

RUN apk update && apk add curl
RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

WORKDIR /usr/app/src/web-player

COPY ./src/web-player/package.json ./src/web-player/pnpm-lock.yaml ./
RUN pnpm install

WORKDIR /usr/app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY nodemon.json tsconfig.json ./
COPY src src

RUN (cd ./src/web-player && npm run build)

EXPOSE 8080

CMD ["npm", "run", "start-server"]
