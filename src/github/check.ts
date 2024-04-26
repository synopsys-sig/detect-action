import { debug, info, warning } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { getSha } from './github-context'
import { GITHUB_TOKEN } from '../inputs'

export async function createCheck(checkName: string): Promise<GitHubCheck> {
  const octokit = getOctokit(GITHUB_TOKEN)

  const head_sha = getSha()

  info(`Creating ${checkName}...`)
  const response = await octokit.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name: checkName,
    head_sha
  })

  if (response.status !== 201) {
    warning(`Unexpected status code recieved when creating ${checkName}: ${response.status}`)
    debug(JSON.stringify(response, null, 2))
  } else {
    info(`${checkName} created`)
  }

  return new GitHubCheck(checkName, response.data.id)
}

export class GitHubCheck {
  checkName: string
  checkRunId: number

  constructor(checkName: string, checkRunId: number) {
    this.checkName = checkName
    this.checkRunId = checkRunId
  }

  async passCheck(summary: string, text: string) {
    text = await this.truncateIfCharacterLimitExceeds(text)
    return this.finishCheck('success', summary, text)
  }

  async failCheck(summary: string, text: string) {
    text = await this.truncateIfCharacterLimitExceeds(text)
    return this.finishCheck('failure', summary, text)
  }

  async skipCheck() {
    return this.finishCheck('skipped', `${this.checkName} was skipped`, '')
  }

  async cancelCheck() {
    return this.finishCheck('cancelled', `${this.checkName} Check could not be completed`, `Something went wrong and the ${this.checkName} could not be completed. Check your action logs for more details.`)
  }

  private async truncateIfCharacterLimitExceeds(text: string) {
    const maxLength = 65535

    if (text.length > maxLength) {
      warning(`Text size ${text.length} bytes exceeds maximum limit ${maxLength} bytes. Truncating the text within ${maxLength} bytes`)
      return text.slice(0, maxLength)
    }

    return text
  }

  private async finishCheck(conclusion: string, summary: string, text: string) {
    const octokit = getOctokit(GITHUB_TOKEN)

    const response = await octokit.rest.checks.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      check_run_id: this.checkRunId,
      status: 'completed',
      conclusion,
      output: {
        title: this.checkName,
        summary,
        text
      }
    })

    if (response.status !== 200) {
      warning(`Unexpected status code recieved when creating check: ${response.status}`)
      debug(JSON.stringify(response, null, 2))
    } else {
      info(`${this.checkName} updated`)
    }
  }
}
