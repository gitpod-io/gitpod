import { exec } from "../util/shell";
import { getGlobalWerftInstance, Werft } from "../util/werft";
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
            satelliteNamespace,
            stackdriverServiceAccount,
            previewDomain,
            previewName,
            nodeExporterPort,
        } = this.options;

        werft.log(sliceName, `Cloning observability repository - Branch: ${branch}`);
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
                urls: ['https://prometheus.gitpod-dev.com/api/v1/write'],
                writeRelabelConfigs: [{
                    sourceLabels: ['__name__', 'job'],
                    separator: ';',
                    regex: 'probe_.*|rest_client_requests_total.*|up;probe',
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
        find monitoring-satellite/manifests -type f ! -name '*.yaml' ! -name '*.jsonnet'  -delete`

        werft.log(sliceName, "rendering YAML files");
        exec(jsonnetRenderCmd, { silent: true });
        this.postProcessManifests();

        this.ensureCorrectInstallationOrder()
        this.deployGitpodServiceMonitors();
        await this.waitForReadiness()
    }

    private ensureCorrectInstallationOrder() {
        const { werft, kubeconfigPath } = this.options;

        werft.log(sliceName, "installing monitoring-satellite");
        exec(`cd observability && hack/deploy-satellite.sh --kubeconfig ${kubeconfigPath}`, { slice: sliceName });
    }

    private async waitForReadiness() {
        const { kubeconfigPath, satelliteNamespace } = this.options;

        const checks: Promise<any>[] = [];
        // For some reason prometheus' statefulset always take quite some time to get created
        // Therefore we wait a couple of seconds
        checks.push(
            exec(
                `sleep 30 && kubectl --kubeconfig ${kubeconfigPath} rollout status -n ${satelliteNamespace} statefulset prometheus-k8s`,
                { slice: sliceName, async: true },
            ),
        );
        checks.push(
            exec(`kubectl --kubeconfig ${kubeconfigPath} rollout status -n ${satelliteNamespace} deployment grafana`, {
                slice: sliceName,
                async: true,
            }),
        );
        checks.push(
            exec(
                `kubectl --kubeconfig ${kubeconfigPath} rollout status -n ${satelliteNamespace} deployment kube-state-metrics`,
                { slice: sliceName, async: true },
            ),
        );
        checks.push(
            exec(
                `kubectl --kubeconfig ${kubeconfigPath} rollout status -n ${satelliteNamespace} deployment otel-collector`,
                { slice: sliceName, async: true },
            ),
        );

        // core-dev is just too unstable for node-exporter
        // we don't guarantee that it will run at all
        checks.push(
            exec(
                `kubectl --kubeconfig ${kubeconfigPath} rollout status -n ${satelliteNamespace} daemonset node-exporter`,
                { slice: sliceName, async: true },
            ),
        );

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
