import { execFile } from 'child_process'
import path from 'path'
import { performance } from 'perf_hooks'
import { promisify } from 'util'
import shell, {ShellString} from 'shelljs'
import tar from 'tar'
import { objectify } from './utils'

const asyncExecFile = promisify(execFile)

/**
 * Pulls the specified package from npm and extracts it into the working
 * directory.
 */
export const pullPackage = async (packageName: string): Promise<{packageFile: string, extractedFolder: string}> => {
  const {stdout: packStdout} = await asyncExecFile('npm', ['pack', packageName])
  const packageFile = packStdout.trim()
  await tar.extract({file: packageFile})
  return {packageFile, extractedFolder: './package/'}
}

/**
 * Hooks that a package can register to for auto execution
 */
export type InstallHook = 'preinstall' | 'install' | 'postinstall' | 'preuninstall' | 'uninstall' | 'postuninstall'
export const INSTALL_HOOKS: Array<InstallHook> = [
  'preinstall', 'install', 'postinstall',
  'preuninstall', 'uninstall', 'postuninstall',
]

export type RegisteredHooks = {
  [k in InstallHook]: string
}

/**
 * List the hooks that a package has registered for, along with the 
 * registered actions.
 */
export const listRegisteredHooks = (packageJson: {scripts: object}): RegisteredHooks => {
  return Object.entries(packageJson.scripts)
    .filter(([k, v]: [string, string]) => INSTALL_HOOKS.includes(k as any))
    .reduce(objectify, {} as RegisteredHooks)
}

/**
 * Run the provided script with strace attached
 */
export const straceScript = async (
  scriptCmd: string,
  packageDir: string
): Promise<{strace: ShellString, stdout: string, stderr: string, runtime: number}> => {
  const start = performance.now()
  const {stdout, stderr} = await asyncExecFile('strace', [
    '-o', path.resolve('./strace-'),
    '-e', 'trace=file,network', // Trace all file and network activity
    '-s8192', // Show 8k output of each trace record
    '-ff', // Follow child processes
    '-ttt', // Print microsecond timestamps with each command
    'sh', '-c', scriptCmd
  ], {
    maxBuffer: 50 * 1024 * 1024, // Max amount of bytes allowed on stdout and stderr
    cwd: packageDir,
  })
  const strace = shell.cat('./strace-*')
  return {strace, stdout, stderr, runtime: performance.now() - start}
}
