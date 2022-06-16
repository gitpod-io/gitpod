import * as fs from "fs";
import { join } from "path";
import { exec } from "./util/shell";
import { Werft } from "./util/werft";

const context: any = JSON.parse(fs.readFileSync("context.json").toString());

const annotations: any = context.Annotations || {};

const testConfig: string = process.argv.length > 2 ? process.argv[2] : "STANDARD_K3S_TEST";

const channel: string = annotations.channel || "unstable";
const version: string = annotations.version || "-";
const preview: string = annotations.preview || "false"; // setting to true will not destroy the setup
const upgrade: string = annotations.upgrade || "false"; // setting to true will not KOTS upgrade to the latest version. Set the channel to beta or stable in this case.
const skipTests: string = annotations.skipTests || "false"; // setting to true skips the integration tests
const deps: string = annotations.deps || ""; // options: ["external", "internal"] setting to `external` will ensure that all resource dependencies(storage, db, registry) will be external. if unset, a random selection will be used


const makefilePath: string = join("install/tests");

const werft = new Werft("installer-nightly-tests");

interface InfraConfig {
    phase: string;
    makeTarget: string;
    description: string;
}

interface TestConfig {
    DESCRIPTION: string;
    PHASES: string[];
    CLOUD: string;
}

// Each of the TEST_CONFIGURATIONS define an integration test end-to-end
// It should be a combination of multiple INFRA_PHASES, order of PHASES slice is important
const TEST_CONFIGURATIONS: { [name: string]: TestConfig } = {
    STANDARD_GKE_TEST: {
        CLOUD: "gcp",
        DESCRIPTION: "Deploy Gitpod on GKE, with managed DNS, and run integration tests",
        PHASES: [
            "STANDARD_GKE_CLUSTER",
            "CERT_MANAGER",
            "GCP_MANAGED_DNS",
            "CLUSTER_ISSUER",
            "GENERATE_KOTS_CONFIG",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
        ],
    },
    STANDARD_K3S_TEST: {
        CLOUD: "gcp", // the cloud provider is still GCP
        DESCRIPTION:
            "Deploy Gitpod on a K3s cluster, created on a GCP instance," +
            " with managed DNS and run integrations tests",
        PHASES: [
            "STANDARD_K3S_CLUSTER_ON_GCP",
            "CERT_MANAGER",
            "CLUSTER_ISSUER",
            "GENERATE_KOTS_CONFIG",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
        ],
    },
    STANDARD_AKS_TEST: {
        CLOUD: "azure",
        DESCRIPTION: "Deploy Gitpod on AKS, with managed DNS, and run integration tests",
        PHASES: [
            "STANDARD_AKS_CLUSTER",
            "CERT_MANAGER",
            "CLUSTER_ISSUER",
            "EXTERNALDNS",
            "ADD_NS_RECORD",
            "GENERATE_KOTS_CONFIG",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
        ],
    },
    STANDARD_EKS_TEST: {
        CLOUD: "aws",
        DESCRIPTION: "Create an EKS cluster",
        PHASES: [
            "STANDARD_EKS_CLUSTER",
            "CERT_MANAGER",
            "EXTERNALDNS",
            "CLUSTER_ISSUER",
            "ADD_NS_RECORD",
            "GENERATE_KOTS_CONFIG",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
        ],
    },
};

const config: TestConfig = TEST_CONFIGURATIONS[testConfig];
const cloud: string = config.CLOUD;

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
    STANDARD_AKS_CLUSTER: {
        phase: "create-std-aks-cluster",
        makeTarget: "aks-standard-cluster",
        description: "Creating an aks cluster(azure)",
    },
    STANDARD_EKS_CLUSTER: {
        phase: "create-std-eks-cluster",
        makeTarget: "eks-standard-cluster",
        description: "Creating a EKS cluster with 1 nodepool each for workspace and server",
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
    GENERATE_KOTS_CONFIG: {
        phase: "generate-kots-config",
        makeTarget: `generate-kots-config storage=${randomize()} registry=${randomize()} db=${randomize()}`,
        description: `Generate KOTS Config file`,
    },
    CLUSTER_ISSUER: {
        phase: "setup-cluster-issuer",
        makeTarget: "cluster-issuer",
        description: `Deploys ClusterIssuer for ${cloud}`,
    },
    EXTERNALDNS: {
        phase: "external-dns",
        makeTarget: "external-dns",
        description: `Deploys external-dns with ${cloud} provider`,
    },
    ADD_NS_RECORD: {
        phase: "add-ns-record",
        makeTarget: "add-ns-record",
        description: "Adds NS record for subdomain under tests.gitpod-self-hosted.com",
    },
    INSTALL_GITPOD_IGNORE_PREFLIGHTS: {
        phase: "install-gitpod-without-preflights",
        makeTarget: `kots-install channel=${channel} version=${version} preflights=false`, // this is a bit of a hack, for now we pass params like this
        description: "Install gitpod using kots community edition without preflights",
    },
    INSTALL_GITPOD: {
        phase: "install-gitpod",
        makeTarget: `kots-install channel=${channel} version=${version} preflights=true`,
        description: "Install gitpod using kots community edition",
    },
    CHECK_INSTALLATION: {
        // this is a basic test for the Gitpod setup
        phase: "check-gitpod-installation",
        makeTarget: "check-gitpod-installation",
        description: "Check gitpod installation",
    },
    KOTS_UPGRADE: {
        phase: "kots-upgrade",
        makeTarget: "kots-upgrade",
        description: "Upgrade Gitpod installation to latest version using KOTS CLI",
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


const TESTS: { [name: string]: InfraConfig } = {
    WORKSPACE_TEST: {
        phase: "run-workspace-tests",
        makeTarget: "run-workspace-tests",
        description: "Run the test for workspaces",
    },
    VSCODE_IDE_TEST: {
        phase: "run-vscode-ide-tests",
        makeTarget: "run-vscode-ide-tests",
        description: "Run the test for vscode IDE",
    },
    JB_IDE_TEST: {
        phase: "run-jb-ide-tests",
        makeTarget: "run-jb-ide-tests",
        description: "Run the test for jetbrains IDE",
    },
    CONTENTSERVICE_TEST: {
        phase: "run-cs-component-tests",
        makeTarget: "run-cs-component-tests",
        description: "Run the test for content-service component",
    },
    DB_TEST: {
        phase: "run-db-component-tests",
        makeTarget: "run-db-component-tests",
        description: "Run the test for database component",
    },
    IMAGEBUILDER_TEST: {
        phase: "run-ib-component-tests",
        makeTarget: "run-ib-component-tests",
        description: "Run the test for image-builder component",
    },
    SERVER_TEST: {
        phase: "run-server-component-tests",
        makeTarget: "run-server-component-tests",
        description: "Run the test for server component",
    },
    WS_DAEMON_TEST: {
        phase: "run-wsd-component-tests",
        makeTarget: "run-wsd-component-tests",
        description: "Run the test for ws-daemon component",
    },
    WS_MNGR_TEST: {
        phase: "run-wsm-component-tests",
        makeTarget: "run-wsm-component-tests",
        description: "Run the test for ws-manager component",
    },
}

if (config === undefined) {
    console.log(`Unknown configuration specified: "${testConfig}", Exiting...`);
    process.exit(1);
}

installerTests(TEST_CONFIGURATIONS[testConfig]).catch((err) => {
    cleanup();
    console.error(err);
    process.exit(1);
});

export async function installerTests(config: TestConfig) {
    console.log(config.DESCRIPTION);
    // these phases set up the infrastructure
    werft.phase(`create-${cloud}-infra`, `Create the infrastructure in ${cloud}`);
    for (let phase of config.PHASES) {
        const phaseSteps = INFRA_PHASES[phase];
        const ret = callMakeTargets(phaseSteps.phase, phaseSteps.description, phaseSteps.makeTarget);
        if (ret) {
            // there is not point in continuing if one stage fails for infra setup
            werft.fail(`create-${cloud}-infra`, "Cluster creation failed");
            break;
        }
    }
    werft.done(`create-${cloud}-infra`);

if (upgrade === "true") {
        // we could run integration tests in the current setup
        // but since we run nightly tests on unstable setups, feels unnecessary
        // runIntegrationTests()

        const upgradePhase = INFRA_PHASES["KOTS_UPGRADE"];
        const ret = callMakeTargets(upgradePhase.phase, upgradePhase.description, upgradePhase.makeTarget);
        if (ret) {
            return;
        }
    }

    if (skipTests === "true") {
        console.log("Skipping integration tests");
    } else {
        runIntegrationTests();
    }

    // if the preview flag is set to true, the script will print the result and exits
    if (preview === "true") {
        const resultPhase = INFRA_PHASES["RESULTS"];
        werft.phase("print-output", "Get connection details to self-hosted setup");

        // TODO(nvn): send the kubeconfig to cloud storage
        callMakeTargets(resultPhase.phase, resultPhase.description, resultPhase.makeTarget);

        exec(
            `werft log result -d  "self-hosted preview url" url "https://${process.env["TF_VAR_TEST_ID"]}.tests.gitpod-self-hosted.com"`,
        );

        exec(`werft log result -d  "Terraform state" url "Terraform state file name is ${process.env["TF_VAR_TEST_ID"]}"`);

        werft.done("print-output");
    } else {
        // if we are not doing preview, we delete the infrastructure
        cleanup();
    }
}

function runIntegrationTests() {
    werft.phase("run-integration-tests", "Run all existing integration tests");
    for (let test in TESTS) {
        const testPhase = TESTS[test];
        // todo(nvn): handle the test failures by alerting teams
        const ret = callMakeTargets(testPhase.phase, testPhase.description, testPhase.makeTarget);
        if (ret) {
            exec(
                `werft log result -d "failed test" url "${testPhase.description}(Phase ${testPhase.phase}) failed. Please refer logs."`,
            );
        }
    }

    werft.done("run-integration-tests");
}

function callMakeTargets(phase: string, description: string, makeTarget: string, failable: boolean = false) {
    werft.log(phase, `Calling ${makeTarget}`);

    // exporting cloud env var is important for the make targets
    const response = exec(`export cloud=${cloud} && make -C ${makefilePath} ${makeTarget}`, {
        slice: phase,
        dontCheckRc: true,
    });

    if (response.code) {
        console.error(`Error: ${response.stderr}`);

        if (failable) {
            werft.fail(phase, "Operation failed");
            return response.code;
        }
        werft.log(phase, `Phase failed`);
    } else {
        werft.log(phase, `Phase succeeded`);
        werft.done(phase);
    }

    return response.code;
}

function randomize(): string {
    // in the follow-up PR we will add `${platform}-${resource}` as an option here to
    // test against resource dependencies(storage, db, registry) for each cloud platform
    var depOptions: string[] = ["incluster", "external"]
    if(deps && depOptions.includes(deps)) {
        return deps
    }

    return depOptions[Math.floor(Math.random() * depOptions.length)];
}

function cleanup() {
    const phase = INFRA_PHASES["DESTROY"]
    werft.phase(phase.phase, phase.description);

    const ret = callMakeTargets(phase.phase, phase.description, phase.makeTarget)

    // if the destroy command fail, we check if any resources are pending to be removed
    // if nothing is yet to be cleaned, we return with success
    // else we list the rest of the resources to be cleaned up
    if (ret) {
        const existingState = exec(`make -C ${makefilePath} list-state`, { slice: "get-uncleaned-resources" });

        if (existingState.code) {
            console.error(`Error: Failed to check for the left over resources`);
        }

        const itemsTobeCleaned = existingState.stdout.toString().split("\n").slice(1, -1);

        if (itemsTobeCleaned.length == 0) {
            console.log("Eventhough it was not a clean run, all resources has been cleaned. Nothing to do");
            werft.done(phase.phase);
            return;
        }

        console.log(`Cleanup the following resources manually: ${itemsTobeCleaned}`);

        werft.fail(phase.phase, "Destroying of resources failed");
    } else {
        werft.done(phase.phase);
    }

    return ret;
}
