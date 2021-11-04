import {context, getOctokit} from '@actions/github'
import {Violation} from './rapid-scan-result'
import fs from 'fs'

export async function commentOnPR(githubToken: string, jsonPath: string) {
  const octokit = getOctokit(githubToken)

  const rawdata = fs.readFileSync(jsonPath)
  const scanJson: Violation[] = JSON.parse(rawdata.toString())

  const messagePreface = '<!-- Comment automatically managed by Detect Action, do not remove this line -->'

  let message = messagePreface
  if (scanJson.length == 0) {
    message.concat('# :white_check_mark: None of your dependencies violate policy!')
  } else {
    message.concat('# :warning: Found dependencies violating policy!\r\n')

    const policyViolations = scanJson
      .map(violation => {
        return `- [ ] **${violation.componentName} ${violation.versionName}** violates ${violation.violatingPolicyNames.map(policyName => `**${policyName}**`).join(', ')}\r\n_${violation.componentIdentifier}_\r\n`
      })
      .join('')

    message = message.concat(policyViolations)
  }
  message = message.concat()

  const contextIssue = context.issue.number
  const contextOwner = context.repo.owner
  const contextRepo = context.repo.repo

  const {data: existingComments} = await octokit.rest.issues.listComments({
    issue_number: contextIssue,
    owner: contextOwner,
    repo: contextRepo
  })

  for (const comment of existingComments) {
    const firstLine = comment.body?.split('\r\n')[0]
    if (firstLine === messagePreface) {
      octokit.rest.issues.deleteComment({
        comment_id: comment.id,
        owner: context.repo.owner,
        repo: contextRepo
      })
    }
  }

  octokit.rest.issues.createComment({
    issue_number: contextIssue,
    owner: contextOwner,
    repo: contextRepo,
    body: message
  })
}
