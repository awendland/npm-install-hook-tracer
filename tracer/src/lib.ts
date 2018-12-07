import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import shell, {ShellString} from 'shelljs'
import tar from 'tar'
import { objectify } from './utils'
import { performance } from 'perf_hooks'

const asyncExecFile = promisify(execFile)
const asyncReadFile = promisify(fs.readFile)
const asyncWriteFile = promisify(fs.writeFile)

export const loadJsonFile = async (filePath: string): Promise<any> => {
  return JSON.parse(await asyncReadFile(filePath, {encoding: 'utf-8'}) as string)
}

/**
 * Pulls the specified package from npm and extracts it into the working
 * directory.
 */
export const pullPackage = async (packageName: string): Promise<{packageFile: string, extractedFolder: string}> => {
  const {stdout: packStdout} = await asyncExecFile('npm', ['pack', packageName])
  const packageFile = packStdout.trim()
  const precontents = new Set(shell.ls())
  await tar.extract({file: packageFile})
  const postcontents = shell.ls()
  const potentialFolderPaths = postcontents.filter(x => !precontents.has(x))
  if (potentialFolderPaths.length > 1)
    throw new Error(`Multiple bundle outputs detected: ${potentialFolderPaths}`)
  return {packageFile, extractedFolder: './' + potentialFolderPaths[0]}
}

/**
 * Rewrite the specified package.json to have no install hooks.
 */
export const removeInstallHooks = async (packageJsonPath: string): Promise<void> => {
  const packageJson = await loadJsonFile(packageJsonPath)
  for (const hook of INSTALL_HOOKS) {
    delete (packageJson.scripts || {})[hook]
  }
  await asyncWriteFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
}

// Regex to retrieve the number of installed packages from `npm install` stdout
const RE_NUM_PACKAGES = /added (\d+) package/

/**
 * Resolve dependencies requested by a packge.json file in a given directory. Effectively,
 * this just runs `npm install` in that directory.
 *
 * NOTE: this will run the install scripts of the package's dependencies as well as those
 * of the main package.json! Make sure to run removeInstallHooks first to stop the
 * main package.json's scripts, or run this command with `--ignore-scripts`.
 */
export const resolveDependencies = async (packageDir: string): Promise<{numPackages: number}> => {
  // Some packages (bcrypt) include node_modules/ which is causing npm not to
  // create the normal .bin links for things like node-pre-gyp. Deleting the node_modules
  // folder first seems to solve this issue.
  shell.rm('-rf', path.resolve(packageDir, 'node_modules'))

  const {stdout} = await asyncExecFile('npm', [
    'install',
    '--no-audit', // Disable running audit checking for the install (uncertain speedup)
    '--no-package-lock', // Don't create a package-lock.json file (uncertain speedup)
    '--only=prod', // Only install prod dependencies (variable ~25% speedup)
    '--legacy-bundling', // Don't deduplicate packages (variable ~10% speedup)
  ], {
    cwd: packageDir,
    maxBuffer: 10 * 1024 * 1024,
  })
  return {
    numPackages: Number((RE_NUM_PACKAGES.exec(stdout) || [])[1]),
  }
}

/**
 * Hooks that a package can register to for auto execution
 */
export type InstallHook = 'preinstall' | 'install' | 'postinstall' | 'preuninstall' | 'uninstall' | 'postuninstall'
export const INSTALL_HOOKS: Array<InstallHook> = [
  'preinstall', 'install', 'postinstall',
  'preuninstall', 'uninstall', 'postuninstall',
]

/**
 * Hooks with registered scripts
 */
export type RegisteredHooks = {
  [k in InstallHook]: string
}

/**
 * List the hooks that a package has registered for, along with the
 * registered actions.
 */
export const listRegisteredHooks = (packageJson: {scripts: object}): RegisteredHooks => {
  return Object.entries(packageJson.scripts || {})
    .filter(([k, v]: [string, string]) => INSTALL_HOOKS.includes(k as any))
    .reduce(objectify, {} as RegisteredHooks)
}

/**
 * Run the provided script with strace attached
 */
export const straceScript = async (
  traceFilePrefix: string,
  scriptCmd: string,
  packageDir: string,
): Promise<{traceFiles: fs.Stats[], stdout: string, stderr: string, runtime: number}> => {
  const start = performance.now()
  const {stdout, stderr} = await asyncExecFile('strace', [
    '-o', traceFilePrefix,
    '-e', 'trace=file,network', // Trace all file and network activity
    '-s8192', // Show 8k output of each trace record
    '-ff', // Follow child processes
    '-ttt', // Print microsecond timestamps with each command
    'sh', '-c', scriptCmd
  ], {
    maxBuffer: 50 * 1024 * 1024, // Max amount of bytes allowed on stdout and stderr
    cwd: packageDir,
    env: Object.assign({}, process.env, {
      // Ensure that it has access to the subdependency files in .bin
      PATH: `${path.resolve(packageDir, 'node_modules', '.bin')}:${process.env.PATH}`,
    }),
  })
  const traceFiles = shell.ls('-l', `${traceFilePrefix}*`) as any as fs.Stats[]
  return {traceFiles, stdout, stderr, runtime: performance.now() - start}
}
