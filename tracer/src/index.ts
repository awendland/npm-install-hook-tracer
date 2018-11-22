import shell from 'shelljs'
import path from 'path'
import * as lib from './lib'

const argv = require('minimist')(process.argv.slice(2))

const packageName = argv._[0]
if (!packageName) {
  console.error(`Usage: analyzer <package_name>`)
  process.exit(1)
}

(async () => {
  const {packageFile, extractedFolder} = await lib.pullPackage(packageName)
  console.error(`Analyzing ${packageFile}`)
  const packageJson = require(path.resolve(extractedFolder, 'package.json'))
  const registeredHooks = lib.listRegisteredHooks(packageJson)
  console.error(`Found install hooks:\n${
    Object.entries(registeredHooks)
      .map(([k, v]) => `- ${k}: ${v}`)
  }`)
  const {strace, stdout, stderr, runtime} = await lib.straceScript(Object.values(registeredHooks)[0], extractedFolder)
  console.error(`Runtime: ${runtime}`)
  console.log(strace.toString())
})().catch(e => {
  console.error(e)
  process.exit(1)
})

