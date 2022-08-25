import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

interface config {
    phase: string;
    description: string;
}

const phases: { [name: string]: config } = {
    gke: {
        phase: "trigger upgrade test in GKE",
        description: "Triggers upgrade test on supplied version from Beta channel on GKE cluster",
    },
    aks: {
        phase: "trigger upgrade test in AKS",
        description: "Triggers upgrade test on supplied version from Beta channel on AKS cluster",
    },
    k3s: {
        phase: "trigger upgrade test in K3S",
        description: "Triggers upgrade test on supplied version from Beta channel on K3S cluster",
    },
    eks: {
        phase: "trigger upgrade test in EKS",
        description: "Triggers upgrade test on supplied version from Beta channel on EKS cluster",
    },
};

/**
 * Trigger self hosted upgrade tests
 */
export async function triggerUpgradeTests(werft: Werft, config: JobConfig, username: string) {
    if (!config.withUpgradeTests || !config.fromVersion) {
        werft.log("Triger upgrade tests", "Skipped upgrade tests");
        werft.done("trigger upgrade tests");
        return;
    }

    const channel: string = config.replicatedChannel || "beta";

    exec(`git config --global user.name "${username}"`);
    var annotation = `-a version=${config.fromVersion} -a upgrade=true -a channel=${channel} -a preview=true -a skipTests=true`;

    for (let phase in phases) {
        const upgradeConfig = phases[phase];

        werft.phase(upgradeConfig.phase, upgradeConfig.description);

        annotation = `${annotation} -a cluster=${phase} -a updateGitHubStatus=gitpod-io/gitpod`

        const testFile: string = `.werft/${phase}-installer-tests.yaml`;

        try {
            exec(
                `werft run --remote-job-path ${testFile} ${annotation} github`,
                {
                    slice: upgradeConfig.phase,
                },
            ).trim();

            werft.done(upgradeConfig.phase);
        } catch (err) {
            if (!config.mainBuild) {
                werft.fail(upgradeConfig.phase, err);
            }
            exec("exit 0");
        }
    }
}
