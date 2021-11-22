import {debug, info, warning} from '@actions/core'
import {context, getOctokit} from '@actions/github'
import {getSha} from './github-context'

export const CHECK_NAME = 'Black Duck Policy Check'

export async function createBlackDuckPolicyCheck(githubToken: string): Promise<number> {
  const octokit = getOctokit(githubToken)

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

export async function passBlackDuckPolicyCheck(githubToken: string, checkRunId: number, text: string) {
  return finishBlackDuckPolicyCheck(githubToken, checkRunId, 'success', 'No components found that violate your Black Duck policies!', text)
}

export async function failBlackDuckPolicyCheck(githubToken: string, checkRunId: number, text: string) {
  return finishBlackDuckPolicyCheck(githubToken, checkRunId, 'failure', 'Components found that violate your Black Duck Policies!', text)
}

export async function skipBlackDuckPolicyCheck(githubToken: string, checkRunId: number) {
  return finishBlackDuckPolicyCheck(githubToken, checkRunId, 'skipped', 'Policy check was skipped', '')
}

export async function finishBlackDuckPolicyCheck(githubToken: string, checkRunId: number, conclusion: string, summary: string, text: string) {
  const octokit = getOctokit(githubToken)

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
