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
RUN yarn
# Separate the dependency install from the build to improve layer cache hits
COPY tracer/ /tracer/
# 1. Compile the application
# 2/3. Link the app into the path
# 4. Setup a clean working directory
# 5. Disable npm progress output
RUN yarn build \
 && ln -s /tracer/build/cli-trace.js /usr/bin/npm-hook-trace \
 && ln -s /tracer/build/cli-check.js /usr/bin/npm-hook-check \
 && mkdir /workspace \
 && npm set progress=false
WORKDIR /workspace

ENTRYPOINT ["/usr/bin/npm-hook-trace"]

