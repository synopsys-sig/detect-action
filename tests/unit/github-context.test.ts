import { isPullRequest } from '../../src/github-context'

beforeAll(() => {
  //jest.resetModules()
  //doMockGitHubActionModule('pull_request')
})

jest.mock('@actions/github', () => {
  return {
    context: {
      eventName: 'pull_request'
    }
  }
})

//const mockActionsGitHubModule = jest.mock('@actions/github')

// const doMockGitHubActionModule = (eventNameValue: string) => { 
//   jest.mock('@actions/github', () => {
//     return {
//       context: {
//         eventName: eventNameValue
//       }
//     }
//   })
// }

test('isPullRequest() returns true', () => {
  expect(isPullRequest()).toBeTruthy()
})

// describe('False PR cases', () => {
//   jest.mock('@actions/github', () => {
//     return {
//       context: {
//         eventName: 'non_a_pr_event'
//       }
//     }
//   })

//   test('isPullRequest() returns false', () => {
//     expect(isPullRequest()).toBeFalsy()
//   })
// })