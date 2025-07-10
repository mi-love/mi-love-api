FROM node:20-slim
WORKDIR /api-server

# Set correct environment for native binaries (e.g., onnxruntime-node)
ENV npm_config_arch=x64
ENV npm_config_platform=linux
COPY package.json yarn.lock ./

RUN yarn install
COPY . .
RUN yarn build
EXPOSE 9999
CMD ["yarn", "start:app"]
