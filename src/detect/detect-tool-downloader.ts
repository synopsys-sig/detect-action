import { ToolDownloader } from '../downloader/tool-downloader'
import * as toolCache from '@actions/tool-cache'
import path from 'path'

const DETECT_BINARY_REPO_URL = 'https://sig-repo.synopsys.com'
export const TOOL_NAME = 'detect'

export class DetectToolDownloader implements ToolDownloader {
  private readonly version: string

  constructor(version: string) {
    this.version = version
  }

  private getDetectDownloadUrl(): string {
    return `${DETECT_BINARY_REPO_URL}/bds-integrations-release/com/synopsys/integration/synopsys-detect/${this.version}/synopsys-detect-${this.version}.jar`
  }

  async download(): Promise<string> {
    const jarName = `synopsys-detect-${this.version}.jar`

    const cachedDetect = toolCache.find(TOOL_NAME, this.version)
    if (cachedDetect) {
      return path.resolve(cachedDetect, jarName)
    }

    const detectDownloadUrl = this.getDetectDownloadUrl()

    const detectDownloadPath = await toolCache.downloadTool(detectDownloadUrl)
    const cachedFolder = await toolCache.cacheFile(
      detectDownloadPath,
      jarName,
      TOOL_NAME,
      this.version
    )

    return path.resolve(cachedFolder, jarName)
  }
}
