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
WORKDIR /tracer

# Copy the package.json file over and install dependencies
COPY tracer/package.json /tracer/
COPY tracer/yarn.lock /tracer/
RUN yarn

# Copy over the rest of the scripts
COPY tracer/ /tracer/
RUN yarn tsc

