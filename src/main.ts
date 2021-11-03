import {getInput} from '@actions/core'
import {context, getOctokit} from '@actions/github'
import fs from 'fs'
import {execSync} from 'child_process'
import {uploadJson} from './upload-json'

export function run() {
  const githubToken = getInput('github-token')
  const blackduckUrl = getInput('blackduck-url')
  const blackduckApiToken = getInput('blackduck-api-token')
  const outputPath = getInput('output-path')

  const octokit = getOctokit(githubToken)

  const detectArgs = `--blackduck.trust.cert=TRUE --blackduck.url="${blackduckUrl}" --blackduck.api.token="${blackduckApiToken}" --detect.blackduck.scan.mode=RAPID --detect.scan.output.path="${outputPath}"`

  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell "[Net.ServicePointManager]::SecurityProtocol = 'tls12'; irm https://detect.synopsys.com/detect7.ps1?$(Get-Random) | iex; detect ${detectArgs}"`,
        {stdio: 'inherit'}
      )
    } else {
      execSync(
        `bash <(curl -s -L https://detect.synopsys.com/detect7.sh) detect ${detectArgs}`,
        {stdio: 'inherit', shell: '/bin/bash'}
      )
    }
  } catch (error) {
    // ignored
  }

  const scanJsonPaths = fs.readdirSync(outputPath)

  uploadJson(outputPath, scanJsonPaths)

  scanJsonPaths.forEach(jsonPath => {
    const rawdata = fs.readFileSync(jsonPath)
    const scanJson = JSON.parse(rawdata.toString())

    octokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: JSON.stringify(scanJson, undefined, 2)
    })
  })
}

run()
