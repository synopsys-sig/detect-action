import {execSync} from 'child_process'
import {find, downloadTool, cacheFile} from '@actions/tool-cache'
import {exec} from '@actions/exec'

const DETECT_BINARY_REPO_URL = 'https://sig-repo.synopsys.com'
const TOOL_NAME = 'detect'

export async function findOrDownloadDetect(detectVersion: string): Promise<string | Error> {
  const cachedDetect = find(TOOL_NAME, detectVersion)
  if (cachedDetect) {
    return cachedDetect
  }

  const detectDownloadUrl = createDetectDownloadUrl(detectVersion)

  return downloadTool(detectDownloadUrl)
    .then(detectDownloadPath => cacheFile(detectDownloadPath, `synopsys-detect-${detectVersion}.jar`, TOOL_NAME, detectVersion)) //TODO: Jarsigner?
    .catch(reason => new Error(`Could not execute ${TOOL_NAME} ${detectVersion}: ${reason}`))
}

export async function runDetect(detectVersion: string, detectArguments: string): Promise<number | Error> {
  return findOrDownloadDetect(detectVersion)
    .then(detectPath => exec(`java -jar ${detectPath} ${detectArguments}`))
    .catch(reason => new Error(`Could not execute ${TOOL_NAME} ${detectVersion}: ${reason}`))
}

function createDetectDownloadUrl(version: string, repoUrl = DETECT_BINARY_REPO_URL): string {
  return `${repoUrl}/bds-integrations-release/com/synopsys/integration/synopsys-detect/${version}/synopsys-detect-${version}.jar`
}

export function downloadAndRunDetect(detectArgs: string): void {
  try {
    if (process.platform === 'win32') {
      execSync(`powershell "[Net.ServicePointManager]::SecurityProtocol = 'tls12'; irm https://detect.synopsys.com/detect7.ps1?$(Get-Random) | iex; detect ${detectArgs}"`, {stdio: 'inherit'})
    } else {
      execSync(`bash <(curl -s -L https://detect.synopsys.com/detect7.sh) detect ${detectArgs}`, {stdio: 'inherit', shell: '/bin/bash'})
    }
  } catch (error) {
    // ignored
  }
}
