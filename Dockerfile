# FROM node:20-alpine
FROM node:20-slim
# FROM --platform=linux/arm64 node:20-slim
# Chnage the above line to 

WORKDIR /api-server

COPY . .
ENV npm_config_arch=x64
ENV npm_config_platform=linux
RUN yarn install
RUN yarn build

EXPOSE 9999
CMD ["yarn", "start:app"]
