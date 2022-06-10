import { join } from "path";
import { exec } from "./util/shell";
import { Werft } from "./util/werft";

const testConfig: string = process.argv.length > 2 ? process.argv[2] : "STANDARD_K3S_TEST";
// we can provide the version of the gitpod to install (eg: 2022.4.2)
const version: string = process.argv.length > 3 ? process.argv[3] : "";

const makefilePath: string = join("install/tests");

const werft = new Werft("installer-nightly-tests");

interface InfraConfig {
    phase: string;
    makeTarget: string;
    description: string;
}

// `INFRA_PHASES` describe the phases that can be mixed
// and matched to form a test configuration
// Each phase should contain a `makeTarget` which
// corresponds to a target in the Makefile in ./nightly-tests/Makefile
const INFRA_PHASES: { [name: string]: InfraConfig } = {
    STANDARD_GKE_CLUSTER: {
        phase: "create-std-gke-cluster",
        makeTarget: "gke-standard-cluster",
        description: "Creating a GKE cluster with 1 nodepool each for workspace and server",
    },
    STANDARD_K3S_CLUSTER_ON_GCP: {
        phase: "create-std-k3s-cluster",
        makeTarget: "k3s-standard-cluster",
        description: "Creating a k3s cluster on GCP with 1 node",
    },
    CERT_MANAGER: {
        phase: "setup-cert-manager",
        makeTarget: "cert-manager",
        description: "Sets up cert-manager and optional cloud dns secret",
    },
    GCP_MANAGED_DNS: {
        phase: "setup-external-dns-with-cloud-dns",
        makeTarget: "managed-dns",
        description: "Sets up external-dns & cloudDNS config",
    },
    INSTALL_GITPOD_IGNORE_PREFLIGHTS: {
        phase: "install-gitpod-without-preflights",
        makeTarget: `kots-install channel=unstable version=${version} preflights=false`, // this is a bit of a hack, for now we pass params like this
        description: "Install gitpod using kots community edition without preflights",
    },
    INSTALL_GITPOD: {
        phase: "install-gitpod",
        makeTarget: `kots-install channel=unstable version=${version} preflights=true`,
        description: "Install gitpod using kots community edition",
    },
    CHECK_INSTALLATION: {
        // this is a basic test for the Gitpod setup
        phase: "check-gitpod-installation",
        makeTarget: "check-gitpod-installation",
        description: "Check gitpod installation",
    },
    RUN_INTEGRATION_TESTS: {
        phase: "run-integration-tests",
        makeTarget: "run-tests",
        description: "Runs the existing integration tests on Gitpod",
    },
    DESTROY: {
        phase: "destroy",
        makeTarget: "cleanup",
        description: "Destroy the created infrastucture",
    },
    RESULTS: {
        phase: "get-results",
        makeTarget: "get-results",
        description: "Get the result of the setup",
    },
};

interface TestConfig {
    DESCRIPTION: string;
    PHASES: string[];
}

// Each of the TEST_CONFIGURATIONS define an integration test end-to-end
// It should be a combination of multiple INFRA_PHASES, order of PHASES slice is important
const TEST_CONFIGURATIONS: { [name: string]: TestConfig } = {
    STANDARD_GKE_TEST: {
        DESCRIPTION: "Deploy Gitpod on GKE, with managed DNS, and run integration tests",
        PHASES: [
            "STANDARD_GKE_CLUSTER",
            "CERT_MANAGER",
            "GCP_MANAGED_DNS",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
            "RUN_INTEGRATION_TESTS",
            "RESULTS",
            "DESTROY",
        ],
    },
    STANDARD_K3S_TEST: {
        DESCRIPTION:
            "Deploy Gitpod on a K3s cluster, created on a GCP instance," +
            " with managed DNS and run integrations tests",
        PHASES: [
            "STANDARD_K3S_CLUSTER_ON_GCP",
            "CERT_MANAGER",
            "INSTALL_GITPOD_IGNORE_PREFLIGHTS",
            "CHECK_INSTALLATION",
            "RUN_INTEGRATION_TESTS",
            "RESULTS",
            "DESTROY",
        ],
    },
    STANDARD_K3S_PREVIEW: {
        DESCRIPTION: "Create a SH Gitpod preview environment on a K3s cluster, created on a GCP instance",
        PHASES: [
            "STANDARD_K3S_CLUSTER_ON_GCP",
            "GCP_MANAGED_DNS",
            "INSTALL_GITPOD_IGNORE_PREFLIGHTS",
            "CHECK_INSTALLATION",
            "RESULTS",
        ],
    },
};

// TODO better way to clean up
const config: TestConfig = TEST_CONFIGURATIONS[testConfig];

if (config === undefined) {
    console.log(`Unknown configuration specified: "${testConfig}", Exiting...`);
    process.exit(1);
}

installerTests(TEST_CONFIGURATIONS[testConfig]).catch((err) => {
    cleanup();
    console.error(err);
    process.exit(1);
});

function getKubeconfig() {
    const ret = exec(`make -C ${makefilePath} get-kubeconfig`);
    const filename = ret.stdout.toString().split("\n").slice(1, -1);
    exec(`echo ${filename}`);
}

export async function installerTests(config: TestConfig) {
    console.log(config.DESCRIPTION);
    for (let phase of config.PHASES) {
        const phaseSteps = INFRA_PHASES[phase];
        const ret = callMakeTargets(phaseSteps.phase, phaseSteps.description, phaseSteps.makeTarget);
        if (ret) {
            // there is not point in continuing if one stage fails
            // TODO: maybe add failable, phases
            break;
        }
    }
}

function callMakeTargets(phase: string, description: string, makeTarget: string) {
    werft.phase(phase, description);

    const response = exec(`make -C ${makefilePath} ${makeTarget}`, { slice: "call-make-target", dontCheckRc: true });

    if (response.code) {
        console.error(`Error: ${response.stderr}`);
        werft.fail(phase, "Operation failed");
    } else {
        werft.log(phase, response.stdout.toString());
        werft.done(phase);
    }

    return response.code;
}

function cleanup() {
    const phase = "destroy-infrastructure";
    werft.phase(phase, "Destroying all the created resources");

    const response = exec(`make -C ${makefilePath} cleanup`, { slice: "run-terrafrom-destroy", dontCheckRc: true });

    // if the destroy command fail, we check if any resources are pending to be removed
    // if nothing is yet to be cleaned, we return with success
    // else we list the rest of the resources to be cleaned up
    if (response.code) {
        console.error(`Error: ${response.stderr}`);

        const existingState = exec(`make -C ${makefilePath} list-state`, { slice: "get-uncleaned-resources" });
        if (existingState.code) {
            console.error(`Error: Failed to check for the left over resources`);
        }

        const itemsTobeCleaned = existingState.stdout.toString().split("\n").slice(1, -1);

        if (itemsTobeCleaned.length == 0) {
            console.log("Eventhough it was not a clean run, all resources has been cleaned. Nothing to do");
            werft.done(phase);
            return;
        }

        console.log(`Cleanup the following resources manually: ${itemsTobeCleaned}`);

        werft.fail(phase, "Destroying of resources failed");
    }

    return response.code;
}
