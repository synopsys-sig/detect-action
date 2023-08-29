export interface ReportLine {
  policiesViolated: string
  dependency: string
  licenses: string
  vulnerabilities: string
  shortTermRecommendedUpgrade: string
  longTermRecommendedUpdate: string
}

// TODO use it extract logic from generator to other
export interface BlackDuckScanReport {
  hasPolicyViolations: boolean
  reports: IComponentReport[]
}

export interface IComponentReport {
  violatedPolicies: string[]
  name: string
  href?: string
  licenses: ILicenseReport[]
  vulnerabilities: IVulnerabilityReport[]
  shortTermUpgrade?: IUpgradeReport
  longTermUpgrade?: IUpgradeReport
}

export interface ILicenseReport {
  name: string
  href: string
  violatesPolicy: boolean
}

export interface IVulnerabilityReport {
  name: string
  violatesPolicy: boolean
  href?: string
  // noinspection SpellCheckingInspection
  cvssScore?: number
  severity?: string
}

export interface IUpgradeReport {
  name: string
  href: string
  vulnerabilityCount: number
}
