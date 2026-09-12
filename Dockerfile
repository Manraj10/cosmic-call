FROM node:24-slim
WORKDIR /app

# Dev dependencies stay: the build needs tsc and vite, and `npm start` runs the server through tsx.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Set after the build, so `npm ci` above still installs dev dependencies.
ENV NODE_ENV=production
EXPOSE 43128
CMD ["npm", "start"]
