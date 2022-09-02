import { exec } from "../util/shell";
import { Werft } from "../util/werft";
import * as fs from "fs";

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
    constructor(private readonly options: MonitoringSatelliteInstallerOptions) {}

    public async install() {
        const {
            werft,
            branch,
            previewName,
        } = this.options;

        werft.log(
            sliceName,
            `Cloning observability repository - Branch: ${branch}`,
        );
        exec(
            `git clone --branch ${branch} https://roboquat:$(cat /mnt/secrets/monitoring-satellite-preview-token/token)@github.com/gitpod-io/observability.git`,
            { silent: true },
        );
        let currentCommit = exec(`git rev-parse HEAD`, { silent: true }).stdout.trim();
        let pwd = exec(`pwd`, { silent: true }).stdout.trim();
        werft.log(
            sliceName,
            `Updating Gitpod's mixin in monitoring-satellite's jsonnetfile.json to latest commit SHA: ${currentCommit}`,
        );

        let jsonnetFile = JSON.parse(fs.readFileSync(`${pwd}/observability/jsonnetfile.json`, "utf8"));
        jsonnetFile.dependencies.forEach((dep) => {
            if (dep.name == "gitpod") {
                dep.version = currentCommit;
            }
        });
        fs.writeFileSync(`${pwd}/observability/jsonnetfile.json`, JSON.stringify(jsonnetFile));
        exec(`cd observability && jb update`, { slice: sliceName });

            // As YAML is indentation sensitive we're using json instead so we don't have to worry about
            // getting the indentation right when formatting the code in TypeScript.
            const observabilityInstallerRenderCmd = `cd observability && \
            make generate && \
            ./hack/deploy-crds.sh --kubeconfig ${this.options.kubeconfigPath} && \
            kubectl create ns monitoring-satellite --kubeconfig ${this.options.kubeconfigPath} || true && \
            cd installer && echo '
            {
                "gitpod": {
                    "installServiceMonitors": true
                },
                "pyrra": {
                    "install": true
                },
                "prometheus": {
                    "externalLabels": {
                        "cluster": "${previewName}",
                        "environment": "preview-environments",
                    },
                    "resources": {
                        "requests": {
                            "memory": "200Mi",
                            "cpu": "50m",
                        },
                    },
                    "remoteWrite": [{
                        "username": "${process.env.PROM_REMOTE_WRITE_USER}",
                        "password": "${process.env.PROM_REMOTE_WRITE_PASSWORD}",
                        "url": "https://victoriametrics.gitpod.io/api/v1/write",
                        "writeRelabelConfigs": [{
                            "sourceLabels": ["__name__", "job"],
                            "separator": ";",
                            "regex": "rest_client_requests_total.*|http_prober_.*",
                            "action": "keep",
                        }],
                    }],
                },
                "imports": {
                    "yaml": [{
                            "gitURL": "https://github.com/gitpod-io/observability",
                            "path": "monitoring-satellite/manifests/kube-prometheus-rules",
                        },
                        {
                            "gitURL": "https://github.com/gitpod-io/observability",
                            "path": "monitoring-satellite/manifests/kubescape",
                        },
                        {
                            "gitURL": "https://github.com/gitpod-io/observability",
                            "path": "monitoring-satellite/manifests/grafana",
                        },
                        {
                            "gitURL": "https://github.com/gitpod-io/observability",
                            "path": "monitoring-satellite/manifests/probers",
                    }],
                },
            }' | go run main.go render --config - | kubectl --kubeconfig ${this.options.kubeconfigPath} apply -f -`;
            const renderingResult = exec(observabilityInstallerRenderCmd, { silent: false, dontCheckRc: true});
            if (renderingResult.code > 0) {
                const err = new Error(`Failed rendering YAML with exit code ${renderingResult.code}`)
                renderingResult.stderr.split('\n').forEach(stderrLine => werft.log(sliceName, stderrLine))
                werft.failSlice(sliceName, err)
                return
            }
    }
}
