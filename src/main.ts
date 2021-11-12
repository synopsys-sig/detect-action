import {getInput} from '@actions/core'
import * as glob from '@actions/glob'
import fs from 'fs'
import {uploadRapidScanJson, uploadDiagnosticZip} from './upload-artifacts'
import {downloadAndRunDetect} from './detect-manager'
import {commentOnPR} from './comment'

export async function run() {
  const githubToken = getInput('github-token')
  const blackduckUrl = getInput('blackduck-url')
  const blackduckApiToken = getInput('blackduck-api-token')
  const outputPath = getInput('output-path')

  const detectArgs = `--blackduck.trust.cert=TRUE --blackduck.url="${blackduckUrl}" --blackduck.api.token="${blackduckApiToken}" --detect.blackduck.scan.mode=RAPID --detect.output.path="${outputPath}" --detect.scan.output.path="${outputPath}"`

  downloadAndRunDetect(detectArgs)

  const jsonGlobber = await glob.create(`${outputPath}/*.json`)
  const scanJsonPaths = await jsonGlobber.glob()
  uploadRapidScanJson(outputPath, scanJsonPaths)

  const diagnosticMode = process.env.DETECT_DIAGNOSTIC?.toLowerCase() === 'true'
  const extendedDiagnosticMode = process.env.DETECT_DIAGNOSTIC_EXTENDED?.toLowerCase() === 'true'
  if (diagnosticMode || extendedDiagnosticMode) {
    const diagnosticGlobber = await glob.create(`${outputPath}/runs/*.zip`)
    const diagnosticZip = await diagnosticGlobber.glob()
    uploadDiagnosticZip(outputPath, diagnosticZip)
  }

  scanJsonPaths.forEach(jsonPath => {
    const rawdata = fs.readFileSync(jsonPath)
    const scanJson = JSON.parse(rawdata.toString())

    commentOnPR(githubToken, scanJson)
  })
}

run()
