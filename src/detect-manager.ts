import {find, downloadTool, cacheFile} from '@actions/tool-cache'
import {exec} from '@actions/exec'

const DETECT_BINARY_REPO_URL = 'https://sig-repo.synopsys.com'
export const TOOL_NAME = 'detect'

export async function findOrDownloadDetect(detectVersion: string): Promise<string> {
  const cachedDetect = find(TOOL_NAME, detectVersion)
  if (cachedDetect) {
    return cachedDetect
  }

  const detectDownloadUrl = createDetectDownloadUrl(detectVersion)

  return downloadTool(detectDownloadUrl).then(detectDownloadPath => cacheFile(detectDownloadPath, `synopsys-detect-${detectVersion}.jar`, TOOL_NAME, detectVersion)) //TODO: Jarsigner?
}

export async function runDetect(detectPath: string, detectArguments: string): Promise<number> {
  return exec(`java -jar ${detectPath} ${detectArguments}`)
}

function createDetectDownloadUrl(version: string, repoUrl = DETECT_BINARY_REPO_URL): string {
  return `${repoUrl}/bds-integrations-release/com/synopsys/integration/synopsys-detect/${version}/synopsys-detect-${version}.jar`
}
