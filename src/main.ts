import {getInput, info, setFailed} from '@actions/core'
import {getOctokit, context} from '@actions/github'
import {create} from '@actions/glob'
import path from 'path'
import fs from 'fs'
import {uploadRapidScanJson, uploadDiagnosticZip} from './upload-artifacts'
import {TOOL_NAME, findOrDownloadDetect, runDetect} from './detect-manager'
import {commentOnPR} from './comment'
import {PullRequest} from './namespaces/Github'

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

  const prEvents = ['pull_request', 'pull_request_review', 'pull_request_review_comment']

  let sha = context.sha
  if (prEvents.includes(context.eventName)) {
    const pull = context.payload.pull_request as PullRequest
    if (pull?.head.sha) {
      sha = pull?.head.sha
    }
  }

  const octokit = getOctokit(githubToken)
  const something = await octokit.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name: 'Black Duck Policy Check',
    head_sha: sha,
    status: 'completed',
    conclusion: 'failure',
    output: {
      title: 'Black Duck Policy Check',
      summary: 'Found dependencies violating policy!'
    }
  })
  info(JSON.stringify(something))

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
