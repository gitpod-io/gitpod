import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

const phases = {
    TRIGGER_UPGRADE_TESTS: "trigger self-hosted upgrade tests",
};

/**
 * Trigger self hosted upgrade tests
 */
export async function triggerUpgradeTests(werft: Werft, config: JobConfig, username: string) {
    werft.phase(phases.TRIGGER_UPGRADE_TESTS, "Trigger upgrade tests on self-hosted gitpod");

    if (!config.withUpgradeTests || !config.fromVersion) {
        werft.log(phases.TRIGGER_UPGRADE_TESTS, "Skipped upgrade tests");
        werft.done(phases.TRIGGER_UPGRADE_TESTS);
        return;
    }

    try {
        exec(`git config --global user.name "${username}"`);
        const annotation = `-a fromVersion=${config.fromVersion}`;
        exec(
            `WERFT_CREDENTIAL_HELPER="" KUBECONFIG=/workspace/gitpod/kubeconfigs/core-dev werft run --remote-job-path .werft/run-sh-upgrade-tests-gke.yaml ${annotation} github`,
            {
                slice: phases.TRIGGER_UPGRADE_TESTS,
            },
        ).trim();

        werft.done(phases.TRIGGER_UPGRADE_TESTS);
    } catch (err) {
        if (!config.mainBuild) {
            werft.fail(phases.TRIGGER_UPGRADE_TESTS, err);
        }
        exec("exit 0");
    }
}
