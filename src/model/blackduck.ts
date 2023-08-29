export interface BlackDuckView {
  _meta: ResourceMetadata
}

export interface ResourceMetadata {
  href: string
}

export interface BlackDuckPageResponse<Type> {
  items: Type[]
  totalCount: number
}

export interface ComponentVersionUpgradeGuidanceView {
  longTerm: ComponentVersionUpgradeGuidanceTermView
  shortTerm: ComponentVersionUpgradeGuidanceTermView
  version: string
}

/**
 * Note that this consolidates original API
 * `ComponentVersionUpgradeGuidanceLongTermView` and
 * `ComponentVersionUpgradeGuidanceShortTermView` since
 * we only need common attributes
 */
export interface ComponentVersionUpgradeGuidanceTermView {
  version: string
  versionName: string
  vulnerabilityRisk: ComponentVersionUpgradeGuidanceVulnerabilityRiskView
}

/**
 * Note that this consolidates original API
 * `ComponentVersionUpgradeGuidanceLongTermVulnerabilityRiskView` and
 * `ComponentVersionUpgradeGuidanceShortTermVulnerabilityRiskView` since
 * we only need common attributes
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
  // noinspection SpellCheckingInspection
  cvss2: VulnerabilityCvssView
  // noinspection SpellCheckingInspection
  cvss3: VulnerabilityCvssView
  name: string
  severity: string
  // noinspection SpellCheckingInspection
  useCvss3: boolean
}

// noinspection SpellCheckingInspection
/**
 * Note that this consolidates original API
 * `VulnerabilityCvss2View` and
 * `VulnerabilityCvss3View` since
 * we only need common attributes
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

/**
 * Note that this consolidates original API
 * `DeveloperScansScanItemsPolicyViolationLicensesViolatingPoliciesView`,
 * `DeveloperScansScanItemsPolicyViolationVulnerabilitiesViolatingPoliciesView` and
 * `DeveloperScansScanItemsViolatingPoliciesView` since
 * we only need common attributes
 */
export interface DeveloperScansScanItemsViolatingPoliciesView {
  description: string
  policyName: string
  policySeverity: string
  policyStatus: string
}

/**
 * Note that this consolidates original API
 * `DeveloperScansScanItemsPolicyViolationLicensesView` and
 * `DeveloperScansScanItemsPolicyViolationVulnerabilitiesView` since
 * we only need common attributes
 */
export interface DeveloperScansScanItemsPolicyViolationView {
  name: string
}
