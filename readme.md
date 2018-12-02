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
mkdir traces // If you haven't already made a traces dir.  
docker pull awendland/npm-install-hook-tracer:latest
docker run -v "$PWD/traces:/workspace/traces" --cap-add SYS_PTRACE awendland/npm-install-hook-tracer PACKGE_NAME
```

## TODO

* Resolve package dependencies before running `install`, `postinstall`, and
  `preuninstall` scripts (since they may depend on a dependency specified in
  `package.json` to run, such as `node-pre-gyp` for `bcrypt`).

