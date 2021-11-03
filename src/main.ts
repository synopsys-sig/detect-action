import {getInput} from '@actions/core'
import {context, getOctokit} from '@actions/github'
import fs from 'fs'
import path from 'path'
import {uploadJson} from './upload-json'
import {downloadAndRunDetect} from './detect-manager'
import {RapidScanResult} from './rapid-scan-result'

export function run() {
  const githubToken = getInput('github-token')
  const blackduckUrl = getInput('blackduck-url')
  const blackduckApiToken = getInput('blackduck-api-token')
  const outputPath = getInput('output-path')

  const octokit = getOctokit(githubToken)

  const detectArgs = `--blackduck.trust.cert=TRUE --blackduck.url="${blackduckUrl}" --blackduck.api.token="${blackduckApiToken}" --detect.blackduck.scan.mode=RAPID --detect.scan.output.path="${outputPath}"`

  downloadAndRunDetect(detectArgs)

  const scanJsonPaths = fs
    .readdirSync(outputPath)
    .map(jsonPath => path.join(outputPath, jsonPath))

  uploadJson(outputPath, scanJsonPaths)

  scanJsonPaths.forEach(jsonPath => {
    const rawdata = fs.readFileSync(jsonPath)
    const scanJson: RapidScanResult = JSON.parse(rawdata.toString())

    let message = '✅ **No policy violations found!**'
    if (scanJson.violations.length != 0) {
      message = '⚠️ **There were policy violations in your build!**\r\n'

      const policyViolations = scanJson.violations
        .map(violation => {
          return `* ${violation.errorMessage}\r\n`
        })
        .join()

      message.concat(policyViolations)
    }

    octokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: message
    })
  })
}

run()
