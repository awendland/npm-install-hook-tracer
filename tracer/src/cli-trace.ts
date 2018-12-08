#!/usr/bin/env node
import shell from 'shelljs'
import { execFileSync } from 'child_process'
import { statSync } from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import * as lib from './lib'

shell.config.silent = true

const argv = require('minimist')(process.argv.slice(2))

if (argv.help || argv.h) {
  console.log(`Usage: ${process.argv[1]} <package_name>`)
  console.log(`package_name           this can be bare like "express" or specify a version "express@4.14.0"`)
  console.log(`--registry/-r=npmjs    change the registry used by npm`)
  console.log(`--traceDir/-o=traces/  change the dir where strace output is written to`)
}
const packageName = argv._[0]
if (!packageName) {
  console.error(`Usage: ${process.argv[1]} <package_name>`)
  process.exit(1)
}

if (argv.registry || argv.r) {
  execFileSync('npm', ['set', 'registry', argv.registry || argv.r])
}

const msToSec2 = (ms: number) => (ms / 1000).toFixed(2)

;(async () => {

  process.stderr.write(`Retrieving tarball for "${packageName}" `)
  const retrievingStart = performance.now()
  const {packageFile, extractedFolder} = await lib.pullPackage(packageName)
  process.stderr.write(`time[${msToSec2(performance.now() - retrievingStart)}s] `)
  process.stderr.write(`size[${(statSync(packageFile).size / 1024).toFixed(2)} KiB]\n`)

  argv.traceDir = argv.traceDir || argv.o || `traces/${packageFile.replace('.tgz', '')}`
  console.error(`Analyzing "${packageFile}"`)
  const packageJsonPath = path.resolve(extractedFolder, 'package.json')
  const packageJson = require(packageJsonPath)
  const registeredHooks = lib.listRegisteredHooks(packageJson)

  if (Object.keys(registeredHooks).length > 0) {
    console.error(`Found install hooks:${Object.entries(registeredHooks)
                                          .map(([k, v]) => `\n- ${k}: ${v}`)
                                          .join('')}`)

    // To keep from running the package's install hooks prematurely
    await lib.removeInstallHooks(packageJsonPath)

    process.stderr.write(`Resolving dependencies for "${packageName}" `)
    const dependenciesStart = performance.now()
    const {numPackages: numDependencies} = await lib.resolveDependencies(extractedFolder)
    process.stderr.write(`time[${msToSec2(performance.now() - dependenciesStart)}s] `)
    process.stderr.write(`packages[${numDependencies}]\n`)

    console.error(`Tracing ${Object.entries(registeredHooks).length} hook(s)`)
    shell.mkdir('-p', argv.traceDir)
    for (const [hook, script] of Object.entries(registeredHooks)) {
      process.stderr.write(`- ${hook} = `)
      const {traceFiles, stdout, stderr, runtime} =
        await lib.straceScript(path.resolve(argv.traceDir, `${hook}`), script, extractedFolder)
      const traceSize = traceFiles.reduce((sum, stat) => sum + stat.size, 0)
      process.stderr.write(`traces[${traceFiles.length}] size[${(traceSize / 1024).toFixed(2)} KiB] time[${msToSec2(runtime)}s]\n`)
    }
  }
  else {
    console.error(`No install hooks for "${packageName}"`)
  }
})().catch(e => {
  console.error(e)
  process.exit(1)
})

