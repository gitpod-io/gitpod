import * as fs from "fs";
import * as util from "util";
import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

const readDir = util.promisify(fs.readdir);

export async function coverage(werft: Werft, config: JobConfig) {
  // Configure codecov as docker: SOURCE_BRANCH, SOURCE_COMMIT, DOCKER_REPO
  // (there is no support for werft)
  // --parent The commit SHA of the parent for which you are uploading coverage
  // --dir    Directory to search for coverage reports
  werft.phase("coverage", "uploading code coverage to codecov");
  const parent_commit = exec(`git rev-parse HEAD^`, {
    silent: true,
  }).stdout.trim();
  try {
    // if we don't remove the go directory codecov will scan it recursively
    exec(`sudo rm -rf go`);
    const coverageFiles = await readDir(config.coverageOutput);
    for (let index = 0; index < coverageFiles.length; index++) {
      const file = coverageFiles[index];
      if (file.indexOf("-coverage.out") == -1) {
        continue;
      }
      let flag = file.substring(0, file.length - "-coverage.out".length);
      exec(
        `codecov -N "${parent_commit}" --flags=${flag} --file "${config.coverageOutput}/${file}"`,
        { slice: "coverage" }
      );
    }

    werft.done("coverage");
  } catch (err) {
    werft.fail("coverage", err);
  }
}
