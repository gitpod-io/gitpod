import { exec, ExecResult } from "../util/shell";
import { getGlobalWerftInstance, Werft } from "../util/werft";
import * as fs from "fs";
import { ObservabilityInstallationMethod } from "../jobs/build/job-config";

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
    installationMethod: ObservabilityInstallationMethod;
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
            satelliteNamespace,
            stackdriverServiceAccount,
            previewDomain,
            previewName,
            nodeExporterPort,
            installationMethod,
        } = this.options;

        werft.log(
            sliceName,
            `Cloning observability repository - Branch: ${branch} Installation method: ${installationMethod}`,
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

        if (installationMethod == "observability-installer") {
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
        } else {
            let jsonnetRenderCmd = `cd observability && jsonnet -c -J vendor -m monitoring-satellite/manifests \
            --ext-code config="{
                namespace: '${satelliteNamespace}',
                clusterName: '${previewName}',
                tracing: {
                    honeycombAPIKey: '${process.env.HONEYCOMB_API_KEY}',
                    honeycombDataset: 'preview-environments',
                },
                previewEnvironment: {
                    domain: '${previewDomain}',
                    nodeExporterPort: ${nodeExporterPort},
                },
                stackdriver: {
                    defaultProject: '${stackdriverServiceAccount.project_id}',
                    clientEmail: '${stackdriverServiceAccount.client_email}',
                    privateKey: '${stackdriverServiceAccount.private_key}',
                },
                prometheus: {
                    externalLabels: {
                        environment: 'preview-environments',
                    },
                    resources: {
                        requests: { memory: '200Mi', cpu: '50m' },
                    },
                },
                remoteWrite: {
                    username: '${process.env.PROM_REMOTE_WRITE_USER}',
                    password: '${process.env.PROM_REMOTE_WRITE_PASSWORD}',
                    urls: ['https://victoriametrics.gitpod.io/api/v1/write'],
                    writeRelabelConfigs: [{
                        sourceLabels: ['__name__', 'job'],
                        separator: ';',
                        regex: 'rest_client_requests_total.*|http_prober_.*',
                        action: 'keep',
                    }],
                },
                kubescape: {},
                pyrra: {},
                probe: {
                    targets: ['http://google.com'],
                },
            }" \
            monitoring-satellite/manifests/yaml-generator.jsonnet | xargs -I{} sh -c 'cat {} | gojsontoyaml > {}.yaml' -- {} && \
            find monitoring-satellite/manifests -type f ! -name '*.yaml' ! -name '*.jsonnet'  -delete`;
            werft.log(sliceName, "rendering YAML files using jsonnet");
            exec(jsonnetRenderCmd, { silent: true });
            this.postProcessManifests();

            this.ensureCorrectInstallationOrder();
            this.deployGitpodServiceMonitors();
            await this.waitForReadiness(werft);
        }
    }

    private ensureCorrectInstallationOrder() {
        const { werft, kubeconfigPath } = this.options;

        werft.log(sliceName, "installing monitoring-satellite");
        exec(`cd observability && hack/deploy-satellite.sh --kubeconfig ${kubeconfigPath}`, { slice: sliceName });
    }

    private async waitForReadiness(werft: Werft) {
        const { kubeconfigPath, satelliteNamespace } = this.options;

        async function execAndLogOnError(
            werft: Werft,
            objectType: string,
            objectName: string,
            preSleep: number = 0,
        ): Promise<void> {
            const rc = exec(
                `sleep ${preSleep} && kubectl --kubeconfig ${kubeconfigPath} rollout status -n ${satelliteNamespace} ${objectType} ${objectName}`,
                {
                    slice: sliceName,
                    dontCheckRc: true,
                },
            ).code;
            if (rc != 0) {
                werft.log(sliceName, `Observability failed to install for ${objectName} of type ${objectType}`);
                const statusDebug = exec(
                    `kubectl --kubeconfig ${kubeconfigPath} -n ${satelliteNamespace} get ${objectType} ${objectName} -o jsonpath="{.status}"`,
                    {
                        slice: sliceName,
                    },
                );
                werft.log(sliceName, `Status for ${objectName} of type ${objectType}: ${statusDebug}`);
            }
            return;
        }

        const checks: Promise<any>[] = [];
        // For some reason prometheus' statefulset always take quite some time to get created
        // Therefore we wait a couple of seconds
        checks.push(execAndLogOnError(werft, "statefulset", "prometheus-k8s", 30));
        checks.push(execAndLogOnError(werft, "deployment", "grafana"));
        checks.push(execAndLogOnError(werft, "deployment", "kube-state-metrics"));
        checks.push(execAndLogOnError(werft, "deployment", "otel-collector"));
        // core-dev is just too unstable for node-exporter
        // we don't guarantee that it will run at all
        checks.push(execAndLogOnError(werft, "daemonset", "node-exporter"));

        await Promise.all(checks);
    }

    private deployGitpodServiceMonitors() {
        const { werft, kubeconfigPath } = this.options;

        werft.log(sliceName, "installing gitpod ServiceMonitor resources");
        exec(`kubectl --kubeconfig ${kubeconfigPath} apply -f observability/monitoring-satellite/manifests/gitpod/`, {
            silent: true,
        });
    }

    private postProcessManifests() {
        const werft = getGlobalWerftInstance();

        // We're hardcoding nodeports, so we can use them in .werft/vm/manifests.ts
        // We'll be able to access Prometheus and Grafana's UI by port-forwarding the harvester proxy into the nodePort
        werft.log(sliceName, "Post-processing manifests so it works on Harvester");
        exec(`yq w -i observability/monitoring-satellite/manifests/grafana/service.yaml spec.type 'NodePort'`);
        exec(`yq w -i observability/monitoring-satellite/manifests/prometheus/service.yaml spec.type 'NodePort'`);

        exec(
            `yq w -i observability/monitoring-satellite/manifests/prometheus/service.yaml spec.ports[0].nodePort 32001`,
        );
        exec(`yq w -i observability/monitoring-satellite/manifests/grafana/service.yaml spec.ports[0].nodePort 32000`);
    }
}
