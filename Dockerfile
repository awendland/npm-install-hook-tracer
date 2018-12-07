# Use the debian node image as a base for two reasons:
#   * Installing node.js is harder than installing the other dependencies
#   * Debian has more functionality than alpine
FROM node:10.13.0-jessie

# 1. Install strace
# 2. Create the working directory
RUN apt-get update && apt-get install -y \
    strace \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir /tracer

# Build the application
WORKDIR /tracer
COPY tracer/package.json /tracer/
COPY tracer/yarn.lock /tracer/
RUN yarn && npm install -g npm-bundle
# Separate the dependency install from the build to improve layer cache hits
COPY tracer/ /tracer/
# 1. Compile the application
# 2. Link the app into the path
# 3. Setup a clean working directory
RUN yarn build \
 && ln -s /tracer/build/index.js /usr/bin/npm-tracer \
 && mkdir /workspace
WORKDIR /workspace

ENTRYPOINT ["/usr/bin/npm-tracer"]

