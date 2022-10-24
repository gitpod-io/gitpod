import * as fs from "fs";
import { exec } from "../../../util/shell";
import { Werft } from "../../../util/werft";
import { getNodePoolIndex } from "../deploy-to-preview-environment";
import { renderPayment } from "../payment/render";
import { CORE_DEV_KUBECONFIG_PATH } from "../const";

const BLOCK_NEW_USER_CONFIG_PATH = "./blockNewUsers";
const PROJECT_NAME = "gitpod-core-dev";
const CONTAINER_REGISTRY_URL = `eu.gcr.io/${PROJECT_NAME}/build/`;
const CONTAINERD_RUNTIME_DIR = "/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io";

export type Analytics = {
    type: string;
    token: string;
};

export type GitpodDaemonsetPorts = {
    registryFacade: number;
    wsDaemon: number;
};

export type InstallerOptions = {
    werft: Werft;
    installerConfigPath: string;
    kubeconfigPath: string;
    version: string;
    proxySecretName: string;
    domain: string;
    previewName: string;
    imagePullSecretName: string;
    deploymentNamespace: string;
    analytics?: Analytics;
    withEELicense: boolean;
    workspaceFeatureFlags: string[];
    gitpodDaemonsetPorts: GitpodDaemonsetPorts;
    smithToken: string;
};

export class Installer {
    options: InstallerOptions;

    constructor(options: InstallerOptions) {
        this.options = options;
    }

    init(slice: string): void {
        this.options.werft.log(slice, "Downloading installer and initializing config file");
        exec(
            `docker run --entrypoint sh --rm eu.gcr.io/gitpod-core-dev/build/installer:${this.options.version} -c "cat /app/installer" > /tmp/installer`,
            { slice: slice },
        );
        exec(`chmod +x /tmp/installer`, { slice: slice });
        exec(`/tmp/installer config init --overwrite --config ${this.options.installerConfigPath}`, { slice: slice });
        this.options.werft.done(slice);
    }

    addPreviewConfiguration(slice: string): void {
        this.options.werft.log(slice, "Adding extra configuration");
        try {
            this.getDevCustomValues(slice);
            this.configureMetadata(slice);
            this.configureContainerRegistry(slice);
            this.configureDomain(slice);
            this.configureWorkspaces(slice);
            this.configureObjectStorage(slice);
            this.configureIDE(slice);
            this.configureObservability(slice);
            this.configureAuthProviders(slice);
            this.configureStripeAPIKeys(slice);
            this.configureSSHGateway(slice);
            this.configurePublicAPIServer(slice);
            this.configureUsage(slice);
            this.configureConfigCat(slice);

            this.configureDefaultTemplate(slice);

            if (this.options.analytics) {
                this.includeAnalytics(slice);
            } else {
                this.dontIncludeAnalytics(slice);
            }

            // let installer know that there is a chargbee config
            exec(
                `yq w -i ${this.options.installerConfigPath} experimental.webapp.server.chargebeeSecret chargebee-config`,
                { slice: slice },
            );

            // let installer know that there is a stripe config
            exec(
                `yq w -i ${this.options.installerConfigPath} experimental.webapp.server.stripeSecret stripe-api-keys`,
                { slice: slice },
            );
            exec(
                `yq w -i ${this.options.installerConfigPath} experimental.webapp.server.stripeConfig stripe-config`,
                { slice: slice },
            );
        } catch (err) {
            throw new Error(err);
        }
        this.options.werft.done(slice);
    }
    configureDefaultTemplate(slice: string): void {
        exec(`yq w -i ${this.options.installerConfigPath} 'workspace.templates.default.spec.containers[+].name' workspace`);
        exec(`yq w -i ${this.options.installerConfigPath} 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' GITPOD_PREVENT_METADATA_ACCESS`);
        exec(`yq w -i ${this.options.installerConfigPath} 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_PREVENT_METADATA_ACCESS).value' "true"`);
    }

    private getDevCustomValues(slice: string): void {
        exec(
            `yq r ./.werft/jobs/build/helm/values.dev.yaml components.server.blockNewUsers | yq prefix - 'blockNewUsers' > ${BLOCK_NEW_USER_CONFIG_PATH}`,
            { slice: slice },
        );

        exec(`yq m -i --overwrite ${this.options.installerConfigPath} ${BLOCK_NEW_USER_CONFIG_PATH}`, { slice: slice });
    }

    private configureMetadata(slice: string): void {
        exec(`cat <<EOF > shortname.yaml
metadata:
  shortname: "dev"
EOF`);
        exec(`yq m -ix ${this.options.installerConfigPath} shortname.yaml`, { slice: slice });
    }

    private configureContainerRegistry(slice: string): void {
        exec(`yq w -i ${this.options.installerConfigPath} certificate.name ${this.options.proxySecretName}`, {
            slice: slice,
        });
        exec(`yq w -i ${this.options.installerConfigPath} containerRegistry.inCluster false`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} containerRegistry.external.url ${CONTAINER_REGISTRY_URL}`, {
            slice: slice,
        });
        exec(`yq w -i ${this.options.installerConfigPath} containerRegistry.external.certificate.kind secret`, {
            slice: slice,
        });
        exec(
            `yq w -i ${this.options.installerConfigPath} containerRegistry.external.certificate.name ${this.options.imagePullSecretName}`,
            { slice: slice },
        );
    }

    private configureDomain(slice: string) {
        exec(`yq w -i ${this.options.installerConfigPath} domain ${this.options.domain}`, { slice: slice });
    }

    private configureWorkspaces(slice: string) {
        exec(
            `yq w -i ${this.options.installerConfigPath} workspace.runtime.containerdRuntimeDir ${CONTAINERD_RUNTIME_DIR}`,
            { slice: slice },
        );
        exec(`yq w -i ${this.options.installerConfigPath} workspace.resources.requests.cpu "100m"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} workspace.resources.requests.memory "256Mi"`, {
            slice: slice,
        });

        // create two workspace classes (default and small) in server-config configmap
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[+].id "default"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[0].category "GENERAL PURPOSE"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[0].displayName "Default"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[0].description "Default workspace class (30GB disk)"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[0].powerups 1`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[0].isDefault true`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[0].deprecated false`, { slice: slice });

        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[+].id "small"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[1].category "GENERAL PURPOSE"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[1].displayName "Small"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[1].description "Small workspace class (20GB disk)"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[1].powerups 2`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[1].isDefault false`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[1].deprecated false`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.workspaceClasses[1].marker.moreResources true`, { slice: slice });

        // create two workspace classes (default and small) in ws-manager configmap
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["default"].name "default"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["default"].resources.requests.cpu 100m`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["default"].resources.requests.memory 128Mi`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["default"].pvc.size 30Gi`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["default"].pvc.storageClass rook-ceph-block`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["default"].pvc.snapshotClass csi-rbdplugin-snapclass`, { slice: slice });

        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["small"].name "small"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["small"].resources.requests.cpu 100m`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["small"].resources.requests.memory 128Mi`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["small"].pvc.size 20Gi`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["small"].pvc.storageClass rook-ceph-block`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.workspace.classes["small"].pvc.snapshotClass csi-rbdplugin-snapclass`, { slice: slice });
    }

    private configureObjectStorage(slice: string) {
        exec(`yq w -i ${this.options.installerConfigPath} objectStorage.resources.requests.memory "256Mi"`, {
            slice: slice,
        });
    }

    private configureIDE(slice: string) {
        exec(`yq w -i ${this.options.installerConfigPath} experimental.ide.resolveLatest false`, { slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.ide.ideMetrics.enabledErrorReporting true`, { slice });
    }

    private configureObservability(slice: string) {
        const tracingEndpoint = exec(`yq r ./.werft/jobs/build/helm/values.tracing.yaml tracing.endpoint`, {
            slice: slice,
        }).stdout.trim();
        exec(`yq w -i ${this.options.installerConfigPath} observability.tracing.endpoint ${tracingEndpoint}`, {
            slice: slice,
        });
    }

    // auth-provider-secret.yml is a file generated by this job by reading a secret from core-dev cluster
    // 'preview-envs-authproviders' for previews running in core-dev and
    // 'preview-envs-authproviders-harvester' for previews running in Harvester VMs.
    // To understand how it is generated, search for 'auth-provider-secret.yml' in the code.
    private configureAuthProviders(slice: string) {
        exec(
            `for row in $(cat auth-provider-secret.yml \
        | base64 -d -w 0 \
        | yq r - authProviders -j \
        | jq -r 'to_entries | .[] | @base64'); do
            key=$(echo $row | base64 -d | jq -r '.key')
            providerId=$(echo $row | base64 -d | jq -r '.value.id | ascii_downcase')
            data=$(echo $row | base64 -d | yq r - value --prettyPrint)

            yq w -i ${this.options.installerConfigPath} authProviders[$key].kind "secret"
            yq w -i ${this.options.installerConfigPath} authProviders[$key].name "$providerId"

            kubectl create secret generic "$providerId" \
                --namespace "${this.options.deploymentNamespace}" \
                --kubeconfig "${this.options.kubeconfigPath}" \
                --from-literal=provider="$data" \
                --dry-run=client -o yaml | \
                kubectl --kubeconfig "${this.options.kubeconfigPath}" replace --force -f -
        done`,
            { slice: slice },
        );
    }

    private configureStripeAPIKeys(slice: string) {
        exec(
            `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n werft get secret stripe-api-keys -o yaml > stripe-api-keys.secret.yaml`,
            { slice },
        );
        exec(`yq w -i stripe-api-keys.secret.yaml metadata.namespace "default"`, { slice });
        exec(`yq d -i stripe-api-keys.secret.yaml metadata.creationTimestamp`, { slice });
        exec(`yq d -i stripe-api-keys.secret.yaml metadata.uid`, { slice });
        exec(`yq d -i stripe-api-keys.secret.yaml metadata.resourceVersion`, { slice });
        exec(`kubectl --kubeconfig "${this.options.kubeconfigPath}" apply -f stripe-api-keys.secret.yaml`, { slice });
        exec(`rm -f stripe-api-keys.secret.yaml`, { slice });
    }

    private configureSSHGateway(slice: string) {
        exec(
            `cat /workspace/host-key.yaml \
                | yq w - metadata.namespace ${this.options.deploymentNamespace} \
                | yq d - metadata.uid \
                | yq d - metadata.resourceVersion \
                | yq d - metadata.creationTimestamp \
                | kubectl --kubeconfig ${this.options.kubeconfigPath} apply -f -`,
            { slice: slice },
        );
        exec(`yq w -i ${this.options.installerConfigPath} sshGatewayHostKey.kind "secret"`);
        exec(`yq w -i ${this.options.installerConfigPath} sshGatewayHostKey.name "host-key"`);
    }

    private configurePublicAPIServer(slice: string) {
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.publicApi.enabled true`, { slice: slice });
    }

    private configureUsage(slice: string) {
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.usage.enabled true`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.usage.schedule 1m`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.usage.billInstancesAfter "2022-08-11T08:05:32.499Z"`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.usage.defaultSpendingLimit.forUsers 500`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.usage.defaultSpendingLimit.forTeams 0`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.usage.defaultSpendingLimit.minForUsersOnStripe 1000`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.usage.creditsPerMinuteByWorkspaceClass['default'] 0.1666666667`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.usage.creditsPerMinuteByWorkspaceClass['gitpodio-internal-xl'] 0.3333333333`, { slice: slice })

        // Configure Price IDs
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.stripe.individualUsagePriceIds['EUR'] price_1LmYVxGadRXm50o3AiLq0Qmo`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.stripe.individualUsagePriceIds['USD'] price_1LmYWRGadRXm50o3Ym8PLqnG`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.stripe.teamUsagePriceIds['EUR'] price_1LiId7GadRXm50o3OayAS2y4`, { slice: slice })
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.stripe.teamUsagePriceIds['USD'] price_1LiIdbGadRXm50o3ylg5S44r`, { slice: slice })
    }

    private configureConfigCat(slice: string) {
        // This key is not a secret, it is a unique identifier of our ConfigCat application
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.configcatKey "WBLaCPtkjkqKHlHedziE9g/LEAOCNkbuUKiqUZAcVg7dw"`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.proxy.configcat.baseUrl "https://cdn-global.configcat.com"`,{ slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} experimental.webapp.proxy.configcat.pollInterval "1m"`,{ slice: slice });
    }

    private includeAnalytics(slice: string): void {
        exec(`yq w -i ${this.options.installerConfigPath} analytics.writer segment`, { slice: slice });
        exec(`yq w -i ${this.options.installerConfigPath} analytics.segmentKey ${this.options.analytics.token}`, {
            slice: slice,
        });
        exec(`yq w -i ${this.options.installerConfigPath} 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' GITPOD_ANALYTICS_WRITER`);
        exec(`yq w -i ${this.options.installerConfigPath} 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_WRITER).value' "segment"`);
        exec(`yq w -i ${this.options.installerConfigPath} 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' GITPOD_ANALYTICS_SEGMENT_KEY`);
        exec(`yq w -i ${this.options.installerConfigPath} 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_SEGMENT_KEY).value' "${this.options.analytics.token}"`);
    }

    private dontIncludeAnalytics(slice: string): void {
        exec(`yq w -i ${this.options.installerConfigPath} analytics.writer ""`, { slice: slice });
    }

    validateConfiguration(slice: string): void {
        this.options.werft.log(slice, "Validating configuration");
        exec(`/tmp/installer validate config -c ${this.options.installerConfigPath}`, { slice: slice });
        exec(
            `/tmp/installer validate cluster --kubeconfig ${this.options.kubeconfigPath} -c ${this.options.installerConfigPath} || true`,
            { slice: slice },
        );
        this.options.werft.done(slice);
    }

    render(slice: string): void {
        this.options.werft.log(slice, "Rendering YAML manifests");
        exec(
            `/tmp/installer render --use-experimental-config --namespace ${this.options.deploymentNamespace} --config ${this.options.installerConfigPath} > k8s.yaml`,
            { slice: slice },
        );
        this.options.werft.done(slice);
    }

    postProcessing(slice: string): void {
        this.options.werft.log(slice, "Post processing YAML manifests");

        this.configureLicense(slice);
        this.configureWorkspaceFeatureFlags(slice);
        this.configurePayment(slice);
        this.process(slice);

        this.options.werft.done(slice);
    }

    private configureLicense(slice: string): void {
        if (this.options.withEELicense) {
            // Previews in core-dev and harvester use different domain, which requires different licenses.
            exec(`cp /mnt/secrets/gpsh-harvester/license /tmp/license`, { slice: slice });
            // post-process.sh looks for /tmp/license, and if it exists, adds it to the configmap
        } else {
            exec(`touch /tmp/license`, { slice: slice });
        }
    }

    private configureWorkspaceFeatureFlags(slice: string): void {
        exec(`touch /tmp/defaultFeatureFlags`, { slice: slice });
        if (this.options.workspaceFeatureFlags && this.options.workspaceFeatureFlags.length > 0) {
            this.options.workspaceFeatureFlags.forEach((featureFlag) => {
                exec(`echo \'"${featureFlag}"\' >> /tmp/defaultFeatureFlags`, { slice: slice });
            });
            // post-process.sh looks for /tmp/defaultFeatureFlags
            // each "flag" string gets added to the configmap
            // also watches aout for /tmp/payment
        }
    }

    private configurePayment(slice: string): void {
        // 1. Read versions from docker image
        this.options.werft.log(slice, "configuring withPayment...");
        try {
            exec(
                `docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${this.options.version} cat /versions.yaml > versions.yaml`,
            );
        } catch (err) {
            this.options.werft.fail(slice, err);
        }
        const serviceWaiterVersion = exec("yq r ./versions.yaml 'components.serviceWaiter.version'")
            .stdout.toString()
            .trim();
        const paymentEndpointVersion = exec("yq r ./versions.yaml 'components.paymentEndpoint.version'")
            .stdout.toString()
            .trim();

        // 2. render chargebee-config and payment-endpoint
        const paymentYamls = renderPayment(
            this.options.deploymentNamespace,
            paymentEndpointVersion,
            serviceWaiterVersion,
        );
        fs.writeFileSync("/tmp/payment", paymentYamls);

        this.options.werft.log(slice, "done configuring withPayment.");
    }

    private process(slice: string): void {
        const nodepoolIndex = getNodePoolIndex(this.options.deploymentNamespace);
        const flags = "WITH_VM=true ";

        exec(
            `${flags}./.werft/jobs/build/installer/post-process.sh ${this.options.gitpodDaemonsetPorts.registryFacade} ${this.options.gitpodDaemonsetPorts.wsDaemon} ${nodepoolIndex} ${this.options.previewName} ${this.options.smithToken}`,
            { slice: slice },
        );
    }

    install(slice: string): void {
        this.options.werft.log(slice, "Installing Gitpod");
        exec(
            `kubectl --kubeconfig ${this.options.kubeconfigPath} delete -n ${this.options.deploymentNamespace} job migrations || true`,
            { silent: true },
        );
        // errors could result in outputing a secret to the werft log when kubernetes patches existing objects...
        exec(`kubectl --kubeconfig ${this.options.kubeconfigPath} apply -f k8s.yaml`, { silent: true });

        exec(
            `werft log result -d "dev installation" -c github-check-preview-env url https://${this.options.domain}/workspaces`,
        );
        this.options.werft.done(slice);
    }
}
