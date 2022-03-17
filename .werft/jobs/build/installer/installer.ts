import { exec } from "../../../util/shell";
import { getGlobalWerftInstance } from "../../../util/werft";
import { getNodePoolIndex } from "../deploy-to-preview-environment";

const blockNewUserConfigPath = './blockNewUsers';
const workspaceSizeConfigPath = './workspaceSizing';
const PROJECT_NAME = "gitpod-core-dev";
const CONTAINER_REGISTRY_URL = `eu.gcr.io/${PROJECT_NAME}/build/`;
const CONTAINERD_RUNTIME_DIR = "/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io";

export interface Installer {
    configPath: string,
    version: string,
    proxySecretName: string
    domain: string
    previewName: string
    imagePullSecretName: string
    deploymentNamespace: string
    analytics: Analytics,
    withEELicense: boolean,
    withVM: boolean,
    workspaceFeatureFlags: string[],
    gitpodDaemonsetPorts: GitpodDaemonsetPorts

    init(slice: string): void
    addPreviewConfiguration(slice: string): void
    validateConfiguration(slice: string)
    render(slice: string): void
    postProcessing(slice: string): void
    install(slice: string): void
}

export interface Analytics {
    type: string,
    token: string
}

export interface GitpodDaemonsetPorts {
    registryFacade: number,
    wsDaemon: number,
}

export function newInstaller(configPath: string, version: string, proxySecretName: string, domain: string, previewName: string, imagePullSecretName: string, deploymentNamespace: string, analytics: Analytics, withEELicense: boolean, withVM: boolean, workspaceFeatureFlags: string[], gitpodDaemonsetPorts: GitpodDaemonsetPorts): Installer {

    const init = function init(slice) {
        const werft = getGlobalWerftInstance()
        werft.log(slice, "Downloading installer and initializing config file");
        exec(`docker run --entrypoint sh --rm eu.gcr.io/gitpod-core-dev/build/installer:${this.version} -c "cat /app/installer" > /tmp/installer`, { slice: slice });
        exec(`chmod +x /tmp/installer`, { slice: slice });
        exec(`/tmp/installer init > ${this.configPath}`, { slice: slice });
        werft.done(slice);
    }

    const addPreviewConfiguration = function addPreviewConfiguration(slice) {
        const werft = getGlobalWerftInstance()
        werft.log(slice, "Adding extra configuration");
        try {
            getDevCustomValues(slice, this.configPath)
            configureContainerRegistry(slice, this.configPath, this.proxySecretName, this.imagePullSecretName)
            configureDomain(slice, this.configPath, this.domain)
            configureWorkspaces(slice, this.configPath)
            configureObservability(slice, this.configPath)
            configureAuthProviders(slice, this.configPath, this.deploymentNamespace)
            configureSSHGateway(slice, this.configPath, this.deploymentNamespace)

            if (this.analytics) {
                includeAnalytics(slice, this.configPath, this.analytics.token)
            } else {
                dontIncludeAnalytics(slice, this.configPath)
            }
        } catch (err) {
            throw new Error(err)
        }
        werft.done(slice)
    }

    const validateConfiguration = function validateConfiguration(slice) {
        const werft = getGlobalWerftInstance()
        werft.log(slice, "Validating configuration");
        exec(`/tmp/installer validate config -c ${this.configPath}`, { slice: slice });
        exec(`/tmp/installer validate cluster -c ${this.configPath} || true`, { slice: slice });
        werft.done(slice)
    }

    const render = function render(slice) {
        const werft = getGlobalWerftInstance()
        werft.log(slice, "Rendering YAML manifests");
        exec(`/tmp/installer render --namespace ${this.deploymentNamespace} --config ${this.configPath} > k8s.yaml`, { slice: slice });
        werft.done(slice)
    }

    const postProcessing = function postProcessing(slice) {
        const werft = getGlobalWerftInstance()
        werft.log(slice, "Post processing YAML manfests");
        const nodepoolIndex = getNodePoolIndex(this.deploymentNamespace);

        configureLicense(slice, this.withEELicense, this.withVM)
        configureWorkspaceFeatureFlags(slice, this.workspaceFeatureFlags)
        process(slice, this.withVM, this.gitpodDaemonsetPorts, nodepoolIndex, this.previewName)

        werft.done(slice)
    }

    const install = function install(slice) {
        const werft = getGlobalWerftInstance()
        werft.log(slice, "Installing Gitpod");
        exec(`kubectl delete -n ${this.deploymentNamespace} job migrations || true`, { silent: true });
        // errors could result in outputing a secret to the werft log when kubernetes patches existing objects...
        exec(`kubectl apply -f k8s.yaml`, { silent: true });

        exec(`werft log result -d "dev installation" -c github-check-preview-env url https://${domain}/workspaces`);
        werft.done(slice)
    }

    const installer = {
        configPath,
        version,
        proxySecretName,
        domain,
        previewName,
        imagePullSecretName,
        deploymentNamespace,
        analytics,
        withEELicense,
        withVM,
        workspaceFeatureFlags,
        gitpodDaemonsetPorts,
        init,
        addPreviewConfiguration,
        validateConfiguration,
        render,
        postProcessing,
        install,
    }

    return installer
}

function getDevCustomValues(slice: string, configPath: string): void {
    exec(`yq r ./.werft/jobs/build/helm/values.dev.yaml components.server.blockNewUsers | yq prefix - 'blockNewUsers' > ${blockNewUserConfigPath}`, { slice: slice });
    exec(`yq r ./.werft/jobs/build/helm/values.variant.cpuLimits.yaml workspaceSizing.dynamic.cpu.buckets | yq prefix - 'workspace.resources.dynamicLimits.cpu' > ${workspaceSizeConfigPath}`, { slice: slice });

    exec(`yq m -i --overwrite ${configPath} ${blockNewUserConfigPath}`, { slice: slice });
    exec(`yq m -i ${configPath} ${workspaceSizeConfigPath}`, { slice: slice });
}

function configureContainerRegistry(slice: string, configPath: string, proxySecretName: string, imagePullSecretName: string): void {
    exec(`yq w -i ${configPath} certificate.name ${proxySecretName}`, { slice: slice });
    exec(`yq w -i ${configPath} containerRegistry.inCluster false`, { slice: slice });
    exec(`yq w -i ${configPath} containerRegistry.external.url ${CONTAINER_REGISTRY_URL}`, { slice: slice });
    exec(`yq w -i ${configPath} containerRegistry.external.certificate.kind secret`, { slice: slice });
    exec(`yq w -i ${configPath} containerRegistry.external.certificate.name ${imagePullSecretName}`, { slice: slice });
}

function configureDomain(slice: string, configPath: string, domain: string) {
    exec(`yq w -i ${configPath} domain ${domain}`, { slice: slice });
}

function configureWorkspaces(slice: string, configPath: string) {
    exec(`yq w -i ${configPath} workspace.runtime.containerdRuntimeDir ${CONTAINERD_RUNTIME_DIR}`, { slice: slice });
    exec(`yq w -i ${configPath} workspace.resources.requests.cpu "100m"`, { slice: slice });
}

function configureObservability(slice: string, configPath: string) {
    const tracingEndpoint = exec(`yq r ./.werft/jobs/build/helm/values.tracing.yaml tracing.endpoint`, { slice: slice }).stdout.trim();
    exec(`yq w -i ${configPath} observability.tracing.endpoint ${tracingEndpoint}`, { slice: slice });
}

// auth-provider-secret.yml is a file generated by this job by reading a secret from core-dev cluster
// 'preview-envs-authproviders' for previews running in core-dev and
// 'preview-envs-authproviders-harvester' for previews running in Harvester VMs.
// To understand how it is generated, search for 'auth-provider-secret.yml' in the code.
function configureAuthProviders(slice: string, configPath: string, namespace: string) {
    exec(`for row in $(cat auth-provider-secret.yml \
        | base64 -d -w 0 \
        | yq r - authProviders -j \
        | jq -r 'to_entries | .[] | @base64'); do
            key=$(echo $row | base64 -d | jq -r '.key')
            providerId=$(echo $row | base64 -d | jq -r '.value.id | ascii_downcase')
            data=$(echo $row | base64 -d | yq r - value --prettyPrint)

            yq w -i ${configPath} authProviders[$key].kind "secret"
            yq w -i ${configPath} authProviders[$key].name "$providerId"

            kubectl create secret generic "$providerId" \
                --namespace "${namespace}" \
                --from-literal=provider="$data" \
                --dry-run=client -o yaml | \
                kubectl replace --force -f -
        done`, { slice: slice })
}

function configureSSHGateway(slice: string, configPath: string, namespace: string) {
    exec(`cat /workspace/host-key.yaml \
            | yq w - metadata.namespace ${namespace} \
            | yq d - metadata.uid \
            | yq d - metadata.resourceVersion \
            | yq d - metadata.creationTimestamp \
            | kubectl apply -f -`, { slice: slice })
    exec(`yq w -i ${configPath} sshGatewayHostKey.kind "secret"`)
    exec(`yq w -i ${configPath} sshGatewayHostKey.name "host-key"`)
}

function includeAnalytics(slice: string, configPath: string, token: string): void {
    exec(`yq w -i ${configPath} analytics.writer segment`, { slice: slice });
    exec(`yq w -i ${configPath} analytics.segmentKey ${token}`, { slice: slice });
}

function dontIncludeAnalytics(slice: string, configPath: string): void {
    exec(`yq w -i ${configPath} analytics.writer ""`, { slice: slice });
}

function configureLicense(slice: string, withEELicense: boolean, withVM: boolean): void {
    if (withEELicense) {
        // Previews in core-dev and harvester use different domain, which requires different licenses.
        exec(`cp /mnt/secrets/gpsh-${withVM ? 'harvester' : 'coredev'}/license /tmp/license`, { slice: slice });
        // post-process.sh looks for /tmp/license, and if it exists, adds it to the configmap
    } else {
        exec(`touch /tmp/license`, { slice: slice });
    }
}

function configureWorkspaceFeatureFlags(slice: string, workspaceFeatureFlags: string[]): void {
    exec(`touch /tmp/defaultFeatureFlags`, { slice: slice });
    if (workspaceFeatureFlags && workspaceFeatureFlags.length > 0) {
        workspaceFeatureFlags.forEach(featureFlag => {
            exec(`echo \'"${featureFlag}"\' >> /tmp/defaultFeatureFlags`, { slice: slice });
        })
        // post-process.sh looks for /tmp/defaultFeatureFlags
        // each "flag" string gets added to the configmap
    }
}

function process(slice: string, withVM: boolean, daemonsetPorts: GitpodDaemonsetPorts, nodepoolIndex: number, previewName: string): void {
    const flags = withVM ? "WITH_VM=true " : ""
    exec(`${flags}./.werft/jobs/build/installer/post-process.sh ${daemonsetPorts.registryFacade} ${daemonsetPorts.wsDaemon} ${nodepoolIndex} ${previewName}`, { slice: slice });
}