import { exec } from "../../../util/shell";
import { Werft } from "../../../util/werft";
import { getNodePoolIndex } from "../deploy-to-preview-environment";

const BLOCK_NEW_USER_CONFIG_PATH = './blockNewUsers';
const WORKSPACE_SIZE_CONFIG_PATH = './workspaceSizing';
const PROJECT_NAME = "gitpod-core-dev";
const CONTAINER_REGISTRY_URL = `eu.gcr.io/${PROJECT_NAME}/build/`;
const CONTAINERD_RUNTIME_DIR = "/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io";

export type Analytics = {
    type: string,
    token: string
}

export type GitpodDaemonsetPorts = {
    registryFacade: number,
    wsDaemon: number,
}

export class Installer {
    werft: Werft
    configPath: string
    version: string
    proxySecretName: string
    domain: string
    previewName: string
    imagePullSecretName: string
    deploymentNamespace: string
    analytics: Analytics
    withEELicense: boolean
    withVM: boolean
    workspaceFeatureFlags: string[]
    gitpodDaemonsetPorts: GitpodDaemonsetPorts

    constructor(werft: Werft, configPath: string, version: string, proxySecretName: string, domain: string, previewName: string, imagePullSecretName: string, deploymentNamespace: string, analytics: Analytics, withEELicense: boolean, withVM: boolean, workspaceFeatureFlags: string[], gitpodDaemonsetPorts: GitpodDaemonsetPorts) {
        this.werft = werft
        this.configPath = configPath
        this.version = version
        this.proxySecretName = proxySecretName
        this.domain = domain
        this.previewName = previewName
        this.imagePullSecretName = imagePullSecretName
        this.deploymentNamespace = deploymentNamespace
        this.analytics = analytics
        this.withEELicense = withEELicense
        this.withVM = withVM
        this.workspaceFeatureFlags = workspaceFeatureFlags
        this.gitpodDaemonsetPorts = gitpodDaemonsetPorts
    }

    init(slice: string): void {
        this.werft.log(slice, "Downloading installer and initializing config file");
        exec(`docker run --entrypoint sh --rm eu.gcr.io/gitpod-core-dev/build/installer:${this.version} -c "cat /app/installer" > /tmp/installer`, { slice: slice });
        exec(`chmod +x /tmp/installer`, { slice: slice });
        exec(`/tmp/installer init > ${this.configPath}`, { slice: slice });
        this.werft.done(slice);
    }

    addPreviewConfiguration(slice: string): void {
        this.werft.log(slice, "Adding extra configuration");
        try {
            this.getDevCustomValues(slice)
            this.configureContainerRegistry(slice)
            this.configureDomain(slice)
            this.configureWorkspaces(slice)
            this.configureObservability(slice)
            this.configureAuthProviders(slice)
            this.configureSSHGateway(slice)

            if (this.analytics) {
                this.includeAnalytics(slice)
            } else {
                this.dontIncludeAnalytics(slice)
            }
        } catch (err) {
            throw new Error(err)
        }
        this.werft.done(slice)
    }

    private getDevCustomValues(slice: string): void {
        exec(`yq r ./.werft/jobs/build/helm/values.dev.yaml components.server.blockNewUsers | yq prefix - 'blockNewUsers' > ${BLOCK_NEW_USER_CONFIG_PATH}`, { slice: slice });
        exec(`yq r ./.werft/jobs/build/helm/values.variant.cpuLimits.yaml workspaceSizing.dynamic.cpu.buckets | yq prefix - 'workspace.resources.dynamicLimits.cpu' > ${WORKSPACE_SIZE_CONFIG_PATH}`, { slice: slice });

        exec(`yq m -i --overwrite ${this.configPath} ${BLOCK_NEW_USER_CONFIG_PATH}`, { slice: slice });
        exec(`yq m -i ${this.configPath} ${WORKSPACE_SIZE_CONFIG_PATH}`, { slice: slice });
    }

    private configureContainerRegistry(slice: string): void {
        exec(`yq w -i ${this.configPath} certificate.name ${this.proxySecretName}`, { slice: slice });
        exec(`yq w -i ${this.configPath} containerRegistry.inCluster false`, { slice: slice });
        exec(`yq w -i ${this.configPath} containerRegistry.external.url ${CONTAINER_REGISTRY_URL}`, { slice: slice });
        exec(`yq w -i ${this.configPath} containerRegistry.external.certificate.kind secret`, { slice: slice });
        exec(`yq w -i ${this.configPath} containerRegistry.external.certificate.name ${this.imagePullSecretName}`, { slice: slice });
    }

    private configureDomain(slice: string) {
        exec(`yq w -i ${this.configPath} domain ${this.domain}`, { slice: slice });
    }

    private configureWorkspaces(slice: string) {
        exec(`yq w -i ${this.configPath} workspace.runtime.containerdRuntimeDir ${CONTAINERD_RUNTIME_DIR}`, { slice: slice });
        exec(`yq w -i ${this.configPath} workspace.resources.requests.cpu "100m"`, { slice: slice });
    }

    private configureObservability(slice: string) {
        const tracingEndpoint = exec(`yq r ./.werft/jobs/build/helm/values.tracing.yaml tracing.endpoint`, { slice: slice }).stdout.trim();
        exec(`yq w -i ${this.configPath} observability.tracing.endpoint ${tracingEndpoint}`, { slice: slice });
    }

    // auth-provider-secret.yml is a file generated by this job by reading a secret from core-dev cluster
    // 'preview-envs-authproviders' for previews running in core-dev and
    // 'preview-envs-authproviders-harvester' for previews running in Harvester VMs.
    // To understand how it is generated, search for 'auth-provider-secret.yml' in the code.
    private configureAuthProviders(slice: string) {
        exec(`for row in $(cat auth-provider-secret.yml \
        | base64 -d -w 0 \
        | yq r - authProviders -j \
        | jq -r 'to_entries | .[] | @base64'); do
            key=$(echo $row | base64 -d | jq -r '.key')
            providerId=$(echo $row | base64 -d | jq -r '.value.id | ascii_downcase')
            data=$(echo $row | base64 -d | yq r - value --prettyPrint)

            yq w -i ${this.configPath} authProviders[$key].kind "secret"
            yq w -i ${this.configPath} authProviders[$key].name "$providerId"

            kubectl create secret generic "$providerId" \
                --namespace "${this.deploymentNamespace}" \
                --from-literal=provider="$data" \
                --dry-run=client -o yaml | \
                kubectl replace --force -f -
        done`, { slice: slice })
    }

    private configureSSHGateway(slice: string) {
        exec(`cat /workspace/host-key.yaml \
                | yq w - metadata.namespace ${this.deploymentNamespace} \
                | yq d - metadata.uid \
                | yq d - metadata.resourceVersion \
                | yq d - metadata.creationTimestamp \
                | kubectl apply -f -`, { slice: slice })
        exec(`yq w -i ${this.configPath} sshGatewayHostKey.kind "secret"`)
        exec(`yq w -i ${this.configPath} sshGatewayHostKey.name "host-key"`)
    }

    private includeAnalytics(slice: string): void {
        exec(`yq w -i ${this.configPath} analytics.writer segment`, { slice: slice });
        exec(`yq w -i ${this.configPath} analytics.segmentKey ${this.analytics.token}`, { slice: slice });
    }

    private dontIncludeAnalytics(slice: string): void {
        exec(`yq w -i ${this.configPath} analytics.writer ""`, { slice: slice });
    }

    validateConfiguration(slice: string): void {
        this.werft.log(slice, "Validating configuration");
        exec(`/tmp/installer validate config -c ${this.configPath}`, { slice: slice });
        exec(`/tmp/installer validate cluster -c ${this.configPath} || true`, { slice: slice });
        this.werft.done(slice)
    }

    render(slice: string): void {
        this.werft.log(slice, "Rendering YAML manifests");
        exec(`/tmp/installer render --namespace ${this.deploymentNamespace} --config ${this.configPath} > k8s.yaml`, { slice: slice });
        this.werft.done(slice)
    }

    postProcessing(slice: string): void {
        this.werft.log(slice, "Post processing YAML manfests");

        this.configureLicense(slice)
        this.configureWorkspaceFeatureFlags(slice)
        this.process(slice)

        this.werft.done(slice)
    }

    private configureLicense(slice: string): void {
        if (this.withEELicense) {
            // Previews in core-dev and harvester use different domain, which requires different licenses.
            exec(`cp /mnt/secrets/gpsh-${this.withVM ? 'harvester' : 'coredev'}/license /tmp/license`, { slice: slice });
            // post-process.sh looks for /tmp/license, and if it exists, adds it to the configmap
        } else {
            exec(`touch /tmp/license`, { slice: slice });
        }
    }


    private configureWorkspaceFeatureFlags(slice: string): void {
        exec(`touch /tmp/defaultFeatureFlags`, { slice: slice });
        if (this.workspaceFeatureFlags && this.workspaceFeatureFlags.length > 0) {
            this.workspaceFeatureFlags.forEach(featureFlag => {
                exec(`echo \'"${featureFlag}"\' >> /tmp/defaultFeatureFlags`, { slice: slice });
            })
            // post-process.sh looks for /tmp/defaultFeatureFlags
            // each "flag" string gets added to the configmap
        }
    }

    private process(slice: string): void {
        const nodepoolIndex = getNodePoolIndex(this.deploymentNamespace);
        const flags = this.withVM ? "WITH_VM=true " : ""

        exec(`${flags}./.werft/jobs/build/installer/post-process.sh ${this.gitpodDaemonsetPorts.registryFacade} ${this.gitpodDaemonsetPorts.wsDaemon} ${nodepoolIndex} ${this.previewName}`, { slice: slice });
    }

    install(slice: string): void {
        this.werft.log(slice, "Installing Gitpod");
        exec(`kubectl delete -n ${this.deploymentNamespace} job migrations || true`, { silent: true });
        // errors could result in outputing a secret to the werft log when kubernetes patches existing objects...
        exec(`kubectl apply -f k8s.yaml`, { silent: true });

        exec(`werft log result -d "dev installation" -c github-check-preview-env url https://${this.domain}/workspaces`);
        this.werft.done(slice)
    }

}