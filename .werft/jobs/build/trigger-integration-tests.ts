import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";
import { PREVIEW_K3S_KUBECONFIG_PATH } from "./const";

const phases = {
    RUN_INTEGRATION_TESTS: "Run integration tests",
};

/**
 * Trigger integration tests
 */
export async function runIntegrationTests(werft: Werft, config: JobConfig, username: string) {
    werft.phase(phases.RUN_INTEGRATION_TESTS, "Run integration tests");

    if (config.withIntegrationTests == "skip") {
        // If we're skipping integration tests we wont trigger the job, which in turn won't create the
        // ci/werft/run-integration-tests Github Check. As ci/werft/run-integration-tests is a required
        // check this means you can't merge your PR without override checks.
        werft.log(phases.RUN_INTEGRATION_TESTS, "Skipped integration tests");
        werft.done(phases.RUN_INTEGRATION_TESTS);
        return;
    }

    try {
        exec(
            `KUBECONFIG="${PREVIEW_K3S_KUBECONFIG_PATH}" GOOGLE_APPLICATION_CREDENTIALS=/home/gitpod/.config/gcloud/legacy_credentials/cd-gitpod-deployer@gitpod-core-dev.iam.gserviceaccount.com/adc.json /workspace/test/run.sh -s ${config.withIntegrationTests}`,
        );
        werft.done(phases.RUN_INTEGRATION_TESTS);
    } catch (err) {
        if (!config.mainBuild) {
            werft.fail(phases.RUN_INTEGRATION_TESTS, err);
        }
        throw err;
    }
}
