import { execStream } from "../util/shell";
import { Werft } from "../util/werft";
import { CORE_DEV_KUBECONFIG_PATH, PREVIEW_K3S_KUBECONFIG_PATH } from "../jobs/build/const";

type MonitoringSatelliteInstallerOptions = {
    werft: Werft;
    branch: string;
    previewName: string;
    stackdriverServiceAccount: any;
};

/**
 * Installs monitoring-satellite, while updating its dependencies to the latest commit in the branch it is running.
 */
export class MonitoringSatelliteInstaller {
    constructor(private readonly options: MonitoringSatelliteInstallerOptions) {}

    public async install(slice: string) {
        const environment = {
            DEV_KUBE_PATH: CORE_DEV_KUBECONFIG_PATH,
            DEV_KUBE_CONTEXT: "gke_gitpod-core-dev_europe-west1-b_core-dev",
            PREVIEW_K3S_KUBE_PATH: PREVIEW_K3S_KUBECONFIG_PATH,
            PREVIEW_NAME: this.options.previewName,
        };
        const variables = Object.entries(environment)
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ");
        this.options.werft.log(slice, `Installing observability stack - Branch: ${this.options.branch}`);
        await execStream(`${variables} leeway run dev/preview:deploy-monitoring-satellite`, {
            slice: slice,
        });
        this.options.werft.done(slice);
    }
}
