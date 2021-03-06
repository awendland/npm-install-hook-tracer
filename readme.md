# npm Install Hook Tracer

## Overview

This tool will download a specified npm package, determine which
install/uninstall hooks are registered, and run each of the associated scripts
with `strace` attached to watch for file and network activity. It will output
the recorded `strace` output to `/workspace/traces/${PACKAGE_NAME-VERSION}`.
`strace` files will be named in the format `$HOOK_NAME.$PID`, ie
`postinstall.45` (there may be multiple processes executed by each script).

## Usage

After [setting up Docker](https://www.docker.com/products/docker-desktop) on
one's computer and pulling this git repo, `cd` into this repo the run the
following commands. 

```[bash]
mkdir traces
docker pull awendland/npm-install-hook-tracer:latest
# To run full trace on a package's hooks
docker run -v "$PWD/traces:/workspace/traces" --cap-add SYS_PTRACE awendland/npm-install-hook-tracer PACKGE_NAME
# To batch filter a list of packages to see if they have hooks
docker run --entrypoint=/usr/bin/npm-hook-check awendland/npm-install-hook-tracer PACKGE_NAME_1 PACKAGE_NAME_2
```

## Advanced Usage

### Development

#### Quickly Iterate
```sh
# This will create a local dir to store the strace output
mkdir traces
# This will build an image according to the Dockerfile
docker-compose build
# This will run the docker image we just built (it's called "tracer")
docker-compose run --rm tracer PACKAGE_NAME
```

#### Manual Usage for Debugging
To use the container for manual debugging:

```sh
docker-compose run --rm --entrypoint=/bin/bash tracer
```

### Parallelization

#### Batch Sequential
Easy (slow b/c sequential) batch run:

```sh
cat most-depended-upon.txt | xargs -n1 docker-compose run --rm tracer ^&1 | tee most-depended-upon--traced.out
```

#### Batch Tracer

Look into gnu `parallel`'s `--job-log` and `--resume` functionality when running big jobs.

```sh
cat most-depended-upon.txt | xargs -n1 -P12 -I\{\} sh -c 'docker-compose run --rm tracer {} 2> stderr/{}--$(date -u +"%Y-%m-%dT%H:%M:%SZ").out'
# Or better yet, use gnu parallel
parallel -a 1000-most-dep--w-hooks--names.txt --eta -N1 'sh -c \'docker-compose run --rm tracer {} 2> stderr/{}--$(date -u +"%Y-%m-%dT%H:%M:%SZ").out\''
```

#### Batch Checker

Batch run to check which packages in a list have install hooks:

```sh
parallel -a most-depended-upon.txt --eta -N100 -u -m 'docker-compose run --rm checker -q' > most-depended-upon--with-hooks.txt
```

### Package Stats

The script in `package-stats` can be used to retrieve the number of downloads in the last month for the
entire set of packages in the npm repo. Update `all-the-package-names` to the latest version, and
then run `yarn start` to trigger the stat retrieval. The retrieval is resumable (it simply restarts
after the last package recorded in the `package-stats.tsv` output file). It batches requests to the
npm API at the max size of 128, it drops any packages with `@` or `/` in the name (because they
don't work with batching), and it rate limits with a 200ms delay after each request.

## TODO

* ~~Resolve package dependencies before running `install`, `postinstall`, and
  `preuninstall` scripts (since they may depend on a dependency specified in
  `package.json` to run, such as `node-pre-gyp` for `bcrypt`).~~

