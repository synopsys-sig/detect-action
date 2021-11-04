import {getInput} from '@actions/core'
import fs from 'fs'
import path from 'path'
import {uploadJson} from './upload-json'
import {downloadAndRunDetect} from './detect-manager'
import {commentOnPR} from './comment'

export function run() {
  const githubToken = getInput('github-token')
  const blackduckUrl = getInput('blackduck-url')
  const blackduckApiToken = getInput('blackduck-api-token')
  const outputPath = getInput('output-path')

  const detectArgs = `--blackduck.trust.cert=TRUE --blackduck.url="${blackduckUrl}" --blackduck.api.token="${blackduckApiToken}" --detect.blackduck.scan.mode=RAPID --detect.scan.output.path="${outputPath}"`

  downloadAndRunDetect(detectArgs)

  const scanJsonPaths = fs.readdirSync(outputPath).map(jsonPath => path.join(outputPath, jsonPath))

  uploadJson(outputPath, scanJsonPaths)

  scanJsonPaths.forEach(jsonPath => {
    commentOnPR(githubToken, jsonPath)
  })
}

run()
