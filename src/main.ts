import {error, getInput} from '@actions/core'
import {create} from '@actions/glob'
import path from 'path'
import fs from 'fs'
import {uploadRapidScanJson, uploadDiagnosticZip} from './upload-artifacts'
import {downloadAndRunDetect} from './detect-manager'
import {commentOnPR} from './comment'
import {exit} from 'process'

export async function run(): Promise<void> {
  const githubToken = getInput('github-token')
  const blackduckUrl = getInput('blackduck-url')
  const blackduckApiToken = getInput('blackduck-api-token')
  const scanMode = getInput('scan-mode').toUpperCase()
  const outputPathOverride = getInput('output-path-override')

  const runnerTemp = process.env.RUNNER_TEMP
  let outputPath = ''
  if (outputPathOverride !== '') {
    outputPath = outputPathOverride
  } else if (runnerTemp === undefined) {
    error('$RUNNER_TEMP is not defined and output-path-override was not set. Cannot determine where to store output files.')
    exit
  } else {
    outputPath = path.resolve(runnerTemp, 'blackduck')
  }

  const detectArgs = `--blackduck.trust.cert=TRUE --blackduck.url="${blackduckUrl}" --blackduck.api.token="${blackduckApiToken}" --detect.blackduck.scan.mode="${scanMode}" --detect.output.path="${outputPath}" --detect.scan.output.path="${outputPath}"`

  downloadAndRunDetect(detectArgs)

  if (scanMode === 'RAPID') {
    const jsonGlobber = await create(`${outputPath}/*.json`)
    const scanJsonPaths = await jsonGlobber.glob()
    uploadRapidScanJson(outputPath, scanJsonPaths)

    scanJsonPaths.forEach(jsonPath => {
      const rawdata = fs.readFileSync(jsonPath)
      const scanJson = JSON.parse(rawdata.toString())

      commentOnPR(githubToken, scanJson)
    })
  }

  const diagnosticMode = process.env.DETECT_DIAGNOSTIC?.toLowerCase() === 'true'
  const extendedDiagnosticMode = process.env.DETECT_DIAGNOSTIC_EXTENDED?.toLowerCase() === 'true'
  if (diagnosticMode || extendedDiagnosticMode) {
    const diagnosticGlobber = await create(`${outputPath}/runs/*.zip`)
    const diagnosticZip = await diagnosticGlobber.glob()
    uploadDiagnosticZip(outputPath, diagnosticZip)
  }
}

run()
