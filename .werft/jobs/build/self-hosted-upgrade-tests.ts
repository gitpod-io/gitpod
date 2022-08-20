import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";
import * as https from "https";

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

        const testFile: string = ".werft/self-hosted-installer-tests.yaml";

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

export async function triggerSelfHostedPreview(werft: Werft, config: JobConfig, username: string) {
    const replicatedChannel =  config.replicatedChannel || config.repository.branch;
    const cluster =  config.cluster || "k3s";
    const subdomain =  `${replicatedChannel.replace("/", "-").slice(0,10)}-${cluster}`

    var licenseFlag: string = ""
    var customerID: string = ""
    var annotation: string = ""



    if(!["stable", "unstable", "beta"].includes(replicatedChannel.toLowerCase())){
        werft.phase("get-replicated-license", `Create and download replicated license for ${replicatedChannel}`);

        exec(`replicated customer create --channel ${replicatedChannel} --name ${config.version}`,
            { slice: "get-replicated-license"})

        exec(`replicated customer download-license --customer ${config.version} > license.yaml`,
            { slice: "get-replicated-license", dontCheckRc: true})

        exec(`install -D license.yaml install/licenses/${replicatedChannel}.yaml`,
            { slice: "get-replicated-license"},
        )
        werft.done("get-replicated-license");

        licenseFlag = `-s install/licenses/${replicatedChannel}.yaml`

        const ret = exec(`replicated customer ls | grep ${config.version} | awk '{print $1}'`,
                         { slice: "get-replicated-license", dontCheckRc: true})

        const customerIDS = ret.stdout.split("\n").filter(item => item);
        if(customerIDS.length > 0) {
            customerID = customerIDS[0].trim()
            annotation = `-a customerID=${customerID}`
        }
    }

    exec(`cat install/licenses/${replicatedChannel}.yaml`)

    exec(`git config --global user.name "${username}"`);

    annotation = `${annotation} -a channel=${replicatedChannel} -a preview=true -a skipTests=true -a deps=external`;

    werft.phase("self-hosted-preview", `Create self-hosted preview in ${cluster}`);

    annotation = `${annotation} -a cluster=${cluster} -a updateGitHubStatus=gitpod-io/gitpod -a subdomain=${subdomain}`

    const testFile: string = ".werft/self-hosted-installer-tests.yaml";

    try {
        exec(
            `werft run --remote-job-path ${testFile} ${annotation} github ${licenseFlag}`,
            {
                slice: "self-hosted-preview"
            },
        ).trim();

        werft.done("self-hosted-preview");
    } catch (err) {
        if (!config.mainBuild) {
            werft.fail("self-hosted-preview", err);
        }
        deleteReplicatedLicense(werft, customerID)
        exec("exit 0");
    }
}

export async function deleteReplicatedLicense(werft: Werft, customerID: string) {
    if(customerID == "") {
        console.log("No customerID found, skipping replicated license cleanup")
        return
    }

    console.log("trying to cleanup replicated license")
    werft.phase("delete-replicated-license", "Deletes the replicated license created")
    const http = require('https');

    const options = {
        method: 'POST',
        hostname: 'api.replicated.com',
        port: null,
        path: `/vendor/v3/customer/${customerID}/archive`,
        headers: {
            Authorization: process.env.REPLICATED_API_TOKEN
        }
    };

    const req = http.request(options, function (res) {
        const chunks = [];

        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            const body = Buffer.concat(chunks);
            console.log(body.toString());
        });
    });

    req.end();
    werft.done("delete-replicated-license")
}
