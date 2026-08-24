FROM node:22-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY website/package.json /app/website/package.json
WORKDIR /app/website
RUN npm install

COPY backoffice/package.json /app/backoffice/package.json
WORKDIR /app/backoffice
RUN npm install

COPY start.sh /start.sh
RUN chmod +x /start.sh

WORKDIR /app
CMD ["/start.sh"]
