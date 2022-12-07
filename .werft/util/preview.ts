import {createHash} from "crypto";
import * as VM from "../vm/vm";
import {exec, execStream} from "./shell";
import {Werft} from "./werft";
import {
    CORE_DEV_KUBECONFIG_PATH,
    GCLOUD_SERVICE_ACCOUNT_PATH,
    GLOBAL_KUBECONFIG_PATH,
    HARVESTER_KUBECONFIG_PATH
} from "../jobs/build/const";

const SLICES = {
    CONFIGURE_DOCKER: "Configuring Docker",
    CONFIGURE_GCP_ACCESS: "Activating service account",
    CONFIGURE_K8S_ACCESS: "Installing dev/harvester contexts",
    INSTALL_PREVIEWCTL: "Install previewctl",
};

/**
 * Based on the current branch name this will compute the name of the associated
 * preview environment.
 *
 * NOTE: This needs to produce the same result as the function in dev/preview/util/preview-name-from-branch.sh
 */
export function previewNameFromBranchName(branchName: string): string {
    // Due to various limitations we have to ensure that we only use 20 characters
    // for the preview environment name.
    //
    // If the branch name is 20 characters or less we just use it.
    //
    // Otherwise:
    //
    // We use the first 10 chars of the sanitized branch name
    // and then the 10 first chars of the hash of the sanitized branch name
    //
    // That means collisions can happen. If they do, two jobs would try to deploy to the same
    // environment.
    //
    // see https://github.com/gitpod-io/ops/issues/1252 for details.
    const sanitizedBranchName = branchName
        .replace(/^refs\/heads\//, "")
        .toLocaleLowerCase()
        .replace(/[^-a-z0-9]/g, "-");

    if (sanitizedBranchName.length <= 20) {
        return sanitizedBranchName;
    }

    const hashed = createHash("sha256").update(sanitizedBranchName).digest("hex");
    return `${sanitizedBranchName.substring(0, 10)}${hashed.substring(0, 10)}`;
}

export class HarvesterPreviewEnvironment {
    // The prefix we use for the namespace
    static readonly namespacePrefix: string = "preview-";

    // The name of the namespace that the VM and related resources are in, e.g. preview-my-branch
    namespace: string;

    // The name of the preview environment, e.g. my-branch
    name: string;

    werft: Werft;

    constructor(werft: Werft, namespace: string) {
        this.werft = werft;
        this.namespace = namespace;
        this.name = namespace;
        if (this.namespace.startsWith(HarvesterPreviewEnvironment.namespacePrefix)) {
            this.name = namespace.slice(HarvesterPreviewEnvironment.namespacePrefix.length);
        }
    }

    async delete(): Promise<void> {
        await VM.destroyPreview({name: this.name});
    }
}

export async function configureAccess(werft: Werft) {
    werft.phase("Configure access");
    try {
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`, {
            slice: SLICES.CONFIGURE_GCP_ACCESS,
        });
        werft.done(SLICES.CONFIGURE_GCP_ACCESS);
    } catch (err) {
        werft.fail(SLICES.CONFIGURE_GCP_ACCESS, err);
    }

    try {
        await installPreviewCTL()
    } catch (e) {
        throw new Error("Failed to install Previewctl")
    }

    try {
        exec(`KUBECONFIG=${GLOBAL_KUBECONFIG_PATH} previewctl get-credentials --gcp-service-account=${GCLOUD_SERVICE_ACCOUNT_PATH}`, {
            slice: SLICES.CONFIGURE_K8S_ACCESS
        });

        exec(`mkdir -p $(dirname ${HARVESTER_KUBECONFIG_PATH})`)

        exec(
            `kubectl --context=harvester config view --minify --flatten > ${HARVESTER_KUBECONFIG_PATH}`, {
                slice: SLICES.CONFIGURE_K8S_ACCESS
            },
        )

        exec(
            `kubectl --context=dev config view --minify --flatten > ${CORE_DEV_KUBECONFIG_PATH}`, {
                slice: SLICES.CONFIGURE_K8S_ACCESS
            },
        )
        werft.done(SLICES.CONFIGURE_K8S_ACCESS);
    } catch (e) {
        werft.fail(SLICES.CONFIGURE_K8S_ACCESS, e);
        throw new Error("Failed to configure kubernetes contexts");
    }

    werft.done("Configure access");
}

export async function installPreviewCTL() {
    try {
        await execStream(`leeway run dev/preview/previewctl:install`, {
            slice: "Install previewctl",
        })
    } catch (e) {
        throw new Error("Failed to install previewctl.");
    }
}

export function configureDocker() {
    const rcDocker = exec("gcloud auth configure-docker --quiet", {slice: SLICES.CONFIGURE_DOCKER}).code;
    const rcDockerRegistry = exec("gcloud auth configure-docker europe-docker.pkg.dev --quiet", {
        slice: SLICES.CONFIGURE_DOCKER,
    }).code;

    if (rcDocker != 0 || rcDockerRegistry != 0) {
        throw new Error("Failed to configure docker with gcloud.");
    }
}


export type PreviewEnvironment = HarvesterPreviewEnvironment;
