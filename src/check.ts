import {debug, info, warning} from '@actions/core'
import {context, getOctokit} from '@actions/github'
import {getSha} from './github-context'

export async function createBlackDuckPolicyCheck(githubToken: string, checkPassed: boolean, text: string) {
  const octokit = getOctokit(githubToken)

  const name = 'Black Duck Policy Check'
  const summary = checkPassed ? 'No components found that violate your Black Duck policies!' : 'Components found that violate your Black Duck Policies!'
  const conclusion = checkPassed ? 'success' : 'failure'
  const head_sha = getSha()

  const response = await octokit.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name,
    head_sha,
    status: 'completed',
    conclusion,
    output: {
      title: name,
      summary,
      text
    }
  })

  if (response.status !== 201) {
    warning(`Unexpected status code recieved when creating check: ${response.status}`)
    debug(JSON.stringify(response, null, 2))
  } else {
    info(`Black Duck Policy Check created`)
  }
}
