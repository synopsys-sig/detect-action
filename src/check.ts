import {debug, info, warning} from '@actions/core'
import {context, getOctokit} from '@actions/github'
import {getSha} from './github-context'
import {GITHUB_TOKEN} from './inputs'

export const CHECK_NAME = 'Black Duck Policy Check'

export async function createBlackDuckPolicyCheck(): Promise<number> {
  const octokit = getOctokit(GITHUB_TOKEN)

  const head_sha = getSha()

  const response = await octokit.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name: CHECK_NAME,
    head_sha
  })

  if (response.status !== 201) {
    warning(`Unexpected status code recieved when creating check: ${response.status}`)
    debug(JSON.stringify(response, null, 2))
  } else {
    info(`Black Duck Policy Check created`)
  }

  return response.data.id
}

export async function passBlackDuckPolicyCheck(checkRunId: number, text: string) {
  return finishBlackDuckPolicyCheck(checkRunId, 'success', 'No components found that violate your Black Duck policies!', text)
}

export async function failBlackDuckPolicyCheck(checkRunId: number, text: string) {
  return finishBlackDuckPolicyCheck(checkRunId, 'failure', 'Components found that violate your Black Duck Policies!', text)
}

export async function skipBlackDuckPolicyCheck(checkRunId: number) {
  return finishBlackDuckPolicyCheck(checkRunId, 'skipped', 'Black Duck Policy Check was skipped', '')
}

export async function cancelBlackDuckPolicyCheck(checkRunId: number) {
  return finishBlackDuckPolicyCheck(checkRunId, 'cancelled', 'Black Duck Policy Check could not be completed', 'Something went wrong and the Black Duck Policy Check could not be completed. Check your action logs for more details.')
}

export async function finishBlackDuckPolicyCheck(checkRunId: number, conclusion: string, summary: string, text: string) {
  const octokit = getOctokit(GITHUB_TOKEN)

  const response = await octokit.rest.checks.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    check_run_id: checkRunId,
    status: 'completed',
    conclusion,
    output: {
      title: CHECK_NAME,
      summary,
      text
    }
  })

  if (response.status !== 200) {
    warning(`Unexpected status code recieved when creating check: ${response.status}`)
    debug(JSON.stringify(response, null, 2))
  } else {
    info(`Black Duck Policy Check created`)
  }
}
