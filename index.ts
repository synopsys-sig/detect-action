import * as core from '@actions/core';
import * as github from '@actions/github';
import fs from 'fs';
import { spawnSync } from 'child_process';
import * as uploadJson from './upload-json';

export function run() {
  let githubToken = core.getInput('github-token')
  let blackduckUrl = core.getInput('blackduck-url');
  let blackduckApiToken = core.getInput('blackduck-api-token');
  let outputPath = core.getInput('output-path');

  let context = github.context;
  let octokit = github.getOctokit(githubToken);

  let detectArgs = `--blackduck.url=\"${ blackduckUrl }\" --blackduck.api.token=\"${ blackduckApiToken }\" --detect.blackduck.scan.mode=RAPID --detect.scan.output.path=\"${ outputPath }\"`

  if (process.platform === 'win32') {
    spawnSync(`powershell "[Net.ServicePointManager]::SecurityProtocol = 'tls12'; irm https://detect.synopsys.com/detect7.ps1?$(Get-Random) | iex; detect ${detectArgs}"`);
  } else {
    spawnSync(`bash <(curl -s -L https://detect.synopsys.com/detect7.sh) detect ${detectArgs}"`);
  }

  let scanJsonPaths = fs.readdirSync(outputPath);

  uploadJson.run(outputPath, scanJsonPaths);

  scanJsonPaths.forEach((jsonPath) => {
    let scanJson = require(jsonPath);

    octokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: JSON.stringify(scanJson, undefined, 2)
    });
  });
}
