# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=24.14.0

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV production

RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

# Copy dependency manifests first to maximize layer caching.
COPY --chown=node:node package*.json ./

# Install production dependencies. Fall back to npm install when no lockfile exists.
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy the rest of the source files into the image.
COPY --chown=node:node . .

# Run the application as a non-root user.
USER node

# Expose the port that the application listens on.
EXPOSE 8080

# Run the application.
CMD node src/server.js
