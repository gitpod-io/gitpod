import {exec} from "../util/shell";
import {Werft} from "../util/werft";

type MonitoringSatelliteInstallerOptions = {
    werft: Werft;
    kubeconfigPath: string;
    satelliteNamespace: string;
    clusterName: string;
    nodeExporterPort: number;
    branch: string;
    previewName: string;
    previewDomain: string;
    stackdriverServiceAccount: any;
};

const sliceName = "observability";

/**
 * Installs monitoring-satellite, while updating its dependencies to the latest commit in the branch it is running.
 */
export class MonitoringSatelliteInstaller {
    constructor(private readonly options: MonitoringSatelliteInstallerOptions) {
    }

    public async install() {
        const {
            werft,
            branch,
            previewName,
        } = this.options;

        werft.log(
            sliceName,
            `Installing observability stack - Branch: ${branch}`,
        );

        const installSatellite = exec(`KUBE_PATH=${this.options.kubeconfigPath} PREVIEW_NAME=${previewName} .werft/observability/install-satellite.sh`, {slice: sliceName});

        if (installSatellite.code > 0) {
            const err = new Error(`Failed installing monitoring-satellite`)
            installSatellite.stderr.split('\n').forEach(stderrLine => werft.log(sliceName, stderrLine))
            werft.failSlice(sliceName, err)
            return
        }
    }
}
