import * as fs from "fs";
import * as https from "https";
import { join } from "path";
import { exec, execStream } from "./util/shell";
import { Werft } from "./util/werft";
import { deleteReplicatedLicense } from "./jobs/build/self-hosted-upgrade-tests";

const context: any = JSON.parse(fs.readFileSync("context.json").toString());

const annotations: any = context.Annotations || {};

const testConfig: string = process.argv.length > 2 ? process.argv[2] : "STANDARD_K3S_TEST";

// we can either provide the channel name of we randomly run tests against stable and unstable channels
const channel: string = annotations.channel || randomize(["stable", "unstable"]);
const kotsApp: string = annotations.replicatedApp || "gitpod";

const version: string = annotations.version || "-";
const preview: string = annotations.preview || "false"; // setting to true will not destroy the setup
const upgrade: string = annotations.upgrade || "false"; // setting to true will not KOTS upgrade to the latest version. Set the channel to beta or stable in this case.
const skipTests: string = annotations.skipTests || "false"; // setting to true skip the integration tests
// we can explicitly specify which tests is it that we want to run or the cron will randomly pick a suite
const testSuite: string = annotations.testSuite || randomize(["workspaces", "ide", "webapp"])
const selfSigned: string = annotations.selfSigned || "false";
const deps: string = annotations.deps || ""; // options: ["external", "internal"] setting to `external` will ensure that all resource dependencies(storage, db, registry) will be external. if unset, a random selection will be used
const deleteOnFail: string = annotations.deleteOnFail || "true";

const baseDomain: string = annotations.domain || "tests.gitpod-self-hosted.com";
const gcpDnsZone: string = baseDomain.replace(/\./g, '-');

const slackHook = new Map<string, string>([
    ["self-hosted-jobs", process.env.SH_SLACK_NOTIFICATION_PATH.trim()],
    ["workspace-jobs", process.env.WS_SLACK_NOTIFICATION_PATH.trim()],
    ["ide-jobs", process.env.IDE_SLACK_NOTIFICATION_PATH.trim()],
]);

const makefilePath: string = join("install/tests");

const werft = new Werft("installer-nightly-tests");

interface InfraConfig {
    phase: string;
    makeTarget: string;
    description: string;
    slackhook?: string;
}

interface TestConfig {
    DESCRIPTION: string;
    PHASES: string[];
    CLOUD: string;
}

const k8s_version: string = randK8sVersion(testConfig);
const os_version: string = randOsVersion(); // applicable only for k3s
const op: string = preview == "true" ? "Preview" : "Test";

// Each of the TEST_CONFIGURATIONS define an integration test end-to-end
// It should be a combination of multiple INFRA_PHASES, order of PHASES slice is important
const TEST_CONFIGURATIONS: { [name: string]: TestConfig } = {
    STANDARD_GKE_TEST: {
        CLOUD: "gcp",
        DESCRIPTION: `${op} Gitpod on GKE managed cluster(version ${k8s_version})`,
        PHASES: [
            "STANDARD_CLUSTER",
            "EXTERNALDNS",
            "CERT_MANAGER",
            "ADD_NS_RECORD",
            "CLUSTER_ISSUER",
            "UPLOAD_CREDENTIALS",
            "GENERATE_KOTS_CONFIG",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
        ],
    },
    STANDARD_K3S_TEST: {
        CLOUD: "k3s",
        DESCRIPTION: `${op} Gitpod on a K3s cluster(version ${k8s_version}) on a GCP instance with ubuntu ${os_version}`,
        PHASES: [
            "STANDARD_CLUSTER",
            "ADD_NS_RECORD",
            "CERT_MANAGER",
            "CLUSTER_ISSUER",
            "UPLOAD_CREDENTIALS",
            "GENERATE_KOTS_CONFIG",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
        ],
    },
    STANDARD_AKS_TEST: {
        CLOUD: "azure",
        DESCRIPTION: `${op} Gitpod on AKS(version ${k8s_version})`,
        PHASES: [
            "STANDARD_CLUSTER",
            "CERT_MANAGER",
            "CLUSTER_ISSUER",
            "EXTERNALDNS",
            "ADD_NS_RECORD",
            "UPLOAD_CREDENTIALS",
            "GENERATE_KOTS_CONFIG",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
        ],
    },
    STANDARD_EKS_TEST: {
        CLOUD: "aws",
        DESCRIPTION: `${op} an EKS cluster(version ${k8s_version})`,
        PHASES: [
            "STANDARD_CLUSTER",
            "CERT_MANAGER",
            "EXTERNALDNS",
            "CLUSTER_ISSUER",
            "ADD_NS_RECORD",
            "UPLOAD_CREDENTIALS",
            "GENERATE_KOTS_CONFIG",
            "INSTALL_GITPOD",
            "CHECK_INSTALLATION",
        ],
    },
    CLEANUP_OLD_TESTS: {
        CLOUD: "",
        DESCRIPTION: "Deletes old test setups",
        PHASES: ["CLEANUP_OLD_TESTS"],
    },
};

const config: TestConfig = TEST_CONFIGURATIONS[testConfig];
const cloud: string = config.CLOUD;

// `INFRA_PHASES` describe the phases that can be mixed
// and matched to form a test configuration
// Each phase should contain a `makeTarget` which
// corresponds to a target in the Makefile in ../install/tests/Makefile
const INFRA_PHASES: { [name: string]: InfraConfig } = {
    STANDARD_CLUSTER: {
        phase: `create-${cloud}-ref-arch-single-cluster`,
        makeTarget: `standard-cluster`,
        description: `Create a ${cloud} kubernetes cluster(version: ${k8s_version}) using single-cluster ref-arch`
    },
    UPLOAD_CREDENTIALS: {
        phase: "upload-credentials",
        makeTarget: `upload-creds`,
        description: `Upload ${cloud} kubernetes credentials to GCS`,
    },
    CERT_MANAGER: {
        phase: "setup-cert-manager",
        makeTarget: "cert-manager",
        description: "Sets up cert-manager and optional cloud dns secret",
    },
    GCP_MANAGED_DNS: {
        phase: "setup-gke-with-cloud-dns",
        makeTarget: "managed-dns",
        description: "Sets up external-dns & cloudDNS config",
    },
    GENERATE_KOTS_CONFIG: {
        phase: "generate-kots-config",
        makeTarget: `generate-kots-config storage=${randDeps()} registry=${randDeps()} db=${randDeps()} skipTests=${skipTests} self_signed=${selfSigned}`,
        description: `Generate KOTS Config file`,
    },
    CLUSTER_ISSUER: {
        phase: "setup-cluster-issuer",
        makeTarget: `cluster-issuer self_signed=${selfSigned}`,
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
        description: `Adds NS record for subdomain under ${baseDomain}`,
    },
    INSTALL_GITPOD_IGNORE_PREFLIGHTS: {
        phase: "install-gitpod-without-preflights",
        makeTarget: `kots-install app=${kotsApp} channel=${channel} version=${version} preflights=false`, // this is a bit of a hack, for now we pass params like this
        description: "Install gitpod using kots community edition without preflights",
    },
    INSTALL_GITPOD: {
        phase: "install-gitpod",
        makeTarget: `kots-install app=${kotsApp} channel=${channel} version=${version} preflights=true`,
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
    CLEANUP_OLD_TESTS: {
        phase: "cleanup-old-tests",
        makeTarget: "cleanup-old-tests",
        description: "",
    },
};

const WORKSPACES_TESTS: { [name: string]: InfraConfig } = {
    WORKSPACE_TEST: {
        phase: "run-workspace-tests",
        makeTarget: "run-workspace-tests",
        description: "Workspace integration tests",
        slackhook: slackHook.get("workspace-jobs"),
    },
    WS_DAEMON_TEST: {
        phase: "run-ws-daemon-component-tests",
        makeTarget: "run-wsd-component-tests",
        description: "ws-daemon integration tests",
        slackhook: slackHook.get("workspace-jobs"),
    },
    WS_MNGR_TEST: {
        phase: "run-ws-manager-component-tests",
        makeTarget: "run-wsm-component-tests",
        description: "ws-manager integration tests",
        slackhook: slackHook.get("workspace-jobs"),
    },
};

const SSH_TEST = {
    phase: "run-ssh-tests",
    makeTarget: "run-ssh-tests",
    description: "SSH Gateway tests",
    slackhook: slackHook.get("ide-jobs"),
};

const VSCODE_IDE_TEST = {
    phase: "run-vscode-ide-tests",
    makeTarget: "run-vscode-ide-tests",
    description: "vscode IDE tests",
    slackhook: slackHook.get("ide-jobs"),
};

const JB_IDE_TEST = {
    phase: "run-jb-ide-tests",
    makeTarget: "run-jb-ide-tests",
    description: "jetbrains IDE tests",
    slackhook: slackHook.get("ide-jobs"),
}

const IDE_TESTS: { [name: string]: InfraConfig } = {
    SSH_TEST,
    VSCODE_IDE_TEST,
    JB_IDE_TEST,
}


const WEBAPP_TESTS: { [name: string]: InfraConfig } = {
    CONTENTSERVICE_TEST: {
        phase: "run-content-service-tests",
        makeTarget: "run-cs-component-tests",
        description: "content-service tests",
    },
    DB_TEST: {
        phase: "run-database-tests",
        makeTarget: "run-db-component-tests",
        description: "database integration tests",
    },
    IMAGEBUILDER_TEST: {
        phase: "run-image-builder-tests",
        makeTarget: "run-ib-component-tests",
        description: "image-builder tests",
    },
    SERVER_TEST: {
        phase: "run-server-tests",
        makeTarget: "run-server-component-tests",
        description: "server integration tests",
    },
}

const TestMap = {
    "workspaces": WORKSPACES_TESTS,
    "ide": IDE_TESTS,
    "ssh": SSH_TEST,
    "vscode": VSCODE_IDE_TEST,
    "jetbrains": JB_IDE_TEST,
    "webapp": WEBAPP_TESTS,
}

if (config === undefined) {
    console.log(`Unknown configuration specified: "${testConfig}", Exiting...`);
    process.exit(1);
}

installerTests(TEST_CONFIGURATIONS[testConfig]).catch((err) => {
    console.error(err);

    if(deleteOnFail == "true") {
        cleanup().finally(() => {
            process.exit(1);
        });
    } else {
        process.exit(1);
    }
});

function logJobConfig(): void {
    werft.phase("Job configuration");
    const sliceId = "Parsing job configuration";

    const jobConfig = {
        config,
        k8s_version,
        os_version,
        deps,
        version,
        preview,
        upgrade,
        skipTests,
        selfSigned,
        deleteOnFail,
        baseDomain,
        gcpDnsZone,
    };

    werft.logOutput(sliceId, JSON.stringify(jobConfig, null, 2));

    werft.log(sliceId, "Expand to see the job configuration");
    werft.done(sliceId);
}

export async function installerTests(config: TestConfig) {
    logJobConfig();

    // these phases sets up or clean up the infrastructure
    let majorPhase: string;
    let phaseMessage: string;
    if (cloud == "") {
        // If the cloud variable is not set, we have a cleanup job in hand
        majorPhase = "cleanup-infra";
        phaseMessage = "Cleanup preview and test environment infrastructure";
    } else {
        majorPhase = `create-${cloud}-infra`;
        phaseMessage = `${op} Gitpod infrastructure on ${cloud}`;
    }

    werft.phase(majorPhase, phaseMessage);
    for (let phase of config.PHASES) {
        const phaseSteps = INFRA_PHASES[phase];
        const ret = await callMakeTargets(phaseSteps.phase, phaseSteps.description, phaseSteps.makeTarget);
        if (ret) {
            // there is not point in continuing if one stage fails for infra setup
            const err: Error = new Error("Cluster creation failed");

            console.log("Trying to send slack alert");

            await sendFailureSlackAlert(phaseSteps.description, err, slackHook.get("self-hosted-jobs"));

            werft.fail(majorPhase, err.message);

            return;
        }
    }
    werft.done(majorPhase);

    if (cloud == "") {
        // this means that it was a cleanup job, nothing more to do here
        return;
    }

    if (upgrade === "true") {
        // we could run integration tests in the current setup
        // but since we run nightly tests on unstable setups, feels unnecessary
        // runIntegrationTests()

        const upgradePhase = INFRA_PHASES["KOTS_UPGRADE"];
        const ret = await callMakeTargets(upgradePhase.phase, upgradePhase.description, upgradePhase.makeTarget);
        if (ret) {
            sendFailureSlackAlert(
                upgradePhase.description,
                new Error("Upgrade test failed"),
                slackHook.get("self-hosted-jobs"),
            );
            console.log("Upgrade tests have failed, please inspect!")

            return;
        }
    }

    if (skipTests === "true") {
        console.log("Skipping integration tests");
    } else {
        await runIntegrationTests();
    }

    // if the preview flag is set to true, the script will print the result and exits
    if (preview === "true") {
        werft.phase("print-output", "Get connection details to self-hosted setup");

        exec(
            `werft log result -d  "self-hosted preview url" url "https://${process.env["TF_VAR_TEST_ID"]}.${baseDomain}"`,
        );

        if (testConfig == "STANDARD_K3S_TEST") {
            exec(
                `werft log result -d  "KUBECONFIG file store under GCP project 'sh-automated-tests'" url "gs://nightly-tests/tf-state/${process.env["TF_VAR_TEST_ID"]}-kubeconfig"`,
            );
        } else {
            exec(
                `werft log result -d  "KUBECONFIG Connection details" url "Follow cloud specific instructions to connect to the cluster"`,
            );
        }

        sendPreviewSlackAlert().catch((error: Error) => {
            console.error("Failed to send message to Slack", error);
        });

        if (selfSigned === "true") {
            exec(
                `werft log result -d  "Custom CA Certificate store underd GCP project 'sh-automated-tests'" url "gs://nightly-tests/tf-state/${process.env["TF_VAR_TEST_ID"]}-ca.pem"`,
            );
        }

        exec(
            `werft log result -d  "Terraform state" url "Terraform state file name is ${process.env["TF_VAR_TEST_ID"]}"`,
        );

        werft.done("print-output");
    } else {
        // if we are not doing preview, we delete the infrastructure
        await cleanup();
    }
}

async function runIntegrationTests() {
    werft.phase(`run-${testSuite}-integration-tests`, `Run all ${testSuite} integration tests`);

    const componentTests = TestMap[testSuite.toLowerCase()]
    if(componentTests === undefined) {
        console.log("'%s' is not a valid testSuite name, options are: 'workspaces', 'ide', 'ssh', 'vscode', 'jetbrains', 'webapp'", testSuite)
        werft.fail(`run-${testSuite}-integration-tests`, "Error finding the testSuite")
        return
    }

    const slackAlerts = new Map<string, string>([]);
    console.log(`Running ${testSuite} tests`)
    for (let test in componentTests) {
        const testPhase = componentTests[test];
        const ret = await callMakeTargets(testPhase.phase, testPhase.description, testPhase.makeTarget);
        if (ret) {
            exec(
                `werft log result -d "failed test" url "${testPhase.description}(Phase ${testPhase.phase}) failed. Please refer logs."`,
            );

            const msg: string = slackAlerts.get(testPhase.slackhook) || "";
            slackAlerts.set(testPhase.slackhook, `${msg}\n${testPhase.description}`);
        }
    }

    slackAlerts.forEach((msg: string, channel: string) => {
        sendFailureSlackAlert(msg, new Error("Integration tests failed"), channel);
    });

    werft.done("run-integration-tests");
}

/**
 * Run a make target within a werft slice.
 *
 * @return The make target return code
 */
async function callMakeTargets(slice: string, description: string, makeTarget: string, failable: boolean = false): Promise<number> {
    werft.log(slice, `Calling ${makeTarget}`);
    // exporting cloud env var is important for the make targets
    const env = `export CLUSTER_VERSION=${k8s_version} cloud=${cloud} DOMAIN=${baseDomain} GCP_ZONE=${gcpDnsZone} os_version=${os_version}`;

    const code = await execStream(
        `${env} && make -C ${makefilePath} ${makeTarget}`,
        {
            slice: slice,
            dontCheckRc: true,
        },
    );

    if (code !== 0) {
        console.error(`Error: make target ${makeTarget} exited with code ${code}`);

        if (failable) {
            werft.fail(slice, "Operation failed");
            return code;
        }
        werft.log(slice, `'${description}' failed`);
    } else {
        werft.log(slice, `'${description}' succeeded`);
        werft.done(slice);
    }

    return code;
}

function randomize(options: string[]): string {
    return options[Math.floor(Math.random() * options.length)];
}

function randDeps(): string {
    var depOptions: string[] = ["incluster", "external"];

    if (deps && depOptions.includes(deps)) {
        return deps;
    }

    return randomize(depOptions);
}

function randK8sVersion(config: string): string {
    var options: string[] = [];
    switch (config) {
        case "STANDARD_GKE_TEST": {
            options = ["1.21", "1.22", "1.23"];
            break;
        }
        case "STANDARD_AKS_TEST": {
            options = ["1.22", "1.23", "1.24"];
            break;
        }
        case "STANDARD_EKS_TEST": {
            options = ["1.21", "1.22"]; // we will start 1.23 when official Ubuntu image is out
            break;
        }
        case "STANDARD_K3S_TEST": {
            options = ["v1.22.12+k3s1", "v1.23.9+k3s1", "v1.24.3+k3s1"];
            break;
        }
    }
    // in the follow-up PR we will add `${platform}-${resource}` as an option here to
    // test against resource dependencies(storage, db, registry) for each cloud platform

    return randomize(options);
}

function randOsVersion(): string {
    // in the follow-up PR we will add `${platform}-${resource}` as an option here to
    // test against resource dependencies(storage, db, registry) for each cloud platform
    var options: string[] = ["2204", "2004", "1804"];

    return randomize(options);
}

async function cleanup(): Promise<void> {
    const phase = INFRA_PHASES["DESTROY"];
    werft.phase(phase.phase, phase.description);

    try {
        const ret = await callMakeTargets("cleanup", phase.description, phase.makeTarget);

        // if the destroy command fail, we check if any resources are pending to be removed
        // if nothing is yet to be cleaned, we return with success
        // else we list the rest of the resources to be cleaned up
        if (ret === 0) {
            werft.done(phase.phase);
        } else {
            const existingState = exec(`make -C ${makefilePath} list-state`, { slice: "get-uncleaned-resources" });

            if (existingState.code) {
                console.error(`Error: Failed to check for the left over resources`);
            }

            const itemsTobeCleaned = existingState.stdout.toString().split("\n").slice(1, -1);

            if (itemsTobeCleaned.length === 0) {
                console.log("Eventhough it was not a clean run, all resources has been cleaned. Nothing to do");
                werft.done(phase.phase);
                return;
            }

            console.log(`Cleanup the following resources manually: ${itemsTobeCleaned}`);

            werft.failSlice(phase.phase, new Error("Failed to cleanup resources"));

            await sendFailureSlackAlert(phase.description, new Error("Cleanup job failed"), slackHook.get("self-hosted-jobs"));
        }
    }
    finally {
        await deleteReplicatedLicense(werft, process.env["TF_VAR_TEST_ID"])
    }
}

export function sendFailureSlackAlert(phase: string, err: Error, hook: string): Promise<void> {
    if (typeof hook === "undefined" || hook === null) {
        return;
    }

    const data = JSON.stringify({
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text:
                        ":X: *self-hosted " +
                        op +
                        " failed*\n_Test configuration:_ `" +
                        config.DESCRIPTION +
                        "`\n_Replicated channel_: `" +
                        channel +
                        "`\n_Build:_ `" +
                        context.Name +
                        "`",
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Go to Werft",
                        emoji: true,
                    },
                    value: "click_me_123",
                    url: "https://werft.gitpod-dev.com/job/" + context.Name,
                    action_id: "button-action",
                },
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: "*Failed step:*\n" + phase + "\n",
                    },
                    {
                        type: "mrkdwn",
                        text: "*Error:*\n`" + err + "`\n",
                    },
                ],
            },
        ],
    });
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: "hooks.slack.com",
                port: 443,
                path: hook,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": data.length,
                },
            },
            () => resolve(),
        );
        req.on("error", (error: Error) => reject(error));
        req.write(data);
        req.end();
    });
}

export async function sendPreviewSlackAlert(): Promise<void> {
    const data = JSON.stringify({
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text:
                        ":white_check_mark: *self-hosted preview environment*\n_Test configuration:_ `" +
                        config.DESCRIPTION +
                        "`\n_Build:_ `" +
                        context.Name +
                        "`\n_Owner:_ `" +
                        context.Owner +
                        "`",
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Go to Werft",
                        emoji: true,
                    },
                    value: "click_me_123",
                    url: "https://werft.gitpod-dev.com/job/" + context.Name,
                    action_id: "button-action",
                },
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text:
                            "*URL:*\n<https://" +
                            process.env["TF_VAR_TEST_ID"] +
                            `.${baseDomain}|Access preview setup>`,
                    },
                    {
                        type: "mrkdwn",
                        text: "*Terraform workspace:*\n`" + process.env["TF_VAR_TEST_ID"] + "`\n",
                    },
                ],
            },
        ],
    });
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: "hooks.slack.com",
                port: 443,
                path: process.env.SH_SLACK_NOTIFICATION_PATH.trim(),
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": data.length,
                },
            },
            () => resolve(),
        );
        req.on("error", (error: Error) => reject(error));
        req.write(data);
        req.end();
    });
}
