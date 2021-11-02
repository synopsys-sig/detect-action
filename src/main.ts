import * as core from "@actions/core";
import * as github from "@actions/github";
import fs from "fs";
import { spawnSync } from "child_process";
import * as uploadJson from "./upload-json";

export function run() {
  const githubToken = core.getInput("github-token");
  const blackduckUrl = core.getInput("blackduck-url");
  const blackduckApiToken = core.getInput("blackduck-api-token");
  const outputPath = core.getInput("output-path");

  const context = github.context;
  const octokit = github.getOctokit(githubToken);

  const detectArgs = `--blackduck.url="${blackduckUrl}" --blackduck.api.token="${blackduckApiToken}" --detect.blackduck.scan.mode=RAPID --detect.scan.output.path="${outputPath}"`;

  if (process.platform === "win32") {
    spawnSync(
      `powershell "[Net.ServicePointManager]::SecurityProtocol = 'tls12'; irm https://detect.synopsys.com/detect7.ps1?$(Get-Random) | iex; detect ${detectArgs}"`
    );
  } else {
    spawnSync(
      `bash <(curl -s -L https://detect.synopsys.com/detect7.sh) detect ${detectArgs}"`
    );
  }

  const scanJsonPaths = fs.readdirSync(outputPath);

  uploadJson.run(outputPath, scanJsonPaths);

  scanJsonPaths.forEach((jsonPath) => {
    const rawdata = fs.readFileSync(jsonPath);
    const scanJson = JSON.parse(rawdata.toString());

    octokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: JSON.stringify(scanJson, undefined, 2),
    });
  });
}

run();
