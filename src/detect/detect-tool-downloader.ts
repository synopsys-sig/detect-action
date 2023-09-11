import { ToolDownloader } from '../downloader/tool-downloader'
import * as toolCache from '@actions/tool-cache'
import path from 'path'
import { HttpClient } from 'typed-rest-client/HttpClient'
import { APPLICATION_NAME } from '../action/constants'
import { IHeaders } from 'typed-rest-client/Interfaces'
import { DetectToolsVersions } from './detect-tools-versions'
import { DetectToolVersion } from './detect-tool-version'

const DETECT_BINARY_REPO_URL = 'https://sig-repo.synopsys.com'
export const TOOL_NAME = 'detect'

export class DetectToolDownloader implements ToolDownloader {
  private async getDetectVersions(): Promise<DetectToolsVersions> {
    const authenticationClient = new HttpClient(APPLICATION_NAME)
    const headers: IHeaders = {
      'X-Result-Detail': 'info'
    }

    const httpClientResponse = await authenticationClient.get(
      `${DETECT_BINARY_REPO_URL}/api/storage/bds-integrations-release/com/synopsys/integration/synopsys-detect?properties`,
      headers
    )
    const responseBody = await httpClientResponse.readBody()
    return JSON.parse(responseBody) as DetectToolsVersions
  }

  private async findDetectVersion(
    version?: string
  ): Promise<DetectToolVersion> {
    if (version?.match(/^[0-9]+.[0-9]+.[0-9]+$/)) {
      return {
        url: `${DETECT_BINARY_REPO_URL}/bds-integrations-release/com/synopsys/integration/synopsys-detect/${version}/synopsys-detect-${version}.jar`,
        version,
        jarName: `synopsys-detect-${version}.jar`
      }
    }

    let detectVersionKey = 'DETECT_LATEST_'

    if (version?.match(/^[0-9]+/)) {
      detectVersionKey = `DETECT_LATEST_${version}`
    } else if (version) {
      throw new Error(`Invalid input version '${version}'`)
    }

    const detectVersions = await this.getDetectVersions()
    const keys = Object.keys(detectVersions.properties)
    const key = keys.filter(x => x.match(detectVersionKey)).at(-1)
    if (!key) {
      throw new Error(
        `Cannot find matching key ${detectVersionKey} on detect versions!`
      )
    }
    const url = detectVersions.properties[key].at(-1)
    if (!url) {
      throw new Error(`Cannot find url for property ${key} on detect versions!`)
    }

    const jarName = url.substring(url.lastIndexOf('/') + 1)
    const resultVersion = jarName.substring(
      jarName.lastIndexOf('-') + 1,
      jarName.length - 4
    )

    return { url, version: resultVersion, jarName }
  }

  async download(version?: string): Promise<string> {
    const detectVersion = await this.findDetectVersion(version)

    const cachedDetect = toolCache.find(TOOL_NAME, detectVersion.version)
    if (cachedDetect) {
      return path.resolve(cachedDetect, detectVersion.jarName)
    }

    const detectDownloadPath = await toolCache.downloadTool(detectVersion.url)
    const cachedFolder = await toolCache.cacheFile(
      detectDownloadPath,
      detectVersion.jarName,
      TOOL_NAME,
      detectVersion.version
    )

    return path.resolve(cachedFolder, detectVersion.jarName)
  }

  private static instance: DetectToolDownloader | null

  static getInstance(): DetectToolDownloader {
    if (!DetectToolDownloader.instance) {
      DetectToolDownloader.instance = new DetectToolDownloader()
    }
    return DetectToolDownloader.instance
  }
}
