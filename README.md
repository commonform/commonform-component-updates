```javascript
const updates = require('@commonform/component-updates')
const assert = require('assert')

const component = 'https://example.com/component'

const versions = ['1.0.0', '2.0.0', '3.0.0']

const reference = {
  component,
  version: versions[0],
  substitutions: { terms: {}, headings: {}, blanks: {}}
}

updates(
  { content: [reference] },
  {
    cache: {
      get: (url, callback) => {
        if (url === component) callback(null, versions)
        else callback(null, false)
      }
    }
  },
  (error, results) => {
    assert.ifError(error)
    assert.deepStrictEqual(results, [
      {
        path: ['content', 0],
        reference,
        version: '1.0.0',
        available: versions,
        latest: '3.0.0'
      }
    ])
  }
)
```
