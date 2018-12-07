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
  console.log(`Usage: ${process.argv[1]} <package_names>`)
  console.log(`package_name           list of packages to check for install hooks`)
  console.log(`--registry/-r=npmjs    change the registry used by npm`)
  console.log(`--quiet/-q             turn off all info logging to stderr`)
  console.log(`--details              list which hooks each package has`)
  console.log(`
A newline separated list of packages that DO have install hooks will be printed
to stdout.`)
}
const packageNames = argv._
if (!packageNames) {
  console.error(`Usage: ${process.argv[1]} <package_names>`)
  process.exit(1)
}

if (argv.registry || argv.r) {
  execFileSync('npm', ['set', 'registry', argv.registry || argv.r])
}

const q = argv.quiet || argv.q

const msToSec2 = (ms: number) => (ms / 1000).toFixed(2)

;(async () => {

  for (const packageName of packageNames) {
    const precontents = new Set(shell.ls())

    if (!q) process.stderr.write(`Retrieving tarball for "${packageName}" `)
    const retrievingStart = performance.now()
    try { // Don't die on errors so that batch processing can continue
      const {packageFile, extractedFolder} = await lib.pullPackage(packageName)
      if (!q) process.stderr.write(`time[${msToSec2(performance.now() - retrievingStart)}s] `)
      if (!q) process.stderr.write(`size[${(statSync(packageFile).size / 1024).toFixed(2)} KiB]\n`)

      if (!q) console.error(`Analyzing "${packageFile}"`)
      const packageJsonPath = path.resolve(extractedFolder, 'package.json')
      const packageJson = await lib.loadJsonFile(packageJsonPath)
      const registeredHooks = lib.listRegisteredHooks(packageJson)

      const hooks = Object.keys(registeredHooks)
      if (hooks.length > 0)
        process.stdout.write(`${packageName}\t${hooks}\n`)
    } catch (e) {
      console.error(e)
    }

    shell.rm('-rf', shell.ls().filter(x => !precontents.has(x)))
  }

})().catch(e => {
  console.error(e)
  process.exit(1)
})

