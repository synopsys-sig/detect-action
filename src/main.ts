import { getInput, info, setFailed } from '@actions/core'
import { create } from '@actions/glob'
import path from 'path'
import fs from 'fs'
import { uploadRapidScanJson, uploadDiagnosticZip } from './upload-artifacts'
import { TOOL_NAME, findOrDownloadDetect, runDetect } from './detect-manager'
import { commentOnPR } from './comment'
import { BlackduckPolicyChecker } from './policy-checker'

export async function run(): Promise<void> {
  const githubToken = getInput('github-token')
  const blackduckUrl = getInput('blackduck-url')
  const blackduckApiToken = getInput('blackduck-api-token')
  const detectVersion = getInput('detect-version')
  const scanMode = getInput('scan-mode').toUpperCase()
  const outputPathOverride = getInput('output-path-override')

  const runnerTemp = process.env.RUNNER_TEMP
  let outputPath = ''
  if (outputPathOverride !== '') {
    outputPath = outputPathOverride
  } else if (runnerTemp === undefined) {
    setFailed('$RUNNER_TEMP is not defined and output-path-override was not set. Cannot determine where to store output files.')
    return
  } else {
    outputPath = path.resolve(runnerTemp, 'blackduck')
  }

  const blackduckPolicyChecker = new BlackduckPolicyChecker(blackduckUrl, blackduckApiToken)
  const policiesExist: boolean = await blackduckPolicyChecker.checkIfEnabledBlackduckPoliciesExist()
  if (!policiesExist && scanMode === 'RAPID') {
    setFailed(`Could not run ${TOOL_NAME} using ${scanMode} scan mode. No enabled policies found on the specified Black Duck server.`)
    return
  }

  const detectArgs = ['--blackduck.trust.cert=TRUE', `--blackduck.url=${blackduckUrl}`, `--blackduck.api.token=${blackduckApiToken}`, `--detect.blackduck.scan.mode=${scanMode}`, `--detect.output.path=${outputPath}`, `--detect.scan.output.path=${outputPath}`]

  const detectPath = await findOrDownloadDetect(detectVersion).catch(reason => {
    setFailed(`Could not download ${TOOL_NAME} ${detectVersion}: ${reason}`)
  })

  if (!detectPath) {
    return
  }

  const detectExitCode = await runDetect(detectPath, detectArgs).catch(reason => {
    setFailed(`Could not execute ${TOOL_NAME} ${detectVersion}: ${reason}`)
  })

  if (!detectExitCode) {
    return
  }

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

  if (detectExitCode > 0) {
    if (detectExitCode === 3) {
      setFailed('Found dependencies violating policy!')
    } else {
      setFailed('Dependency check failed! See Detect output for more information.')
    }
  } else if (detectExitCode === 0) {
    info('None of your dependencies violate your Black Duck policies!')
  }
}

run()
