import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

interface config {
    phase: string;
    yamlfile: string;
    description: string;
}

const phases: { [name: string]: config } = {
    gke: {
        phase: "trigger upgrade test in GKE",
        description: "Triggers upgrade test on supplied version from Beta channel on GKE cluster",
        yamlfile: ".werft/gke-installer-tests.yaml"
    },
    aks: {
        phase: "trigger upgrade test in AKS",
        description: "Triggers upgrade test on supplied version from Beta channel on AKS cluster",
        yamlfile: ".werft/aks-installer-tests.yaml"
    },
    k3s: {
        phase: "trigger upgrade test in K3S",
        description: "Triggers upgrade test on supplied version from Beta channel on K3S cluster",
        yamlfile: ".werft/k3s-installer-tests.yaml"
    },
    eks: {
        phase: "trigger upgrade test in EKS",
        description: "Triggers upgrade test on supplied version from Beta channel on EKS cluster",
        yamlfile: ".werft/eks-installer-tests.yaml"
    },
}

/**
 * Trigger self hosted upgrade tests
 */
export async function triggerUpgradeTests(werft: Werft, config: JobConfig, username: string) {
    if (!config.withUpgradeTests || !config.fromVersion) {
        werft.log("Triger upgrade tests", "Skipped upgrade tests");
        werft.done("trigger upgrade tests");
        return;
    }

    exec(`git config --global user.name "${username}"`);
    const annotation = `-a version=${config.fromVersion} -a upgrade=true -a channel=beta`;

    for (let phase in phases) {
        const upgradeConfig = phases[phase]

        werft.phase(upgradeConfig.phase, upgradeConfig.description);

        const testFile: string = upgradeConfig.yamlfile

        try {
            exec(`WERFT_HOST="werft-grpc.gitpod-dev.com:443" WERFT_TLS_MODE="system" GITHUB_TOKEN_PATH="/mnt/secrets/gitpod-bot-github-token/token" WERFT_CREDENTIAL_HELPER="./dev/preview/werft-credential-helper.sh" KUBECONFIG=/workspace/gitpod/kubeconfigs/core-dev werft run --remote-job-path ${testFile} ${annotation} github`,
                {
                    slice: upgradeConfig.phase
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
