import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

const phases = {
  TRIGGER_INTEGRATION_TESTS: "trigger integration tests",
};

/**
 * Trigger integration tests
 */
export async function triggerIntegrationTests(
  werft: Werft,
  config: JobConfig,
  username: string
) {
  werft.phase(phases.TRIGGER_INTEGRATION_TESTS, "Trigger integration tests");

  if (!config.withIntegrationTests) {
    // If we're skipping integration tests we wont trigger the job, which in turn won't create the
    // ci/werft/run-integration-tests Github Check. As ci/werft/run-integration-tests is a required
    // check this means you can't merge your PR without override checks.
    werft.log(phases.TRIGGER_INTEGRATION_TESTS, "Skipped integration tests");
    werft.done(phases.TRIGGER_INTEGRATION_TESTS);
    return;
  }

  try {
    const imageVersion = exec(
      `docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${config.version} cat /versions.yaml | yq r - 'components.integrationTest.version'`,
      { silent: true }
    ).stdout.trim();

    exec(`git config --global user.name "${username}"`);
    const annotations = [
      `version=${imageVersion}`,
      `namespace=${config.previewEnvironment.namespace}`,
      `username=${username}`,
      `updateGitHubStatus=gitpod-io/gitpod`,
    ]
      .map((annotation) => `-a ${annotation}`)
      .join(" ");
    exec(
      `werft run --remote-job-path .werft/run-integration-tests.yaml ${annotations} github`,
      { slice: phases.TRIGGER_INTEGRATION_TESTS }
    ).trim();

    werft.done(phases.TRIGGER_INTEGRATION_TESTS);
  } catch (err) {
    if (!config.mainBuild) {
      werft.fail(phases.TRIGGER_INTEGRATION_TESTS, err);
    }
    exec("exit 0");
  }
}
