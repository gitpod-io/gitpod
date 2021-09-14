import { werft, exec } from './shell';

/**
 * Monitoring satellite deployment bits
 */
 export class InstallMonitoringSatelliteParams {
    pathToKubeConfig: string
    satelliteNamespace: string
    clusterName: string
    nodeExporterPort: number
    branch: string
    previewDomain: string
}

const sliceName = 'observability';

export async function installMonitoringSatellite(params: InstallMonitoringSatelliteParams) {
    werft.log(sliceName, `Cloning observability repository - Branch: ${params.branch}`)
    exec(`git clone --branch ${params.branch} https://roboquat:$(cat /mnt/secrets/monitoring-satellite-preview-token/token)@github.com/gitpod-io/observability.git`, {silent: true})
    werft.log(sliceName, 'installing jsonnet utility tools')
    exec('cd observability && make setup-workspace', {silent: true})
    werft.log(sliceName, 'rendering YAML files')

    let jsonnetRenderCmd = `cd observability && jsonnet -c -J vendor -m monitoring-satellite/manifests \
    --ext-str is_preview="true" \
    --ext-str alerting_enabled="false" \
    --ext-str remote_write_enabled="false" \
    --ext-str namespace="${params.satelliteNamespace}" \
    --ext-str cluster_name="${params.satelliteNamespace}" \
    --ext-str node_exporter_port="${params.nodeExporterPort}" \
    --ext-str prometheus_dns_name="prometheus-${params.previewDomain}" \
    --ext-str grafana_dns_name="grafana-${params.previewDomain}" \
    monitoring-satellite/manifests/yaml-generator.jsonnet | xargs -I{} sh -c 'cat {} | gojsontoyaml > {}.yaml' -- {} && \
    find monitoring-satellite/manifests -type f ! -name '*.yaml' ! -name '*.jsonnet'  -delete`

    exec(jsonnetRenderCmd, {silent: true})
    // The correct kubectl context should already be configured prior to this step
    ensureCorrectInstallationOrder()
}

async function ensureCorrectInstallationOrder(){
    // Adds a label to the namespace metadata.
    // This label is used by ServiceMonitor's namespaceSelector, so Prometheus
    // only scrape metrics from its own namespace.
    exec('kubectl apply -f observability/monitoring-satellite/manifests/namespace.yaml', {silent: true})

    exec('kubectl apply -f observability/monitoring-satellite/manifests/podsecuritypolicy-restricted.yaml', {silent: true})
    werft.log(sliceName, 'installing prometheus-operator')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/prometheus-operator/', {silent: true})
    exec('kubectl rollout status deployment prometheus-operator', {slice: sliceName})

    deployPrometheus()
    deployGrafana()
    deployNodeExporter()
    deployKubeStateMetrics()
    deployGitpodServiceMonitors()
}

async function deployPrometheus() {
    werft.log(sliceName, 'installing prometheus')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/prometheus/', {silent: true})
    exec('sleep 5 && kubectl rollout status statefulset prometheus-k8s', {slice: sliceName})
}

async function deployGrafana() {
    werft.log(sliceName, 'installing grafana')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/grafana/', {silent: true})
    // We need to fix https://github.com/gitpod-io/observability/issues/258 first
    exec('kubectl rollout status deployment grafana', {slice: sliceName})
}

async function deployNodeExporter() {
    werft.log(sliceName, 'installing node-exporter')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/node-exporter/', {silent: true})
    exec('kubectl rollout status daemonset node-exporter', {slice: sliceName})
}

async function deployKubeStateMetrics() {
    werft.log(sliceName, 'installing kube-state-metrics')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/kube-state-metrics/', {silent: true})
    exec('kubectl rollout status deployment kube-state-metrics', {slice: sliceName})
}

async function deployGitpodServiceMonitors() {
    werft.log(sliceName, 'installing gitpod ServiceMonitor resources')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/gitpod/', {silent: true})
}
