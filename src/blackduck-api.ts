import * as core from '@actions/core'
import {IHeaders} from 'typed-rest-client/Interfaces'
import {HttpClient} from 'typed-rest-client/HttpClient'
import {APPLICATION_NAME} from './application-constants'
import {BearerCredentialHandler} from 'typed-rest-client/handlers'
import {IRestResponse, RestClient} from 'typed-rest-client/RestClient'

export interface IBlackduckPage {
  totalCount: number
  items: Array<any>
  _meta: Object
}

export interface IUpgradeGuidance {
  shortTerm: {
    versionName: string
  }
  longTerm: {
    versionName: string
  }
}

export class BlackduckApiService {
  blackduckUrl: string
  blackduckApiToken: string

  constructor(blackduckUrl: string, blackduckApiToken: string) {
    this.blackduckUrl = cleanUrl(blackduckUrl)
    this.blackduckApiToken = blackduckApiToken
  }

  async getBearerToken(): Promise<string> {
    core.info('Initiating authentication request to Black Duck...')
    const authenticationClient = new HttpClient(APPLICATION_NAME)
    const authorizationHeader: IHeaders = {Authorization: `token ${this.blackduckApiToken}`}

    return authenticationClient
      .post(`${this.blackduckUrl}/api/tokens/authenticate`, '', authorizationHeader)
      .then(authenticationResponse => authenticationResponse.readBody())
      .then(responseBody => JSON.parse(responseBody))
      .then(responseBodyJson => {
        core.info('Successfully authenticated with Black Duck')
        return responseBodyJson.bearerToken
      })
  }

  async checkIfEnabledBlackduckPoliciesExist(): Promise<boolean> {
    return this.getBearerToken()
      .then(bearerToken => this.getPolicies(bearerToken, 1, true))
      .then(blackduckPolicyPage => {
        const policyCount = blackduckPolicyPage?.result?.totalCount
        if (policyCount === undefined || policyCount === null) {
          core.warning('Failed to check Black Duck for policies')
          return false
        } else if (policyCount > 0) {
          core.debug(`${policyCount} Black Duck policies existed`)
          return true
        } else {
          core.info('No Black Duck policies exist')
          return false
        }
      })
  }

  async getUpgradeGuidanceFor(bearerToken: string, componentIdentifier: string): Promise<IRestResponse<IUpgradeGuidance>> {
    return this.getComponentsMatching(bearerToken, componentIdentifier, 1)
      .then(componentPage => componentPage?.result?.items[0]?.version)
      .then(componentVersionUrl => `${componentVersionUrl}/upgrade-guidance`)
      .then(upgradeGuidanceUrl => this.get(bearerToken, upgradeGuidanceUrl))
  }

  private async getPolicies(bearerToken: string, limit: number = 10, enabled?: boolean) {
    const enabledFilter = enabled === undefined || enabled === null ? '' : `filter=policyRuleEnabled%3A${enabled}`
    const requestPath = `/api/policy-rules?${enabledFilter}`

    return this.requestPage(bearerToken, requestPath, 0, limit)
  }

  private async getComponentsMatching(bearerToken: string, componentIdentifier: string, limit: number = 10) {
    const requestPath = `/api/components?q=${componentIdentifier}`

    return this.requestPage(bearerToken, requestPath, 0, limit)
  }

  private async requestPage(bearerToken: string, requestPath: string, offset: number, limit: number): Promise<IRestResponse<IBlackduckPage>> {
    return this.get(bearerToken, `${this.blackduckUrl}${requestPath}&offset=${offset}&limit=${limit}`)
  }

  private async get<Type>(bearerToken: string, requestUrl: string): Promise<IRestResponse<Type>> {
    const bearerTokenHandler = new BearerCredentialHandler(bearerToken, true)
    const blackduckRestClient = new RestClient(APPLICATION_NAME, this.blackduckUrl, [bearerTokenHandler])

    return blackduckRestClient.get(requestUrl)
  }
}

function cleanUrl(blackduckUrl: string) {
  if (blackduckUrl && blackduckUrl.endsWith('/')) {
    return blackduckUrl.substr(0, blackduckUrl.length - 1)
  }
  return blackduckUrl
}
