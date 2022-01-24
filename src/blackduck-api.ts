import { debug, info, warning } from '@actions/core'
import { IHeaders } from 'typed-rest-client/Interfaces'
import { BearerCredentialHandler } from 'typed-rest-client/Handlers'
import { HttpClient } from 'typed-rest-client/HttpClient'
import { IRestResponse, RestClient } from 'typed-rest-client/RestClient'
import { APPLICATION_NAME } from './application-constants'

export interface IBlackduckView {
  _meta: {
    href: string
  }
}

export interface IBlackduckPage<Type> extends IBlackduckView {
  totalCount: number
  items: Array<Type>
}

export interface IUpgradeGuidance {
  version: string
  shortTerm: {
    version: string
    versionName: string
    vulnerabilityRisk: Object
  }
  longTerm: {
    version: string
    versionName: string
    vulnerabilityRisk: Object
  }
}

export interface IComponentVersion {
  version: string
}

export interface IRapidScanViolation {
  componentName: string
  versionName: string
  componentIdentifier: string
  violatingPolicies: {
    policyName: string
    description: string
    policySeverity: string
  }[]
  policyViolationVulnerabilities: {
    name: string
  }[]
  policyViolationLicenses: {
    name: string
  }[]
  allVulnerabilities: {
    name: string
    description: string
    vulnSeverity: string
    overallScore: number
    _meta: {
      href: string
    }
  }[]
  allLicenses: {
    name: string
    licenseFamilyName: string
    _meta: {
      href: string
    }
  }[]
}

export class BlackduckApiService {
  blackduckUrl: string
  blackduckApiToken: string

  constructor(blackduckUrl: string, blackduckApiToken: string) {
    this.blackduckUrl = cleanUrl(blackduckUrl)
    this.blackduckApiToken = blackduckApiToken
  }

  async getBearerToken(): Promise<string> {
    info('Initiating authentication request to Black Duck...')
    const authenticationClient = new HttpClient(APPLICATION_NAME)
    const authorizationHeader: IHeaders = { Authorization: `token ${this.blackduckApiToken}` }

    return authenticationClient
      .post(`${this.blackduckUrl}/api/tokens/authenticate`, '', authorizationHeader)
      .then(authenticationResponse => authenticationResponse.readBody())
      .then(responseBody => JSON.parse(responseBody))
      .then(responseBodyJson => {
        info('Successfully authenticated with Black Duck')
        return responseBodyJson.bearerToken
      })
  }

  async checkIfEnabledBlackduckPoliciesExist(bearerToken: string): Promise<boolean> {
    debug('Requesting policies from Black Duck...')
    return this.getPolicies(bearerToken, 1, true).then(blackduckPolicyPage => {
      const policyCount = blackduckPolicyPage?.result?.totalCount
      if (policyCount === undefined || policyCount === null) {
        warning('Failed to check Black Duck for policies')
        return false
      } else if (policyCount > 0) {
        debug(`${policyCount} Black Duck policies existed`)
        return true
      } else {
        info('No Black Duck policies exist')
        return false
      }
    })
  }

  async getUpgradeGuidanceFor(bearerToken: string, componentVersion: IComponentVersion): Promise<IRestResponse<IUpgradeGuidance>> {
    return this.get(bearerToken, `${componentVersion.version}/upgrade-guidance`)
  }

  async getComponentsMatching(bearerToken: string, componentIdentifier: string, limit: number = 10): Promise<IRestResponse<IBlackduckPage<IComponentVersion>>> {
    const requestPath = `/api/components?q=${componentIdentifier}`

    return this.requestPage(bearerToken, requestPath, 0, limit)
  }

  async getPolicies(bearerToken: string, limit: number = 10, enabled?: boolean) {
    const enabledFilter = enabled === undefined || enabled === null ? '' : `filter=policyRuleEnabled%3A${enabled}`
    const requestPath = `/api/policy-rules?${enabledFilter}`

    return this.requestPage(bearerToken, requestPath, 0, limit)
  }

  async requestPage(bearerToken: string, requestPath: string, offset: number, limit: number): Promise<IRestResponse<IBlackduckPage<any>>> {
    return this.get(bearerToken, `${this.blackduckUrl}${requestPath}&offset=${offset}&limit=${limit}`)
  }

  async get<Type>(bearerToken: string, requestUrl: string): Promise<IRestResponse<Type>> {
    const bearerTokenHandler = new BearerCredentialHandler(bearerToken, true)
    const blackduckRestClient = new RestClient(APPLICATION_NAME, this.blackduckUrl, [bearerTokenHandler])

    return blackduckRestClient.get(requestUrl)
  }
}

export function cleanUrl(blackduckUrl: string) {
  if (blackduckUrl && blackduckUrl.endsWith('/')) {
    return blackduckUrl.substr(0, blackduckUrl.length - 1)
  }
  return blackduckUrl
}
