import { debug, info, warning } from '@actions/core'
import { IHeaders } from 'typed-rest-client/Interfaces'
import { BearerCredentialHandler } from 'typed-rest-client/Handlers'
import { HttpClient } from 'typed-rest-client/HttpClient'
import { IRestResponse, RestClient } from 'typed-rest-client/RestClient'
import { APPLICATION_NAME } from './application-constants'

export interface BlackDuckView {
  _meta: ResourceMetadata
}

export interface ResourceMetadata {
  href: string
}

export interface BlackDuckPageResponse<Type> {
  items: Array<Type>
  totalCount: number
}

export interface ComponentVersionUpgradeGuidanceView {
  longTerm: ComponentVersionUpgradeGuidanceTermView
  shortTerm: ComponentVersionUpgradeGuidanceTermView
  version: string
}

/*
Note that this consolidates original API
ComponentVersionUpgradeGuidanceLongTermView and
ComponentVersionUpgradeGuidanceShortTermView since
we only need common attributes
 */
export interface ComponentVersionUpgradeGuidanceTermView {
  version: string
  versionName: string
  vulnerabilityRisk: ComponentVersionUpgradeGuidanceVulnerabilityRiskView
}

/*
Note that this consolidates original API
ComponentVersionUpgradeGuidanceLongTermVulnerabilityRiskView and
ComponentVersionUpgradeGuidanceShortTermVulnerabilityRiskView since
we only need common attributes
 */
export interface ComponentVersionUpgradeGuidanceVulnerabilityRiskView {
  critical: number
  high: number
  low: number
  medium: number
}

export interface ComponentsView {
  version: string
  versionName: string
}

export interface ComponentVersionView extends BlackDuckView {
  license: ComponentVersionLicenseView
}

export interface ComponentVersionLicenseView extends BlackDuckView {
  licenses: ComponentVersionLicenseLicensesView[]
}

export interface ComponentVersionLicenseLicensesView extends BlackDuckView {
  license: string
  name: string
}

export interface VulnerabilityView extends BlackDuckView {
  cvss2: VulnerabilityCvssView
  cvss3: VulnerabilityCvssView
  name: string
  severity: string
  useCvss3: boolean
}

/*
Note that this consolidates original API
VulnerabilityCvss2View and
VulnerabilityCvss3View since
we only need common attributes
 */
export interface VulnerabilityCvssView {
  baseScore: number
  severity: string
}

export interface DeveloperScansScanView extends BlackDuckView {
  componentIdentifier: string
  componentName: string
  policyViolationLicenses: DeveloperScansScanItemsPolicyViolationView[]
  policyViolationVulnerabilities: DeveloperScansScanItemsPolicyViolationView[]
  versionName: string
  violatingPolicies: DeveloperScansScanItemsViolatingPoliciesView[]
}

/*
Note that this consolidates original API
DeveloperScansScanItemsPolicyViolationLicensesViolatingPoliciesView,
DeveloperScansScanItemsPolicyViolationVulnerabilitiesViolatingPoliciesView and
DeveloperScansScanItemsViolatingPoliciesView since
we only need common attributes
 */
export interface DeveloperScansScanItemsViolatingPoliciesView {
  description: string
  policyName: string
  policySeverity: string
  policyStatus: string
}

/*
Note that this consolidates original API
DeveloperScansScanItemsPolicyViolationLicensesView and
DeveloperScansScanItemsPolicyViolationVulnerabilitiesView since
we only need common attributes
 */
export interface DeveloperScansScanItemsPolicyViolationView {
  name: string
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

  async getUpgradeGuidanceFor(bearerToken: string, componentVersion: ComponentVersionView): Promise<IRestResponse<ComponentVersionUpgradeGuidanceView>> {
    return this.get(bearerToken, `${componentVersion._meta.href}/upgrade-guidance`)
  }

  async getComponentsMatching(bearerToken: string, componentIdentifier: string, limit: number = 10): Promise<IRestResponse<BlackDuckPageResponse<ComponentsView>>> {
    const requestPath = `/api/components?q=${componentIdentifier}`

    return this.requestPage(bearerToken, requestPath, 0, limit)
  }

  async getComponentVersion(bearerToken: string, searchResult: ComponentsView) {
    return this.get(bearerToken, searchResult.version)
  }

  async getComponentVersionMatching(bearerToken: string, componentIdentifier: string, limit: number = 10): Promise<ComponentVersionView | null> {
    const componentSearchResponse = await this.getComponentsMatching(bearerToken, componentIdentifier, limit)
    const firstMatchingComponentVersionUrl = componentSearchResponse?.result?.items[0].version

    let componentVersion = null
    if (firstMatchingComponentVersionUrl !== undefined) {
      const componentVersionResponse: IRestResponse<ComponentVersionView> = await this.get(bearerToken, firstMatchingComponentVersionUrl)
      componentVersion = componentVersionResponse?.result
    }

    return componentVersion
  }

  async getComponentVulnerabilties(bearerToken: string, componentVersion: ComponentVersionView): Promise<IRestResponse<BlackDuckPageResponse<VulnerabilityView>>> {
    return this.get(bearerToken, `${componentVersion._meta.href}/vulnerabilities`, 'application/vnd.blackducksoftware.vulnerability-4+json')
  }

  async getPolicies(bearerToken: string, limit: number = 10, enabled?: boolean) {
    const enabledFilter = enabled === undefined || enabled === null ? '' : `filter=policyRuleEnabled%3A${enabled}`
    const requestPath = `/api/policy-rules?${enabledFilter}`

    return this.requestPage(bearerToken, requestPath, 0, limit)
  }

  async requestPage(bearerToken: string, requestPath: string, offset: number, limit: number): Promise<IRestResponse<BlackDuckPageResponse<any>>> {
    return this.get(bearerToken, `${this.blackduckUrl}${requestPath}&offset=${offset}&limit=${limit}`)
  }

  async get<Type>(bearerToken: string, requestUrl: string, acceptHeader?: string): Promise<IRestResponse<Type>> {
    const bearerTokenHandler = new BearerCredentialHandler(bearerToken, true)
    const blackduckRestClient = new RestClient(APPLICATION_NAME, this.blackduckUrl, [bearerTokenHandler])

    return blackduckRestClient.get(requestUrl, { acceptHeader })
  }
}

export function cleanUrl(blackduckUrl: string) {
  if (blackduckUrl && blackduckUrl.endsWith('/')) {
    return blackduckUrl.substr(0, blackduckUrl.length - 1)
  }
  return blackduckUrl
}
