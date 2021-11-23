export interface PolicyViolation {
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

export async function createReport(scanJson: PolicyViolation[]): Promise<string> {
  let message = ''
  if (scanJson.length == 0) {
    message = message.concat('# :white_check_mark: None of your dependencies violate policy!')
  } else {
    message = message.concat('# :warning: Found dependencies violating policy!\r\n')

    const policyViolations = scanJson.map(violation => `- [ ] **${violation.componentName} ${violation.versionName}** violates ${violation.violatingPolicyNames.map(policyName => `**${policyName}**`).join(', ')}\r\n_${violation.componentIdentifier}_\r\n`).join('')

    message = message.concat(policyViolations)
  }
  message = message.concat()

  return message
}
