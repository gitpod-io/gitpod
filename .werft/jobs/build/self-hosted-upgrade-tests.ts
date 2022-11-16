import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

interface config {
    cloud: string,
    phase: string;
    description: string;
}

const phases: { [name: string]: config } = {
    gke: {
        cloud: "gcp",
        phase: "trigger upgrade test in GKE",
        description: "Triggers upgrade test on supplied version from Beta channel on GKE cluster",
    },
    aks: {
        cloud: "azure",
        phase: "trigger upgrade test in AKS",
        description: "Triggers upgrade test on supplied version from Beta channel on AKS cluster",
    },
    k3s: {
        cloud: "k3s",
        phase: "trigger upgrade test in K3S",
        description: "Triggers upgrade test on supplied version from Beta channel on K3S cluster",
    },
    eks: {
        cloud: "aws",
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
    var annotation = ` -a deps=external -a version=${config.fromVersion} -a upgrade=true -a channel=${channel} -a preview=true -a skipTests=true`;

    // the following bit make sure that the subdomain stays the same upon multiple runs, and always start with release
    // const regex = /[\/,\.]/g;
    // const subdomain: string = config.repository.branch.replace(regex, '-')
    const subdomain: string = "release"

    for (let phase in phases) {
        const upgradeConfig = phases[phase];

        werft.phase(upgradeConfig.phase, upgradeConfig.description);

        annotation = `${annotation} -a updateGitHubStatus=gitpod-io/gitpod \
                        -a subdomain=${subdomain}-${upgradeConfig.cloud} -a deps=external -a deleteOnFail=false`

        const testFile: string = `.werft/${phase}-installer-tests.yaml`;

        try {
            const ret = exec(
                `werft run --remote-job-path ${testFile} ${annotation} -a deleteOnFail=false github`,
                {
                    slice: upgradeConfig.phase,
                },
            )

            const jobID = ret.stdout.trim()
            exec(
                `werft log result -d  "Werft preview build for ${phase}" url "https://werft.gitpod-dev.com/job/${jobID}"`,
            );

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
    const version =  config.replicatedVersion || "-"
    const cluster =  config.cluster || "k3s";
    const formattedBranch = config.repository.branch.replace("/", "-").slice(0,10)
    const phase = phases[cluster]
    const subdomain =  `${formattedBranch}y-${phase.cloud}`

    const replicatedApp = process.env.REPLICATED_APP

    var licenseFlag: string = ""
    var annotation: string = ""


    if(!["stable", "unstable", "beta"].includes(replicatedChannel.toLowerCase())){
        werft.phase("get-replicated-license", `Create and download replicated license for ${replicatedChannel}`);

        const customerID = getCustomerID(subdomain)

        if(customerID == "") {
            exec(`replicated customer create --app ${replicatedApp} --channel ${replicatedChannel} --name ${subdomain}`,
                { slice: "get-replicated-license"})
        }

        exec(`replicated customer download-license --app ${replicatedApp} --customer ${subdomain} > license.yaml`,
            { slice: "get-replicated-license", dontCheckRc: true})

        exec(`install -D license.yaml install/licenses/${replicatedChannel}.yaml`,
            { slice: "get-replicated-license"},
        )
        werft.done("get-replicated-license");

        licenseFlag = `-s install/licenses/${replicatedChannel}.yaml`
    }

    exec(`git config --global user.name "${username}"`);

    annotation = `${annotation} -a version=${version} -a channel=${replicatedChannel} -a preview=true -a skipTests=true -a deps=external`;

    werft.phase("self-hosted-preview", `Create self-hosted preview in ${cluster}`);

    annotation = `${annotation} -a cluster=${cluster} -a updateGitHubStatus=gitpod-io/gitpod -a subdomain=${subdomain} -a deleteOnFail=false`

    const testFile: string = `.werft/${cluster}-installer-tests.yaml`;

    try {
        const ret = exec(
            `werft run --remote-job-path ${testFile} ${annotation} github ${licenseFlag}`,
            {
                slice: "self-hosted-preview"
            },
        )

        const jobID = ret.stdout.trim()
        exec(
            `werft log result -d  "Werft preview build for ${cluster} " url "https://werft.gitpod-dev.com/job/${jobID}"`,
        );


        werft.done("self-hosted-preview");
    } catch (err) {
        if (!config.mainBuild) {
            werft.fail("self-hosted-preview", err);
        }
        console.log("Deleting the created license ", subdomain)
        deleteReplicatedLicense(werft, subdomain)
        exec("exit 0");
    }
}

export async function deleteReplicatedLicense(werft: Werft, licenseName: string) {
    var customerID: string

    if(licenseName == "") {
        console.log("No customerID or license name found, skipping replicated license cleanup")
        return
    }

    customerID = getCustomerID(licenseName)

    if(customerID == "") {
        console.log("Could not find license, skipping replicated license cleanup")
        return
    }

    console.log("trying to cleanup replicated license")
    werft.phase("delete-replicated-license", "Deletes the replicated license created")
    const ret = exec(`curl --request POST \
            --url https://api.replicated.com/vendor/v3/customer/${customerID}/archive \
            --header 'Authorization: ${ process.env.REPLICATED_API_TOKEN }'`,
             {slice: "delete-replicated-license", dontCheckRc: true})
    if(ret.code){
        werft.fail("delete-replicated-license", "Could not delete the replciated license")
        return
    }

    werft.done("delete-replicated-license")
}

function getCustomerID(licenseName: string): string {
    var customerID: string = ""
    const replicatedApp = process.env.REPLICATED_APP

    const response = exec(`replicated customer ls --app ${replicatedApp} | grep ${licenseName} | awk '{print $1}'`,
                        { slice: "get-replicated-license", dontCheckRc: true})

    const customerIDS = response.stdout.split("\n").filter(item => item);
    if(customerIDS.length > 0) {
        customerID = customerIDS[0].trim()
    }

    return customerID
}
