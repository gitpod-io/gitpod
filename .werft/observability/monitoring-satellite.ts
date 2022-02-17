import { exec } from '../util/shell';
import { getGlobalWerftInstance } from '../util/werft';
import * as shell from 'shelljs';
import * as fs from 'fs';

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
    stackdriverServiceAccount: any
    withVM: boolean
}

const sliceName = 'observability';

/**
 * installMonitoringSatellite installs monitoring-satellite, while updating its dependencies to the latest commit in the branch it is running.
 */
export async function installMonitoringSatellite(params: InstallMonitoringSatelliteParams) {
    const werft = getGlobalWerftInstance()

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
    --ext-code config="{
        namespace: '${params.satelliteNamespace}',
        clusterName: '${params.satelliteNamespace}',
        tracing: {
            honeycombAPIKey: '${process.env.HONEYCOMB_API_KEY}',
            honeycombDataset: 'preview-environments',
        },
        previewEnvironment: {
            domain: '${params.previewDomain}',
            nodeExporterPort: ${params.nodeExporterPort},
        },
        ${params.withVM ? '' : "nodeAffinity: { nodeSelector: { 'gitpod.io/workload_services': 'true' }, },"  }
        stackdriver: {
            defaultProject: '${params.stackdriverServiceAccount.project_id}',
            clientEmail: '${params.stackdriverServiceAccount.client_email}',
            privateKey: '${params.stackdriverServiceAccount.private_key}',
        },
        prometheus: {
            resources: {
                requests: { memory: '200Mi', cpu: '50m' },
            },
        },
    }" \
    monitoring-satellite/manifests/yaml-generator.jsonnet | xargs -I{} sh -c 'cat {} | gojsontoyaml > {}.yaml' -- {} && \
    find monitoring-satellite/manifests -type f ! -name '*.yaml' ! -name '*.jsonnet'  -delete`

    werft.log(sliceName, 'rendering YAML files')
    exec(jsonnetRenderCmd, {silent: true})
    if(params.withVM) {
        postProcessManifests()
    }

    // The correct kubectl context should already be configured prior to this step
    ensureCorrectInstallationOrder(params.satelliteNamespace)
}

async function ensureCorrectInstallationOrder(namespace: string){
    const werft = getGlobalWerftInstance()

    werft.log(sliceName, 'installing monitoring-satellite')
    exec('cd observability && hack/deploy-satellite.sh', {slice: sliceName})

    deployGitpodServiceMonitors()
    checkReadiness(namespace)
}

async function checkReadiness(namespace: string) {
    // For some reason prometheus' statefulset always take quite some time to get created
    // Therefore we wait a couple of seconds
    exec(`sleep 30 && kubectl rollout status -n ${namespace} statefulset prometheus-k8s`, {slice: sliceName, async: true})
    exec(`kubectl rollout status -n ${namespace} deployment grafana`, {slice: sliceName, async: true})
    exec(`kubectl rollout status -n ${namespace} deployment kube-state-metrics`, {slice: sliceName, async: true})
    exec(`kubectl rollout status -n ${namespace} deployment otel-collector`, {slice: sliceName, async: true})
    exec(`kubectl rollout status -n ${namespace} daemonset node-exporter`, {slice: sliceName, async: true})
}

async function deployGitpodServiceMonitors() {
    const werft = getGlobalWerftInstance()

    werft.log(sliceName, 'installing gitpod ServiceMonitor resources')
    exec('kubectl apply -f observability/monitoring-satellite/manifests/gitpod/', {silent: true})
}

function postProcessManifests() {
    const werft = getGlobalWerftInstance()

    // We're hardcoding nodeports, so we can use them in .werft/vm/manifests.ts
    // We'll be able to access Prometheus and Grafana's UI by port-forwarding the harvester proxy into the nodePort
    werft.log(sliceName, 'Post-processing manifests so it works on Harvester')
    exec(`yq w -i observability/monitoring-satellite/manifests/grafana/service.yaml spec.type 'NodePort'`)
    exec(`yq w -i observability/monitoring-satellite/manifests/prometheus/service.yaml spec.type 'NodePort'`)

    exec(`yq w -i observability/monitoring-satellite/manifests/prometheus/service.yaml spec.ports[0].nodePort 32001`)
    exec(`yq w -i observability/monitoring-satellite/manifests/grafana/service.yaml spec.ports[0].nodePort 32000`)
}