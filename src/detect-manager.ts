import {execSync} from 'child_process'

export function downloadAndRunDetect(detectArgs: string) {
  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell "[Net.ServicePointManager]::SecurityProtocol = 'tls12'; irm https://detect.synopsys.com/detect7.ps1?$(Get-Random) | iex; detect ${detectArgs}"`,
        {stdio: 'inherit'}
      )
    } else {
      execSync(
        `bash <(curl -s -L https://detect.synopsys.com/detect7.sh) detect ${detectArgs}`,
        {stdio: 'inherit', shell: '/bin/bash'}
      )
    }
  } catch (error) {
    // ignored
  }
}
