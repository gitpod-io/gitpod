import { execStream } from "../../../util/shell";
import { Werft } from "../../../util/werft";
import { Analytics } from "../job-config";
import { CORE_DEV_KUBECONFIG_PATH, PREVIEW_K3S_KUBECONFIG_PATH } from "../const";

export type InstallerOptions = {
    werft: Werft;
    previewName: string;
    version: string;
    analytics?: Analytics;
    withEELicense: boolean;
    workspaceFeatureFlags: string[];
    withSlowDatabase: boolean;
};

export class Installer {
    options: InstallerOptions;

    constructor(options: InstallerOptions) {
        this.options = options;
    }

    async install(slice: string): Promise<void> {
        const environment = {
            VERSION: this.options.version,
            DEV_KUBE_PATH: CORE_DEV_KUBECONFIG_PATH,
            DEV_KUBE_CONTEXT: "gke_gitpod-core-dev_europe-west1-b_core-dev",
            PREVIEW_K3S_KUBE_PATH: PREVIEW_K3S_KUBECONFIG_PATH,
            PREVIEW_NAME: this.options.previewName,
            GITPOD_ANALYTICS: this.options.analytics,
            GITPOD_WORKSPACE_FEATURE_FLAGS: this.options.workspaceFeatureFlags.join(" "),
            GITPOD_WITH_SLOW_DATABASE: this.options.withSlowDatabase,
            GITPOD_WITH_EE_LICENSE: this.options.withEELicense,
        };
        const variables = Object.entries(environment)
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ");
        await execStream(`${variables} leeway run dev/preview:deploy-gitpod`, { slice: slice });
        this.options.werft.done(slice);
    }
}
