import * as core from '@actions/core'
import { IHeaders } from 'typed-rest-client/Interfaces'
import { HttpClient } from 'typed-rest-client/HttpClient'
import { APPLICATION_NAME } from './application-constants'
import { BearerCredentialHandler } from 'typed-rest-client/handlers'
import { IRestResponse, RestClient } from 'typed-rest-client/RestClient'

export interface IBlackduckPage {
    totalCount: number
    items: Array<Object>
    _meta: Object
}

export class BlackduckPolicyChecker {
    blackduckUrl: string
    blackduckApiToken: string

    constructor(blackduckUrl: string, blackduckApiToken: string) {
        this.blackduckUrl = blackduckUrl
        this.blackduckApiToken = blackduckApiToken
    }

    async checkIfEnabledBlackduckPoliciesExist(): Promise<boolean> {
        return this.retrieveBearerTokenFromBlackduck()
            .then(bearerToken => this.retrieveBlackduckPolicies(bearerToken, 1, true))
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

    private async retrieveBlackduckPolicies(bearerToken: string, limit: number = 10, enabled?: boolean) {
        const bearerTokenHandler = new BearerCredentialHandler(bearerToken, true)
        const blackduckRestClient = new RestClient(APPLICATION_NAME, this.blackduckUrl, [bearerTokenHandler])

        const enabledFilter = (enabled === undefined || enabled === null) ? '' : `&filter=policyRuleEnabled%3A${enabled}`
        const requestUrl = `${this.blackduckUrl}/api/policy-rules?offset=0&limit=${limit}${enabledFilter}`

        return blackduckRestClient.get(requestUrl) as Promise<IRestResponse<IBlackduckPage>>
    }

    private async retrieveBearerTokenFromBlackduck() {
        core.info('Initiating authentication request to Black Duck...')
        const authenticationClient = new HttpClient(APPLICATION_NAME)
        const authorizationHeader: IHeaders = { "Authorization": `token ${this.blackduckApiToken}` }

        return authenticationClient.post(`${this.blackduckUrl}/api/tokens/authenticate`, '', authorizationHeader)
            .then(authenticationResponse => authenticationResponse.readBody())
            .then(responseBody => JSON.parse(responseBody))
            .then(responseBodyJson => {
                core.info('Successfully authenticated with Black Duck')
                return responseBodyJson.bearerToken
            })
    }

}