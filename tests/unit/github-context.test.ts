describe('PR events', () => {
  let ghContext: any

  beforeAll(() => {
    jest.resetModules()
    jest.mock('@actions/github', () => {
      return {
        context: {
          eventName: 'pull_request'
        }
      }
    })
  })

  test('isPullRequest() returns true', () => {
    ghContext = require('../../src/github-context')
    expect(ghContext.isPullRequest()).toBeTruthy()
  })
})

describe('Non-PR events', () => {
  let ghContext: any

  beforeAll(() => {
    jest.resetModules()
    jest.mock('@actions/github', () => {
      return {
        context: {
          eventName: 'fake_event_type'
        }
      }
    })
  })

  test('isPullRequest() returns false', () => {
    ghContext = require('../../src/github-context')
    expect(ghContext.isPullRequest()).toBeFalsy()
  })
})