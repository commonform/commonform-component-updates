const compareVersions = require('legal-versioning-compare')
const concat = require('simple-concat')
const https = require('https')
const isObject = require('is-object')
const isUpgrade = require('legal-versioning-upgrade')
const once = require('once')
const parse = require('json-parse-errback')
const predicate = require('commonform-predicate')
const runParallelLimit = require('run-parallel-limit')

module.exports = (form, { cache, parallel = 1 }, callback) => {
  runParallelLimit(
    findComponents(form).map(found => done => {
      const {
        path,
        reference: { component: url, version: currentVersion }
      } = found
      if (cache && cache.get) {
        cache.get(url, (error, versions) => {
          if (error || !versions) downloadAndCache()
          withVersions(null, versions)
        })
      } else downloadAndCache()

      function downloadAndCache () {
        downloadVersions(url, (error, versions) => {
          if (error) return withVersions(error)
          if (!versions) return withVersions(null, false)
          if (cache && cache.put) cache.put(url, versions, () => finish())
          else finish()

          function finish (error) {
            withVersions(error, versions)
          }
        })
      }

      function withVersions (error, versions) {
        if (error) return callback(error)
        if (!versions) return callback(new Error(`No versions for ${url}`))
        // The versions array may contain invalid versions.
        try {
          versions.sort(compareVersions).reverse()
        } catch (error) {
          return callback(error)
        }
        const latest = versions.find(candidate => isUpgrade(currentVersion, candidate))
        return done(null, {
          path,
          reference: found.reference,
          version: currentVersion,
          available: versions.reverse(),
          latest
        })
      }
    }),
    parallel,
    callback
  )
}

function findComponents (form) {
  const found = []
  recurse([], form)
  return found

  function recurse (path, form) {
    for (const [index, element] of form.content.entries()) {
      if (predicate.child(element)) {
        recurse(path.concat('content', index, 'form'), element.form)
      } else if (predicate.component(element)) {
        found.push({
          reference: element,
          path: path.concat('content', index)
        })
      }
    }
  }
}

function downloadVersions (component, callback) {
  callback = once(callback)
  const url = component + '.json'
  https.request(url)
    .once('error', callback)
    .once('timeout', callback)
    .once('response', function (response) {
      const statusCode = response.statusCode
      if (statusCode === 404) return callback(null, false)
      if (statusCode !== 200) {
        const statusError = new Error(`${url} responded ${statusCode}`)
        statusError.statusCode = statusCode
        return callback(statusError)
      }
      concat(response, function (error, buffer) {
        if (error) return callback(error)
        parse(buffer, function (error, parsed) {
          if (error) return callback(error)
          if (!isObject(parsed)) return callback(null, false)
          const { versions } = parsed
          if (!Array.isArray(versions)) return callback(null, false)
          callback(null, versions)
        })
      })
    })
    .end()
}
