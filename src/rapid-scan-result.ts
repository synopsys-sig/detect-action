export interface RapidScanResult {
  violations: Violation[]
}

export interface Violation {
  componentName: string
  versionName: string
  componentIdentifier: string
  violatingPolicyNames: string[]
  errorMessage: string
  _meta: Meta
}

export interface Meta {
  href: string
}
