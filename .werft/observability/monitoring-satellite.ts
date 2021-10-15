import { werft, exec } from '../util/shell';
import * as shell from 'shelljs';
import * as fs from 'fs';
import { validateIPaddress } from '../util/util';

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

/**
 * installMonitoringSatellite installs monitoring-satellite, while updating its dependencies to the latest commit in the branch it is running.
 */
export async function installMonitoringSatellite(params: InstallMonitoringSatelliteParams) {
    werft.log(sliceName, `Cloning observability repository - Branch: ${params.branch}`)
    exec(`git clone --branch ${params.branch} https://roboquat:$(cat /mnt/secrets/monitoring-satellite-preview-token/token)@github.com/gitpod-io/observability.git`, {silent: true})
    let currentCommit = exec(`git rev-parse HEAD`, {silent: true}).stdout.trim()
    let pwd = exec(`pwd`, {silent: true}).stdout.trim()
    werft.log(sliceName, `Updating Gitpod's mixin in monitoring-satellite's jsonnetfile.json to latest commit SHA: ${currentCommit}`);

    let jsonnetFile = JSON.parse(fs.readFileSync(`${pwd}/observability/jsonnetfile.json`, 'utf8'));
    jsonnetFile.dependencies.forEach(dep => {
        if(dep.name == 'gitpod') {
            dep.version = currentCommit
        }
    });
    fs.writeFileSync(`${pwd}/observability/jsonnetfile.json`, JSON.stringify(jsonnetFile));
    exec(`cd observability && jb update`, {slice: sliceName})

    let jsonnetRenderCmd = `cd observability && jsonnet -c -J vendor -m monitoring-satellite/manifests \
    --ext-str is_preview="true" \
    --ext-str alerting_enabled="false" \
    --ext-str remote_write_enabled="false" \
    --ext-str namespace="${params.satelliteNamespace}" \
    --ext-str cluster_name="${params.satelliteNamespace}" \
    --ext-str node_exporter_port="${params.nodeExporterPort}" \
    --ext-str prometheus_dns_name="prometheus-${params.previewDomain}" \
    --ext-str grafana_dns_name="grafana-${params.previewDomain}" \
    --ext-str node_affinity_label="gitpod.io/workload_services" \
    monitoring-satellite/manifests/yaml-generator.jsonnet | xargs -I{} sh -c 'cat {} | gojsontoyaml > {}.yaml' -- {} && \
    find monitoring-satellite/manifests -type f ! -name '*.yaml' ! -name '*.jsonnet'  -delete`

    werft.log(sliceName, 'rendering YAML files')
    exec(jsonnetRenderCmd, {silent: true})
    // The correct kubectl context should already be configured prior to this step
    ensureCorrectInstallationOrder()
    ensureIngressesReadiness(params)
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
    deployKubernetesServiceMonitors()
}

async function deployPrometheus() {
    werft.log(sliceName, 'installing prometheus')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/prometheus/', {silent: true})
    // Prometheus usually takes some time to be created. We sleep to give the operator some time
    // to create the StatefulSet.
    exec('sleep 20 && kubectl rollout status statefulset prometheus-k8s', {slice: sliceName})
}

async function deployGrafana() {
    werft.log(sliceName, 'installing grafana')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/grafana/', {silent: true})
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

async function deployKubernetesServiceMonitors() {
    werft.log(sliceName, 'installing Kubernetes ServiceMonitor resources')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/kubernetes/', {silent: true})
}

export function observabilityStaticChecks() {
    shell.cd('/workspace/operations/observability/mixins')

    if (!jsonnetFmtCheck() || !prometheusRulesCheck() || !jsonnetUnitTests()) {
        throw new Error("Observability static checks failed!")
    }
}

function jsonnetFmtCheck(): boolean {
    werft.log(sliceName, "Checking if jsonnet compiles and is well formated")
    let success = exec('make lint', {slice: sliceName}).code == 0

    if (!success) {
        werft.fail(sliceName, "Jsonnet linter failed. You can fix it by running 'cd operations/observability/mixins && make fmt'");
    }
    return success
}

function prometheusRulesCheck(): boolean {
    werft.log(sliceName, "Checking if Prometheus rules are valid.")
    let success = exec("make promtool-lint", {slice: sliceName}).code == 0

    if (!success) {
        const failedMessage = `Prometheus rule validation failed. For futher reference, please read:
https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/
https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/`
        werft.fail(sliceName, failedMessage)
    }
    return success
}

function jsonnetUnitTests(): boolean {
    werft.log(sliceName, "Running mixin unit tests")
    werft.log(sliceName, "Checking for hardcoded dashboard's datasources")

    let success = exec("make unit-tests", {slice: sliceName}).code == 0

    if (!success) {
        const failedMessage = `To make sure our dashboards work for both preview-environments and production/staging, we can't hardcode datasources. Please use datasource variables.`
        werft.fail(sliceName, failedMessage)
    }
    return success
}

function ensureIngressesReadiness(params: InstallMonitoringSatelliteParams) {
    // Read more about validating ingresses readiness
    // https://cloud.google.com/kubernetes-engine/docs/how-to/internal-load-balance-ingress?hl=it#validate

    let grafanaIngressReady = false
    let prometheusIngressReady = false
    werft.log(sliceName, "Checking ingresses readiness")
    for(let i = 0; i < 15; i++) {
        grafanaIngressReady = ingressReady(params.satelliteNamespace, 'grafana')
        prometheusIngressReady = ingressReady(params.satelliteNamespace, 'prometheus')

        if(grafanaIngressReady && prometheusIngressReady) { break }
        werft.log(sliceName, "Trying again in 1 minute")
        exec(`sleep 60`, {slice: sliceName}) // 1 min
        i++
    }

    if (!prometheusIngressReady || !grafanaIngressReady) {
        throw new Error('Timeout while waiting for ingresses readiness')
    }
}

function ingressReady(namespace: string, name: string): boolean {
    let ingressAddress = exec(`kubectl get ingress -n ${namespace} --no-headers ${name} | awk {'print $4'}`, {silent: true}).stdout.trim()
    if (validateIPaddress(ingressAddress)) {
        return true
    }
    werft.log(sliceName, `${name} ingress not ready.`)
    return false
}
