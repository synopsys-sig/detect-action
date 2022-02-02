describe('Test reporting table', () => {
  beforeAll(() => {
    jest.resetModules()
    jest.mock('@actions/core', () => ({
      getBooleanInput: jest.fn(_ => true),
      getInput: jest.fn(_ => 'sample')
    }))
  })

  test('If no results have policy violations, createTable returns empty table', () => {
    const reporting = require('../../src/detect/reporting.ts')
    const fullResultsExample = require('../resources/fullResultsWithoutPolicyViolations.json')

    return reporting.createTable(null, null, fullResultsExample).then((tableString: string) => {
      expect(tableString).toBe(reporting.TABLE_HEADER)
    })
  })
})
