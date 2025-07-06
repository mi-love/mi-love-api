FROM node:20-alpine

WORKDIR /api-server

COPY . .
RUN yarn install
RUN yarn build

EXPOSE 9999
CMD ["yarn", "start:app"]
