import { createHash, randomBytes } from "crypto";
import * as shell from 'shelljs';
import * as fs from 'fs';
import { exec, ExecOptions } from '../../util/shell';
import { MonitoringSatelliteInstaller } from '../../observability/monitoring-satellite';
import { wipeAndRecreateNamespace, setKubectlContextNamespace, deleteNonNamespaceObjects, findFreeHostPorts, createNamespace, helmInstallName, findLastHostPort, waitUntilAllPodsAreReady, waitForApiserver } from '../../util/kubectl';
import { issueCertificate, installCertificate, IssueCertificateParams, InstallCertificateParams } from '../../util/certs';
import { sleep, env } from '../../util/util';
import { CORE_DEV_KUBECONFIG_PATH, GCLOUD_SERVICE_ACCOUNT_PATH, PREVIEW_K3S_KUBECONFIG_PATH } from "./const";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";
import * as VM from '../../vm/vm'
import { Analytics, Installer } from "./installer/installer";
import { previewNameFromBranchName } from "../../util/preview";
import { createDNSRecord } from "../../util/gcloud";
import { SpanStatusCode } from '@opentelemetry/api';

// used by both deploys (helm and Installer)
const PROXY_SECRET_NAME = "proxy-config-certificates";
const IMAGE_PULL_SECRET_NAME = "gcp-sa-registry-auth";
const STACKDRIVER_SERVICEACCOUNT = JSON.parse(fs.readFileSync(`/mnt/secrets/monitoring-satellite-stackdriver-credentials/credentials.json`, 'utf8'));

const phases = {
    PREDEPLOY: 'predeploy',
    DEPLOY: 'deploy',
    VM: 'Ensure VM Readiness'
}

// Werft slices for deploy phase via installer
const installerSlices = {
    FIND_FREE_HOST_PORTS: "find free ports",
    IMAGE_PULL_SECRET: "image pull secret",
    COPY_CERTIFICATES: "Copying certificates",
    CLEAN_ENV_STATE: "clean envirionment",
    SET_CONTEXT: "set namespace",
    INSTALLER_INIT: "installer init",
    PREVIEW_CONFIG: "Adding preview-specific configuration",
    VALIDATE_CONFIG: "Validating configuration",
    INSTALLER_RENDER: "installer render",
    INSTALLER_POST_PROCESSING: "installer post processing",
    APPLY_INSTALL_MANIFESTS: "installer apply",
    DEPLOYMENT_WAITING: "monitor server deployment",
    DNS_ADD_RECORD: "add dns record"
}

const vmSlices = {
    VM_READINESS: 'Waiting for VM readiness',
    START_KUBECTL_PORT_FORWARDS: 'Start kubectl port forwards',
    COPY_CERT_MANAGER_RESOURCES: 'Copy CertManager resources from core-dev',
    INSTALL_LETS_ENCRYPT_ISSUER: 'Install Lets Encrypt issuer',
    KUBECONFIG: 'Getting kubeconfig',
    WAIT_K3S: 'Waiting for k3s',
    WAIT_CERTMANAGER: 'Waiting for Cert-Manager',
    EXTERNAL_LOGGING: 'Install credentials to send logs from fluent-bit to GCP'
}

export async function deployToPreviewEnvironment(werft: Werft, jobConfig: JobConfig) {
    const {
        version,
        withVM,
        analytics,
        cleanSlateDeployment,
        withPayment,
        withObservability,
        installEELicense,
        workspaceFeatureFlags,
        dynamicCPULimits,
        storage
    } = jobConfig;

    const {
        destname,
        namespace
    } = jobConfig.previewEnvironment



    const domain = withVM ? `${destname}.preview.gitpod-dev.com` : `${destname}.staging.gitpod-dev.com`;
    const monitoringDomain = `${destname}.preview.gitpod-dev.com`;
    const url = `https://${domain}`;
    const imagePullAuth = exec(`printf "%s" "_json_key:$(kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get secret ${IMAGE_PULL_SECRET_NAME} --namespace=keys -o yaml \
        | yq r - data['.dockerconfigjson'] \
        | base64 -d)" | base64 -w 0`, { silent: true }).stdout.trim();

    const deploymentConfig: DeploymentConfig = {
        version,
        destname,
        namespace,
        domain,
        monitoringDomain,
        url,
        analytics,
        cleanSlateDeployment,
        installEELicense,
        imagePullAuth,
        withPayment,
        withObservability,
        withVM,
    };

    exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} --namespace keys get secret host-key -o yaml > /workspace/host-key.yaml`)

    // Writing auth-provider configuration to disk prior to deploying anything.
    // We do this because we have different auth-providers depending if we're using core-dev or Harvester VMs.
    exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get secret ${withVM ? 'preview-envs-authproviders-harvester' : 'preview-envs-authproviders'} --namespace=keys -o jsonpath="{.data.authProviders}" > auth-provider-secret.yml`, { silent: true })

    if (withVM) {
        // We set it to false as default and only set it to true once the k3s cluster is ready.
        // We only set the attribute for jobs where a VM is expected.
        werft.rootSpan.setAttributes({'preview.k3s_successfully_created': false})

        werft.phase(phases.VM, "Ensuring VM is ready for deployment");

        werft.log(vmSlices.VM_READINESS, 'Wait for VM readiness')
        VM.waitForVMReadiness({ name: destname, timeoutSeconds: 60 * 10, slice: vmSlices.VM_READINESS })
        werft.done(vmSlices.VM_READINESS)

        werft.log(vmSlices.START_KUBECTL_PORT_FORWARDS, 'Starting SSH port forwarding')
        VM.startSSHProxy({ name: destname, slice: vmSlices.START_KUBECTL_PORT_FORWARDS })
        werft.done(vmSlices.START_KUBECTL_PORT_FORWARDS)

        werft.log(vmSlices.KUBECONFIG, 'Copying k3s kubeconfig')
        VM.copyk3sKubeconfig({ name: destname, timeoutMS: 1000 * 60 * 3, slice: vmSlices.KUBECONFIG })
        werft.done(vmSlices.KUBECONFIG)

        werft.log(vmSlices.WAIT_K3S, 'Wait for k3s')
        await waitForApiserver(PREVIEW_K3S_KUBECONFIG_PATH, { slice: vmSlices.WAIT_K3S })
        await waitUntilAllPodsAreReady("kube-system", PREVIEW_K3S_KUBECONFIG_PATH, { slice: vmSlices.WAIT_K3S })
        werft.rootSpan.setAttributes({'preview.k3s_successfully_created': true})
        werft.done(vmSlices.WAIT_K3S)

        werft.log(vmSlices.WAIT_CERTMANAGER, 'Wait for Cert-Manager')
        await waitUntilAllPodsAreReady("cert-manager", PREVIEW_K3S_KUBECONFIG_PATH, { slice: vmSlices.WAIT_CERTMANAGER })
        werft.done(vmSlices.WAIT_CERTMANAGER)

        exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get secret clouddns-dns01-solver-svc-acct -n certmanager -o yaml | sed 's/namespace: certmanager/namespace: cert-manager/g' > clouddns-dns01-solver-svc-acct.yaml`, { slice: vmSlices.INSTALL_LETS_ENCRYPT_ISSUER })
        exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get clusterissuer letsencrypt-issuer-gitpod-core-dev -o yaml | sed 's/letsencrypt-issuer-gitpod-core-dev/letsencrypt-issuer/g' > letsencrypt-issuer.yaml`, { slice: vmSlices.INSTALL_LETS_ENCRYPT_ISSUER })
        exec(`kubectl --kubeconfig ${PREVIEW_K3S_KUBECONFIG_PATH} apply -f clouddns-dns01-solver-svc-acct.yaml -f letsencrypt-issuer.yaml`, { slice: vmSlices.INSTALL_LETS_ENCRYPT_ISSUER, dontCheckRc: true })
        werft.done(vmSlices.INSTALL_LETS_ENCRYPT_ISSUER)

        VM.installRookCeph({ kubeconfig: PREVIEW_K3S_KUBECONFIG_PATH })
        VM.installFluentBit({ namespace: 'default', kubeconfig: PREVIEW_K3S_KUBECONFIG_PATH, slice: vmSlices.EXTERNAL_LOGGING })
        werft.done(vmSlices.EXTERNAL_LOGGING)

        try {
            werft.log(vmSlices.COPY_CERT_MANAGER_RESOURCES, 'Copy over CertManager resources from core-dev')
            await installMetaCertificates(werft, jobConfig.repository.branch, withVM, 'default', PREVIEW_K3S_KUBECONFIG_PATH, vmSlices.COPY_CERT_MANAGER_RESOURCES)
            werft.done(vmSlices.COPY_CERT_MANAGER_RESOURCES)
        } catch (err) {
            werft.fail(vmSlices.COPY_CERT_MANAGER_RESOURCES, err);
        }

        // Deploying monitoring satellite to VM-based preview environments is currently best-effort.
        // That means we currently don't wait for the promise here, and should the installation fail
        // we'll simply log an error rather than failing the build.
        //
        // Note: Werft currently doesn't support slices spanning across multiple phases so running this
        // can result in many 'observability' slices. Currently we close all the spans in a phase
        // when we complete a phase. This means we can't currently measure the full duration or the
        // success rate or installing monitoring satellite, but we can at least count and debug errors.
        // In the future we can consider not closing spans when closing phases, or restructuring our phases
        // based on parallelism boundaries
        const monitoringSatelliteInstaller = new MonitoringSatelliteInstaller({
            kubeconfigPath: PREVIEW_K3S_KUBECONFIG_PATH,
            branch: jobConfig.observability.branch,
            satelliteNamespace: deploymentConfig.namespace,
            clusterName: deploymentConfig.namespace,
            nodeExporterPort: 9100,
            previewDomain: deploymentConfig.domain,
            previewName: previewNameFromBranchName(jobConfig.repository.branch),
            stackdriverServiceAccount: STACKDRIVER_SERVICEACCOUNT,
            withVM: withVM,
            werft: werft
        });
        const sliceID = "observability"
        monitoringSatelliteInstaller.install()
            .then(() => {
                werft.log(sliceID, "Succeeded installing monitoring satellite")
            })
            .catch((err) => {
                werft.log(sliceID, `Failed to install monitoring: ${err}`)
                const span = werft.getSpanForSlice(sliceID)
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: err
                })
            })
            .finally(() => werft.done(sliceID));
    }

    werft.phase(phases.DEPLOY, "deploying to dev with Installer");
    await deployToDevWithInstaller(werft, jobConfig, deploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage);
}

/*
* Deploy a preview environment using the Installer
*/
async function deployToDevWithInstaller(werft: Werft, jobConfig: JobConfig, deploymentConfig: DeploymentConfig, workspaceFeatureFlags: string[], dynamicCPULimits, storage) {
    // to test this function, change files in your workspace, sideload (-s) changed files into werft or set annotations (-a) like so:
    // werft run github -f -j ./.werft/build.yaml -s ./.werft/build.ts -s ./.werft/jobs/build/installer/post-process.sh -a with-clean-slate-deployment=true
    const { version, destname, namespace, domain, monitoringDomain, url, withObservability, withVM } = deploymentConfig;
    const deploymentKubeconfig = withVM ? PREVIEW_K3S_KUBECONFIG_PATH : CORE_DEV_KUBECONFIG_PATH;

    // find free ports
    werft.log(installerSlices.FIND_FREE_HOST_PORTS, "Find last ports");
    let wsdaemonPortMeta = findLastHostPort(namespace, 'ws-daemon', deploymentKubeconfig, metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }))
    let registryNodePortMeta = findLastHostPort(namespace, 'registry-facade', deploymentKubeconfig, metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }))
    let nodeExporterPort = findLastHostPort(namespace, 'node-exporter', deploymentKubeconfig, metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }))

    if (isNaN(wsdaemonPortMeta) || isNaN(wsdaemonPortMeta) || (isNaN(nodeExporterPort) && !withVM && withObservability)) {
        werft.log(installerSlices.FIND_FREE_HOST_PORTS, "Can't reuse, check for some free ports.");
        [wsdaemonPortMeta, registryNodePortMeta, nodeExporterPort] = await findFreeHostPorts([
            { start: 10000, end: 11000 },
            { start: 30000, end: 31000 },
            { start: 31001, end: 32000 },
        ], deploymentKubeconfig, metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }));
    }
    werft.log(installerSlices.FIND_FREE_HOST_PORTS,
        `wsdaemonPortMeta: ${wsdaemonPortMeta}, registryNodePortMeta: ${registryNodePortMeta}.`);
    werft.done(installerSlices.FIND_FREE_HOST_PORTS);

    // clean environment state
    try {
        if (deploymentConfig.cleanSlateDeployment && !withVM) {
            werft.log(installerSlices.CLEAN_ENV_STATE, "Clean the preview environment slate...");
            // re-create namespace
            await cleanStateEnv(deploymentKubeconfig, metaEnv());

        } else {
            werft.log(installerSlices.CLEAN_ENV_STATE, "Clean the preview environment slate...");
            createNamespace(namespace, deploymentKubeconfig, metaEnv({ slice: installerSlices.CLEAN_ENV_STATE }));
        }
        werft.done(installerSlices.CLEAN_ENV_STATE);
    } catch (err) {
        werft.fail(installerSlices.CLEAN_ENV_STATE, err);
    }

    if (!withVM) {
        // in a VM, the secrets have already been copied
        // If using core-dev, we want to execute further kubectl operations only in the created namespace
        setKubectlContextNamespace(namespace, metaEnv({ slice: installerSlices.SET_CONTEXT }));
        werft.done(installerSlices.SET_CONTEXT)
        try {
            werft.log(installerSlices.COPY_CERTIFICATES, "Copying cached certificate from 'certs' namespace");
            await installMetaCertificates(werft, jobConfig.repository.branch, jobConfig.withVM, namespace, CORE_DEV_KUBECONFIG_PATH, installerSlices.COPY_CERTIFICATES);
            werft.done(installerSlices.COPY_CERTIFICATES);
        } catch (err) {
            werft.fail(installerSlices.COPY_CERTIFICATES, err);
        }
    }

    // add the image pull secret to the namespcae if it doesn't exist
    const hasPullSecret = (exec(`kubectl --kubeconfig ${deploymentKubeconfig} get secret ${IMAGE_PULL_SECRET_NAME} -n ${namespace}`, { slice: installerSlices.IMAGE_PULL_SECRET, dontCheckRc: true, silent: true })).code === 0;
    if (!hasPullSecret) {
        try {
            werft.log(installerSlices.IMAGE_PULL_SECRET, "Adding the image pull secret to the namespace");
            const dockerConfig = { auths: { "eu.gcr.io": { auth: deploymentConfig.imagePullAuth }, "europe-docker.pkg.dev": { auth: deploymentConfig.imagePullAuth } } };
            fs.writeFileSync(`./${IMAGE_PULL_SECRET_NAME}`, JSON.stringify(dockerConfig));
            exec(`kubectl --kubeconfig ${deploymentKubeconfig} create secret docker-registry ${IMAGE_PULL_SECRET_NAME} -n ${namespace} --from-file=.dockerconfigjson=./${IMAGE_PULL_SECRET_NAME}`, { slice: installerSlices.IMAGE_PULL_SECRET });
        }
        catch (err) {
            werft.fail(installerSlices.IMAGE_PULL_SECRET, err);
        }
    }
    werft.done(installerSlices.IMAGE_PULL_SECRET);

    let analytics: Analytics
    if ((deploymentConfig.analytics || "").startsWith("segment|")) {
        analytics = {
            type: "segment",
            token: deploymentConfig.analytics!.substring("segment|".length)
        }
    }

    const [token, tokenHash] = generateToken()

    const installer = new Installer({
        werft: werft,
        installerConfigPath: "config.yaml",
        kubeconfigPath: deploymentKubeconfig,
        version: version,
        proxySecretName: PROXY_SECRET_NAME,
        domain: deploymentConfig.domain,
        previewName: deploymentConfig.destname,
        imagePullSecretName: IMAGE_PULL_SECRET_NAME,
        deploymentNamespace: namespace,
        analytics: analytics,
        withEELicense: deploymentConfig.installEELicense,
        withVM: withVM,
        workspaceFeatureFlags: workspaceFeatureFlags,
        gitpodDaemonsetPorts: { registryFacade: registryNodePortMeta, wsDaemon: wsdaemonPortMeta },
        smithToken: token,
        withPayment: deploymentConfig.withPayment,
    })
    try {
        werft.log(phases.DEPLOY, "deploying using installer")
        installer.init(installerSlices.INSTALLER_INIT)
        installer.addPreviewConfiguration(installerSlices.PREVIEW_CONFIG)
        installer.validateConfiguration(installerSlices.VALIDATE_CONFIG)
        installer.render(installerSlices.INSTALLER_RENDER)
        installer.postProcessing(installerSlices.INSTALLER_POST_PROCESSING)
        installer.install(installerSlices.APPLY_INSTALL_MANIFESTS)
    } catch (err) {
        exec(`cat ${installer.options.installerConfigPath}`, { slice: phases.DEPLOY });
        werft.fail(phases.DEPLOY, err);
    }

    werft.log(installerSlices.DEPLOYMENT_WAITING, "Waiting until all pods are ready.");
    await waitUntilAllPodsAreReady(deploymentConfig.namespace, installer.options.kubeconfigPath, { slice: installerSlices.DEPLOYMENT_WAITING })
    werft.done(installerSlices.DEPLOYMENT_WAITING);

    if (!withVM) {
        await addDNSRecord(werft, deploymentConfig.namespace, deploymentConfig.domain, !withVM, installer.options.kubeconfigPath)
    } else {
        await addVMDNSRecord(werft, destname, domain)
    }
    addAgentSmithToken(werft, deploymentConfig.namespace, installer.options.kubeconfigPath, tokenHash)

    werft.done(phases.DEPLOY);

    async function cleanStateEnv(kubeconfig: string, shellOpts: ExecOptions) {
        await wipeAndRecreateNamespace(helmInstallName, namespace, kubeconfig, { ...shellOpts, slice: installerSlices.CLEAN_ENV_STATE });
        // cleanup non-namespace objects
        werft.log(installerSlices.CLEAN_ENV_STATE, "removing old unnamespaced objects - this might take a while");
        try {
            await deleteNonNamespaceObjects(namespace, destname, kubeconfig, { ...shellOpts, slice: installerSlices.CLEAN_ENV_STATE });
            werft.done(installerSlices.CLEAN_ENV_STATE);
        } catch (err) {
            werft.fail(installerSlices.CLEAN_ENV_STATE, err);
        }
    }
}

/*  A hash is caclulated from the branch name and a subset of that string is parsed to a number x,
    x mod the number of different nodepool-sets defined in the files listed in nodeAffinityValues
    is used to generate a pseudo-random number that consistent as long as the branchname persists.
    We use it to reduce the number of preview-environments accumulating on a singe nodepool.
*/
export function getNodePoolIndex(namespace: string): number {
    const nodeAffinityValues = getNodeAffinities();

    return parseInt(createHash('sha256').update(namespace).digest('hex').substring(0, 5), 16) % nodeAffinityValues.length;
}

function getNodeAffinities(): string[] {
    return [
        "values.nodeAffinities_1.yaml",
        "values.nodeAffinities_2.yaml",
        "values.nodeAffinities_0.yaml",
        "values.nodeAffinities_3.yaml",
        "values.nodeAffinities_4.yaml",
        "values.nodeAffinities_5.yaml",
    ]
}

interface DeploymentConfig {
    version: string;
    destname: string;
    namespace: string;
    domain: string;
    monitoringDomain: string,
    url: string;
    analytics?: string;
    cleanSlateDeployment: boolean;
    installEELicense: boolean;
    imagePullAuth: string;
    withPayment: boolean;
    withObservability: boolean;
    withVM: boolean;
}

async function addDNSRecord(werft: Werft, namespace: string, domain: string, isLoadbalancer: boolean, kubeconfigPath: string) {
    const coreDevIngressIP = getCoreDevIngressIP()
    let wsProxyLBIP = null
    if (isLoadbalancer === true) {
        werft.log(installerSlices.DNS_ADD_RECORD, "Getting ws-proxy loadbalancer IP");
        for (let i = 0; i < 60; i++) {
            try {
                let lb = exec(`kubectl --kubeconfig ${kubeconfigPath} -n ${namespace} get service ws-proxy -o=jsonpath='{.status.loadBalancer.ingress[0].ip}'`, { silent: true })
                if (lb.length > 4) {
                    wsProxyLBIP = lb.toString()
                    break
                }
                await sleep(1000)
            } catch (err) {
                await sleep(1000)
            }
        }
        if (wsProxyLBIP == null) {
            werft.fail(installerSlices.DNS_ADD_RECORD, new Error("Can't get ws-proxy loadbalancer IP"));
        }
        werft.log(installerSlices.DNS_ADD_RECORD, "Get ws-proxy loadbalancer IP: " + wsProxyLBIP);
    } else {
        wsProxyLBIP = coreDevIngressIP
    }

    await Promise.all([
        createDNSRecord({
            domain,
            projectId: "gitpod-core-dev",
            dnsZone: 'gitpod-dev-com',
            IP: coreDevIngressIP,
            slice: installerSlices.DNS_ADD_RECORD
        }),
        createDNSRecord({
            domain: `*.${domain}`,
            projectId: "gitpod-core-dev",
            dnsZone: 'gitpod-dev-com',
            IP: coreDevIngressIP,
            slice: installerSlices.DNS_ADD_RECORD
        }),
        createDNSRecord({
            domain: `*.ws-dev.${domain}`,
            projectId: "gitpod-core-dev",
            dnsZone: 'gitpod-dev-com',
            IP: wsProxyLBIP,
            slice: installerSlices.DNS_ADD_RECORD
        }),
    ])
    werft.done(installerSlices.DNS_ADD_RECORD);
}

async function addVMDNSRecord(werft: Werft, name: string, domain: string) {
    const ingressIP = getHarvesterIngressIP()
    let proxyLBIP = null
    werft.log(installerSlices.DNS_ADD_RECORD, "Getting loadbalancer IP");
    for (let i = 0; i < 60; i++) {
        try {
            let lb = exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n loadbalancers get service lb-${name} -o=jsonpath='{.status.loadBalancer.ingress[0].ip}'`, { silent: true })
            if (lb.length > 4) {
                proxyLBIP = lb.toString()
                break
            }
            await sleep(1000)
        } catch (err) {
            await sleep(1000)
        }
    }
    if (proxyLBIP == null) {
        werft.fail(installerSlices.DNS_ADD_RECORD, new Error("Can't get loadbalancer IP"));
    }
    werft.log(installerSlices.DNS_ADD_RECORD, "Get loadbalancer IP: " + proxyLBIP);

    await Promise.all([
        createDNSRecord({
            domain: domain,
            projectId: "gitpod-core-dev",
            dnsZone: 'preview-gitpod-dev-com',
            IP: ingressIP,
            slice: installerSlices.DNS_ADD_RECORD
        }),
        createDNSRecord({
            domain: `*.${domain}`,
            projectId: "gitpod-core-dev",
            dnsZone: 'preview-gitpod-dev-com',
            IP: ingressIP,
            slice: installerSlices.DNS_ADD_RECORD
        }),
        createDNSRecord({
            domain: `*.ws.${domain}`,
            projectId: "gitpod-core-dev",
            dnsZone: 'preview-gitpod-dev-com',
            IP: ingressIP,
            slice: installerSlices.DNS_ADD_RECORD
        }),
        createDNSRecord({
            domain: `*.ssh.ws.${domain}`,
            projectId: "gitpod-core-dev",
            dnsZone: 'preview-gitpod-dev-com',
            IP: proxyLBIP,
            slice: installerSlices.DNS_ADD_RECORD
        }),
    ])
    werft.done(installerSlices.DNS_ADD_RECORD);
}

export async function issueMetaCerts(werft: Werft, certName: string, certsNamespace: string, domain: string, withVM: boolean, slice: string) {
    const additionalSubdomains: string[] = ["", "*.", `*.ws${withVM ? '' : '-dev'}.`]
    var metaClusterCertParams = new IssueCertificateParams();
    metaClusterCertParams.pathToTemplate = "/workspace/.werft/util/templates";
    metaClusterCertParams.gcpSaPath = GCLOUD_SERVICE_ACCOUNT_PATH;
    metaClusterCertParams.certName = certName;
    metaClusterCertParams.certNamespace = certsNamespace;
    metaClusterCertParams.dnsZoneDomain = "gitpod-dev.com";
    metaClusterCertParams.domain = domain;
    metaClusterCertParams.ip = getCoreDevIngressIP();
    metaClusterCertParams.bucketPrefixTail = ""
    metaClusterCertParams.additionalSubdomains = additionalSubdomains
    metaClusterCertParams.withVM = withVM
    await issueCertificate(werft, metaClusterCertParams, { ...metaEnv(), slice });
}

async function installMetaCertificates(werft: Werft, branch: string, withVM: boolean, destNamespace: string, destinationKubeconfig: string, slice: string) {
    const metaInstallCertParams = new InstallCertificateParams()
    metaInstallCertParams.certName = withVM ? `harvester-${previewNameFromBranchName(branch)}` : `staging-${previewNameFromBranchName(branch)}`;
    metaInstallCertParams.certNamespace = "certs"
    metaInstallCertParams.certSecretName = PROXY_SECRET_NAME
    metaInstallCertParams.destinationNamespace = destNamespace
    metaInstallCertParams.destinationKubeconfig = destinationKubeconfig
    await installCertificate(werft, metaInstallCertParams, { ...metaEnv(), slice: slice });
}

// returns the static IP address
function getCoreDevIngressIP(): string {
    return "104.199.27.246";
}

// returns the static IP address
function getHarvesterIngressIP(): string {
    return "159.69.172.117";
}

function metaEnv(_parent?: ExecOptions): ExecOptions {
    return env("", _parent);
}

function addAgentSmithToken(werft: Werft, namespace: string, kubeconfigPath: string, token: string) {
    process.env.KUBECONFIG = kubeconfigPath
    process.env.TOKEN = token
    setKubectlContextNamespace(namespace, {})
    exec("leeway run components:add-smith-token")
    delete process.env.KUBECONFIG
    delete process.env.TOKEN
}

function generateToken(): [string, string] {
    const token = randomBytes(30).toString('hex')
    const tokenHash = createHash('sha256').update(token, "utf-8").digest("hex")

    return [token, tokenHash]
}
