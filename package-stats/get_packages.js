const names = require('all-the-package-names')
const fs = require('fs')
const axios = require('axios')
const wu = require('wu')

const delay = (ms) => new Promise(r => setTimeout(r, ms))

const filename = 'package-stats.tsv'
const start = Date.now()

const offset = (() => {
  let alreadyCollected = ''
  try {
    alreadyCollected = fs.readFileSync(filename, {encoding: 'utf-8'})
  } catch(e) {}
  const lastLine = alreadyCollected.split('\n').slice(-2)[0]
  const lastPackage = lastLine.split('\t')[0]
  return names.indexOf(lastPackage) + 1
})()

console.log(`Starting at entry ${offset}`)

;(async () => {
  let count = 0
  const filteredNames = wu(names).drop(offset).filter(n => n.indexOf('@') === -1).toArray()
  for (const batch of wu.chunk(128, filteredNames)) {
    const data = await axios.get(`https://api.npmjs.org/downloads/point/last-month/${batch.join(',')}`)
    count += batch.length
    const eta = (Date.now() - start) / count * (filteredNames.length - count) / 1000 / 60
    console.error(`${count + offset} of ${filteredNames.length}\tETA: ${eta.toFixed(2)}m`)
    for (var key in data.data) {
      try {
        fs.appendFileSync(filename, `${key}\t${data.data[key].downloads}\n`)
      } catch (e) {
        fs.appendFileSync(filename, `${key}\tfailed\n`)
        console.log(`"${key}" failed`, e)
      }
    }
    await delay(200)
  }
})().catch(e => {
  const url = e.config.url
  delete e.config
  delete e.request
  delete e.response
  console.error(Object.assign(e, {url}))
  process.exit(1)
})
