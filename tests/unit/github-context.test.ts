describe('PR events', () => {
  let ghContext: any

  beforeAll(() => {
    jest.resetModules()
  })

  it.each(['pull_request', 'pull_request_target', 'pull_request_review', 'pull_request_review_comment'])('isPullRequest() returns true for event %p', eventName => {
    jest.mock('@actions/github', () => {
      return {
        context: {
          eventName: eventName
        }
      }
    })
    ghContext = require('../../src/github/github-context')
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
    ghContext = require('../../src/github/github-context')
    expect(ghContext.isPullRequest()).toBeFalsy()
  })
})
