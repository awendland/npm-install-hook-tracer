import test from 'ava'
import shell from 'shelljs'
import * as lib from './lib'

test.afterEach(async () => {
  shell.rm('*.tgz')
  shell.rm('-rf', 'package/')
})

test.serial('downloads and extracts express', async t => {
  const filesBefore = shell.ls()
  await lib.pullPackage('express@4.16.4')
  const filesNew = shell.ls().filter(f => !filesBefore.includes(f))
  t.deepEqual(filesNew, ['express-4.16.4.tgz', 'package'])
})

test('listRegisteredHooks only include valid hooks', t => {
  t.deepEqual(lib.listRegisteredHooks({
    scripts: {
      badHook: 'hello',
      preinstall: 'something',
      install: 'something',
      postinstall: 'something',
      preuninstall: 'something',
      uninstall: 'something',
    }
  }), {
    preinstall: 'something',
    install: 'something',
    postinstall: 'something',
    preuninstall: 'something',
    uninstall: 'something',
  })
})
