import * as core from '@actions/core'
import { IHeaders } from 'typed-rest-client/Interfaces'
import { BearerCredentialHandler } from 'typed-rest-client/Handlers'
import { HttpClient } from 'typed-rest-client/HttpClient'
import { IRestResponse, RestClient } from 'typed-rest-client/RestClient'
import { APPLICATION_NAME } from '../action/constants'
import {
  BlackDuckPageResponse,
  ComponentsView,
  ComponentVersionUpgradeGuidanceView,
  ComponentVersionView,
  VulnerabilityView
} from '../model/blackduck'
import { cleanUrl } from '../utils/utils'
import { AuthenticationToken } from '../model/authentication-token'

export class BlackDuckApiService {
  private static TOKEN_EXPIRATION_DELTA = 5 * 60 * 1_000 // 5 minutes

  private readonly blackDuckUrl: string
  private readonly blackDuckApiToken: string
  private cachedAuthenticationExpireTime: number | null = null
  private cachedAuthentication: AuthenticationToken | null = null

  constructor(blackDuckUrl: string, blackDuckApiToken: string) {
    this.blackDuckUrl = cleanUrl(blackDuckUrl)
    this.blackDuckApiToken = blackDuckApiToken
  }

  private isTokenExpired(): boolean {
    return (
      !this.cachedAuthenticationExpireTime ||
      Date.now() >
        this.cachedAuthenticationExpireTime -
          BlackDuckApiService.TOKEN_EXPIRATION_DELTA
    )
  }

  private async getAccessToken(): Promise<string> {
    let currentToken = this.cachedAuthentication
    let expired = true
    if (currentToken != null) {
      expired = this.isTokenExpired()
    }
    if (expired) {
      core.debug('Access Token Expired!. Retrieving a fresh token.')
      currentToken = await this.getFreshAccessToken()
      this.cachedAuthenticationExpireTime =
        Date.now() + currentToken.expiresInMilliseconds
      this.cachedAuthentication = currentToken
    } else {
      core.debug('Access Token Ok.')
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Promise.resolve(currentToken!.bearerToken)
  }

  private async getFreshAccessToken(): Promise<AuthenticationToken> {
    core.info('Initiating authentication request to Black Duck...')
    const authenticationClient = new HttpClient(APPLICATION_NAME)
    const authorizationHeader: IHeaders = {
      Authorization: `token ${this.blackDuckApiToken}`
    }

    const httpClientResponse = await authenticationClient.post(
      `${this.blackDuckUrl}/api/tokens/authenticate`,
      '',
      authorizationHeader
    )
    const responseBody = await httpClientResponse.readBody()
    const token = JSON.parse(responseBody) as AuthenticationToken
    core.info('Successfully authenticated with Black Duck.')
    return Promise.resolve(token)
  }

  async checkIfEnabledBlackDuckPoliciesExist(): Promise<boolean> {
    core.debug('Requesting policies from Black Duck...')
    const blackDuckPolicyPage = await this.getPolicies(1, true)
    const policyCount = blackDuckPolicyPage?.result?.totalCount
    if (policyCount === undefined || policyCount === null) {
      core.warning('Failed to check Black Duck for policies.')
      return false
    } else if (policyCount > 0) {
      core.debug(`${policyCount} Black Duck policies existed.`)
      return true
    } else {
      core.info('No Black Duck policies exist.')
      return false
    }
  }

  async getUpgradeGuidanceFor(
    componentVersion: ComponentVersionView
  ): Promise<IRestResponse<ComponentVersionUpgradeGuidanceView>> {
    return this.get(`${componentVersion._meta.href}/upgrade-guidance`)
  }

  private async getComponentsMatching(
    componentIdentifier: string,
    limit = 10
  ): Promise<IRestResponse<BlackDuckPageResponse<ComponentsView>>> {
    const requestPath = `/api/components?q=${componentIdentifier}`

    return this.requestPage(requestPath, 0, limit)
  }

  async getComponentVersion(
    searchResult: ComponentsView
  ): Promise<IRestResponse<unknown>> {
    return this.get(searchResult.version)
  }

  async getComponentVersionMatching(
    componentIdentifier: string,
    limit = 10
  ): Promise<ComponentVersionView | null> {
    const componentSearchResponse = await this.getComponentsMatching(
      componentIdentifier,
      limit
    )
    const firstMatchingComponentVersionUrl =
      componentSearchResponse?.result?.items[0].version

    let componentVersion = null
    if (firstMatchingComponentVersionUrl !== undefined) {
      const componentVersionResponse: IRestResponse<ComponentVersionView> =
        await this.get(firstMatchingComponentVersionUrl)
      componentVersion = componentVersionResponse?.result
    }

    return componentVersion
  }

  async getComponentVulnerabilities(
    componentVersion: ComponentVersionView
  ): Promise<IRestResponse<BlackDuckPageResponse<VulnerabilityView>>> {
    // noinspection SpellCheckingInspection
    return this.get(
      `${componentVersion._meta.href}/vulnerabilities`,
      'application/vnd.blackducksoftware.vulnerability-4+json'
    )
  }

  private async getPolicies(
    limit = 10,
    enabled?: boolean
  ): Promise<IRestResponse<BlackDuckPageResponse<unknown>>> {
    const enabledFilter =
      enabled === undefined || enabled === null
        ? ''
        : `filter=policyRuleEnabled%3A${enabled}`
    const requestPath = `/api/policy-rules?${enabledFilter}`

    return this.requestPage(requestPath, 0, limit)
  }

  private async requestPage<Type>(
    requestPath: string,
    offset: number,
    limit: number
  ): Promise<IRestResponse<BlackDuckPageResponse<Type>>> {
    return this.get(
      `${this.blackDuckUrl}${requestPath}&offset=${offset}&limit=${limit}`
    )
  }

  private async get<Type>(
    requestUrl: string,
    acceptHeader?: string
  ): Promise<IRestResponse<Type>> {
    const bearerToken = await this.getAccessToken()
    const bearerTokenHandler = new BearerCredentialHandler(bearerToken, true)
    const blackDuckRestClient = new RestClient(
      APPLICATION_NAME,
      this.blackDuckUrl,
      [bearerTokenHandler]
    )

    return blackDuckRestClient.get(requestUrl, { acceptHeader })
  }
}
