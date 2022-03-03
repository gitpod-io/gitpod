import { createHash } from 'crypto';
import * as shell from 'shelljs';
import * as fs from 'fs';
import { exec, ExecOptions } from '../../util/shell';
import { InstallMonitoringSatelliteParams, installMonitoringSatellite } from '../../observability/monitoring-satellite';
import {
    wipeAndRecreateNamespace,
    setKubectlContextNamespace,
    deleteNonNamespaceObjects,
    findFreeHostPorts,
    createNamespace,
    helmInstallName,
    findLastHostPort,
} from '../../util/kubectl';
import { issueCertficate, installCertficate, IssueCertificateParams, InstallCertificateParams } from '../../util/certs';
import { sleep, env } from '../../util/util';
import { GCLOUD_SERVICE_ACCOUNT_PATH } from './const';
import { Werft } from '../../util/werft';
import { JobConfig } from './job-config';
import * as VM from '../../vm/vm';

// used by both deploys (helm and Installer)
const PROXY_SECRET_NAME = 'proxy-config-certificates';
const IMAGE_PULL_SECRET_NAME = 'gcp-sa-registry-auth';
const STACKDRIVER_SERVICEACCOUNT = JSON.parse(
    fs.readFileSync(`/mnt/secrets/monitoring-satellite-stackdriver-credentials/credentials.json`, 'utf8'),
);

const phases = {
    PREDEPLOY: 'predeploy',
    DEPLOY: 'deploy',
    VM: 'vm',
};

// Werft slices for deploy phase via installer
const installerSlices = {
    FIND_FREE_HOST_PORTS: 'find free ports',
    IMAGE_PULL_SECRET: 'image pull secret',
    ISSUE_CERTIFICATES: 'install certs',
    CLEAN_ENV_STATE: 'clean envirionment',
    SET_CONTEXT: 'set namespace',
    INSTALLER_INIT: 'installer init',
    INSTALLER_RENDER: 'installer render',
    INSTALLER_POST_PROCESSING: 'installer post processing',
    APPLY_INSTALL_MANIFESTS: 'installer apply',
    DEPLOYMENT_WAITING: 'monitor server deployment',
    DNS_ADD_RECORD: 'add dns record',
};

const vmSlices = {
    BOOT_VM: 'Booting VM',
    START_KUBECTL_PORT_FORWARDS: 'Start kubectl port forwards',
    COPY_CERT_MANAGER_RESOURCES: 'Copy CertManager resources from core-dev',
    INSTALL_LETS_ENCRYPT_ISSUER: 'Install Lets Encrypt issuer',
    KUBECONFIG: 'Getting kubeconfig',
    EXTERNAL_LOGGING: 'Install credentials to send logs from fluent-bit to GCP',
};

export async function deployToPreviewEnvironment(werft: Werft, jobConfig: JobConfig) {
    const {
        version,
        withVM,
        analytics,
        cleanSlateDeployment,
        withPayment,
        withObservability,
        installEELicense,
        withHelm,
        workspaceFeatureFlags,
        dynamicCPULimits,
        storage,
    } = jobConfig;

    const { destname, namespace } = jobConfig.previewEnvironment;

    const domain = withVM ? `${destname}.preview.gitpod-dev.com` : `${destname}.staging.gitpod-dev.com`;
    const monitoringDomain = `${destname}.preview.gitpod-dev.com`;
    const url = `https://${domain}`;
    const imagePullAuth = exec(
        `printf "%s" "_json_key:$(kubectl get secret ${IMAGE_PULL_SECRET_NAME} --namespace=keys -o yaml \
        | yq r - data['.dockerconfigjson'] \
        | base64 -d)" | base64 -w 0`,
        { silent: true },
    ).stdout.trim();

    const sweeperImage = exec(`tar xfO /tmp/dev.tar.gz ./sweeper.txt`).stdout.trim();

    const deploymentConfig: DeploymentConfig = {
        version,
        destname,
        namespace,
        domain,
        monitoringDomain,
        url,
        analytics,
        cleanSlateDeployment,
        sweeperImage,
        installEELicense,
        imagePullAuth,
        withPayment,
        withObservability,
        withVM,
    };

    exec(`kubectl --namespace keys get secret host-key -o yaml > /workspace/host-key.yaml`);

    // Writing auth-provider configuration to disk prior to deploying anything.
    // We do this because we have different auth-providers depending if we're using core-dev or Harvester VMs.
    exec(
        `kubectl get secret ${
            withVM ? 'preview-envs-authproviders-harvester' : 'preview-envs-authproviders'
        } --namespace=keys -o jsonpath="{.data.authProviders}" > auth-provider-secret.yml`,
        { silent: true },
    );

    if (withVM) {
        werft.phase(phases.VM, 'Start VM');

        werft.log(vmSlices.COPY_CERT_MANAGER_RESOURCES, 'Copy over CertManager resources from core-dev');
        exec(
            `kubectl get secret clouddns-dns01-solver-svc-acct -n certmanager -o yaml | sed 's/namespace: certmanager/namespace: cert-manager/g' > clouddns-dns01-solver-svc-acct.yaml`,
            { slice: vmSlices.COPY_CERT_MANAGER_RESOURCES },
        );
        exec(
            `kubectl get clusterissuer letsencrypt-issuer-gitpod-core-dev -o yaml | sed 's/letsencrypt-issuer-gitpod-core-dev/letsencrypt-issuer/g' > letsencrypt-issuer.yaml`,
            { slice: vmSlices.COPY_CERT_MANAGER_RESOURCES },
        );
        werft.done(vmSlices.COPY_CERT_MANAGER_RESOURCES);

        const existingVM = VM.vmExists({ name: destname });
        if (!existingVM) {
            werft.log(vmSlices.BOOT_VM, 'Starting VM');
            VM.startVM({ name: destname });
            werft.currentPhaseSpan.setAttribute('werft.harvester.created_vm', true);
        } else if (cleanSlateDeployment) {
            werft.log(vmSlices.BOOT_VM, 'Removing existing namespace');
            VM.deleteVM({ name: destname });
            werft.log(vmSlices.BOOT_VM, 'Starting VM');
            VM.startVM({ name: destname });
            werft.currentPhaseSpan.setAttribute('werft.harvester.created_vm', true);
        } else {
            werft.log(vmSlices.BOOT_VM, 'VM already exists');
            werft.currentPhaseSpan.setAttribute('werft.harvester.created_vm', false);
        }

        werft.log(vmSlices.BOOT_VM, 'Waiting for VM to be ready');
        VM.waitForVM({ name: destname, timeoutSeconds: 60 * 10, slice: vmSlices.BOOT_VM });
        werft.done(vmSlices.BOOT_VM);

        werft.log(vmSlices.START_KUBECTL_PORT_FORWARDS, 'Starting SSH port forwarding');
        VM.startSSHProxy({ name: destname, slice: vmSlices.START_KUBECTL_PORT_FORWARDS });
        werft.done(vmSlices.START_KUBECTL_PORT_FORWARDS);

        werft.log(vmSlices.KUBECONFIG, 'Copying k3s kubeconfig');
        VM.copyk3sKubeconfig({ name: destname, path: 'k3s.yml', timeoutMS: 1000 * 60 * 3, slice: vmSlices.KUBECONFIG });
        // NOTE: This was a quick have to override the existing kubeconfig so all future kubectl commands use the k3s cluster.
        //       We might want to keep both kubeconfigs around and be explicit about which one we're using.s
        exec(`mv k3s.yml /home/gitpod/.kube/config`);
        werft.done(vmSlices.KUBECONFIG);

        exec(`kubectl apply -f clouddns-dns01-solver-svc-acct.yaml -f letsencrypt-issuer.yaml`, {
            slice: vmSlices.INSTALL_LETS_ENCRYPT_ISSUER,
            dontCheckRc: true,
        });
        werft.done(vmSlices.INSTALL_LETS_ENCRYPT_ISSUER);

        VM.installFluentBit({ namespace: 'default', slice: vmSlices.EXTERNAL_LOGGING });
        werft.done(vmSlices.EXTERNAL_LOGGING);

        issueMetaCerts(werft, PROXY_SECRET_NAME, 'default', domain, withVM);
        werft.done('certificate');
        installMonitoring(
            deploymentConfig.namespace,
            9100,
            deploymentConfig.domain,
            STACKDRIVER_SERVICEACCOUNT,
            withVM,
            jobConfig.observability.branch,
        );
        werft.done('observability');
    }

    werft.phase(phases.PREDEPLOY, 'Checking for existing installations...');
    // the context namespace is not set at this point
    const hasGitpodHelmInstall =
        exec(`helm status ${helmInstallName} -n ${deploymentConfig.namespace}`, {
            slice: 'check for Helm install',
            dontCheckRc: true,
        }).code === 0;
    const hasGitpodInstallerInstall =
        exec(`kubectl get configmap gitpod-app -n ${deploymentConfig.namespace}`, {
            slice: 'check for Installer install',
            dontCheckRc: true,
        }).code === 0;
    werft.log(
        'result of installation checks',
        `has Helm install: ${hasGitpodHelmInstall}, has Installer install: ${hasGitpodInstallerInstall}`,
    );

    if (withHelm) {
        werft.log('using Helm', 'with-helm was specified.');
        // you want helm, but left behind a Gitpod Installer installation, force a clean slate
        if (hasGitpodInstallerInstall && !deploymentConfig.cleanSlateDeployment) {
            werft.log(
                'warning!',
                "with-helm was specified, there's an Installer install, but, `with-clean-slate-deployment=false`, forcing to true.",
            );
            deploymentConfig.cleanSlateDeployment = true;
        }
        werft.done(phases.PREDEPLOY);
        werft.phase(phases.DEPLOY, 'deploying');
        await deployToDevWithHelm(werft, jobConfig, deploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage);
    } // scenario: you pushed code to an existing preview environment built with Helm, and didn't with-clean-slate-deployment=true'
    else if (hasGitpodHelmInstall && !deploymentConfig.cleanSlateDeployment) {
        werft.log(
            'using Helm',
            'with-helm was not specified, but, a Helm installation exists, and this is not a clean slate deployment.',
        );
        werft.log(
            'tip',
            "Set 'with-clean-slate-deployment=true' if you wish to remove the Helm install and use the Installer.",
        );
        werft.done(phases.PREDEPLOY);
        werft.phase(phases.DEPLOY, 'deploying to dev with Helm');
        await deployToDevWithHelm(werft, jobConfig, deploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage);
    } else {
        // you get here if
        // ...it's a new install with no flag overrides or
        // ...it's an existing install and a Helm install doesn't exist or
        // ...you have a prexisting Helm install, set 'with-clean-slate-deployment=true', but did not specifiy 'with-helm=true'
        // Why? The installer is supposed to be a default so we all dog-food it.
        // But, its new, so this may help folks transition with less issues.
        werft.done(phases.PREDEPLOY);
        werft.phase(phases.DEPLOY, 'deploying to dev with Installer');
        await deployToDevWithInstaller(
            werft,
            jobConfig,
            deploymentConfig,
            workspaceFeatureFlags,
            dynamicCPULimits,
            storage,
        );
    }
}

/*
 * Deploy a preview environment using the Installer
 */
async function deployToDevWithInstaller(
    werft: Werft,
    jobConfig: JobConfig,
    deploymentConfig: DeploymentConfig,
    workspaceFeatureFlags: string[],
    dynamicCPULimits,
    storage,
) {
    // to test this function, change files in your workspace, sideload (-s) changed files into werft or set annotations (-a) like so:
    // werft run github -f -j ./.werft/build.yaml -s ./.werft/build.ts -s ./.werft/jobs/build/installer/post-process.sh -a with-clean-slate-deployment=true
    const { version, destname, namespace, domain, monitoringDomain, url, withObservability, withVM } = deploymentConfig;

    // find free ports
    werft.log(installerSlices.FIND_FREE_HOST_PORTS, 'Find last ports');
    let wsdaemonPortMeta = findLastHostPort(
        namespace,
        'ws-daemon',
        metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }),
    );
    let registryNodePortMeta = findLastHostPort(
        namespace,
        'registry-facade',
        metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }),
    );
    let nodeExporterPort = findLastHostPort(
        namespace,
        'node-exporter',
        metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }),
    );

    if (isNaN(wsdaemonPortMeta) || isNaN(wsdaemonPortMeta) || isNaN(nodeExporterPort)) {
        werft.log(installerSlices.FIND_FREE_HOST_PORTS, "Can't reuse, check for some free ports.");
        [wsdaemonPortMeta, registryNodePortMeta, nodeExporterPort] = findFreeHostPorts(
            [
                { start: 10000, end: 11000 },
                { start: 30000, end: 31000 },
                { start: 31001, end: 32000 },
            ],
            metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }),
        );
    }
    werft.log(
        installerSlices.FIND_FREE_HOST_PORTS,
        `wsdaemonPortMeta: ${wsdaemonPortMeta}, registryNodePortMeta: ${registryNodePortMeta}.`,
    );
    werft.done(installerSlices.FIND_FREE_HOST_PORTS);

    // clean environment state
    try {
        if (deploymentConfig.cleanSlateDeployment && !withVM) {
            werft.log(installerSlices.CLEAN_ENV_STATE, 'Clean the preview environment slate...');
            // re-create namespace
            await cleanStateEnv(metaEnv());
        } else {
            werft.log(installerSlices.CLEAN_ENV_STATE, 'Clean the preview environment slate...');
            createNamespace(namespace, metaEnv({ slice: installerSlices.CLEAN_ENV_STATE }));
        }
        werft.done(installerSlices.CLEAN_ENV_STATE);
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail(installerSlices.CLEAN_ENV_STATE, err);
        }
        exec('exit 0');
    }

    if (!withVM) {
        // in a VM, the secrets have alreay been copied
        // If using core-dev, we want to execute further kubectl operations only in the created namespace
        setKubectlContextNamespace(namespace, metaEnv({ slice: installerSlices.SET_CONTEXT }));
        werft.done(installerSlices.SET_CONTEXT);
        try {
            werft.log(installerSlices.ISSUE_CERTIFICATES, 'organizing a certificate for the preview environment...');

            // trigger certificate issuing
            await issueMetaCerts(werft, namespace, 'certs', domain, withVM);
            await installMetaCertificates(werft, namespace);
            werft.done(installerSlices.ISSUE_CERTIFICATES);
        } catch (err) {
            if (!jobConfig.mainBuild) {
                werft.fail(installerSlices.ISSUE_CERTIFICATES, err);
            }
            exec('exit 0');
        }
    }

    // add the image pull secret to the namespcae if it doesn't exist
    const hasPullSecret =
        exec(`kubectl get secret ${IMAGE_PULL_SECRET_NAME} -n ${namespace}`, {
            slice: installerSlices.IMAGE_PULL_SECRET,
            dontCheckRc: true,
            silent: true,
        }).code === 0;
    if (!hasPullSecret) {
        try {
            werft.log(installerSlices.IMAGE_PULL_SECRET, 'Adding the image pull secret to the namespace');
            const dockerConfig = {
                auths: {
                    'eu.gcr.io': { auth: deploymentConfig.imagePullAuth },
                    'europe-docker.pkg.dev': { auth: deploymentConfig.imagePullAuth },
                },
            };
            fs.writeFileSync(`./${IMAGE_PULL_SECRET_NAME}`, JSON.stringify(dockerConfig));
            exec(
                `kubectl create secret docker-registry ${IMAGE_PULL_SECRET_NAME} -n ${namespace} --from-file=.dockerconfigjson=./${IMAGE_PULL_SECRET_NAME}`,
            );
            werft.done(installerSlices.IMAGE_PULL_SECRET);
        } catch (err) {
            if (!jobConfig.mainBuild) {
                werft.fail(installerSlices.IMAGE_PULL_SECRET, err);
            }
            exec('exit 0');
        }
    }

    // download and init with the installer
    try {
        werft.log(installerSlices.INSTALLER_INIT, 'Downloading installer and initializing config file');
        exec(
            `docker run --entrypoint sh --rm eu.gcr.io/gitpod-core-dev/build/installer:${version} -c "cat /app/installer" > /tmp/installer`,
            { slice: installerSlices.INSTALLER_INIT },
        );
        exec(`chmod +x /tmp/installer`, { slice: installerSlices.INSTALLER_INIT });
        exec(`/tmp/installer init > config.yaml`, { slice: installerSlices.INSTALLER_INIT });
        werft.done(installerSlices.INSTALLER_INIT);
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail(installerSlices.INSTALLER_INIT, err);
        }
        exec('exit 0');
    }

    // prepare a proper config file
    try {
        werft.log(
            installerSlices.INSTALLER_RENDER,
            'Post process the base installer config file and render k8s manifests',
        );
        const PROJECT_NAME = 'gitpod-core-dev';
        const CONTAINER_REGISTRY_URL = `eu.gcr.io/${PROJECT_NAME}/build/`;
        const CONTAINERD_RUNTIME_DIR = '/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io';

        // get some values we need to customize the config and write them to file
        exec(
            `yq r ./.werft/jobs/build/helm/values.dev.yaml components.server.blockNewUsers \
        | yq prefix - 'blockNewUsers' > ./blockNewUsers`,
            { slice: installerSlices.INSTALLER_RENDER },
        );
        exec(
            `yq r ./.werft/jobs/build/helm/values.variant.cpuLimits.yaml workspaceSizing | yq prefix - 'workspace' > ./workspaceSizing`,
            { slice: installerSlices.INSTALLER_RENDER },
        );

        // merge values from files
        exec(`yq m -i --overwrite config.yaml ./blockNewUsers`, { slice: installerSlices.INSTALLER_RENDER });
        exec(`yq m -i config.yaml ./workspaceSizing`, { slice: installerSlices.INSTALLER_RENDER });

        // write some values inline
        exec(`yq w -i config.yaml certificate.name ${PROXY_SECRET_NAME}`, { slice: installerSlices.INSTALLER_RENDER });
        exec(`yq w -i config.yaml containerRegistry.inCluster false`, { slice: installerSlices.INSTALLER_RENDER });
        exec(`yq w -i config.yaml containerRegistry.external.url ${CONTAINER_REGISTRY_URL}`, {
            slice: installerSlices.INSTALLER_RENDER,
        });
        exec(`yq w -i config.yaml containerRegistry.external.certificate.kind secret`, {
            slice: installerSlices.INSTALLER_RENDER,
        });
        exec(`yq w -i config.yaml containerRegistry.external.certificate.name ${IMAGE_PULL_SECRET_NAME}`, {
            slice: installerSlices.INSTALLER_RENDER,
        });
        exec(`yq w -i config.yaml domain ${deploymentConfig.domain}`, { slice: installerSlices.INSTALLER_RENDER });
        // TODO: Get rid of JaegerOperator as part of https://github.com/gitpod-io/ops/issues/875
        exec(`yq w -i config.yaml jaegerOperator.inCluster false`, { slice: installerSlices.INSTALLER_RENDER });
        exec(`yq w -i config.yaml workspace.runtime.containerdRuntimeDir ${CONTAINERD_RUNTIME_DIR}`, {
            slice: installerSlices.INSTALLER_RENDER,
        });

        // Relax CPU contraints
        exec(`yq w -i config.yaml workspace.resources.requests.cpu "100m"`, {
            slice: installerSlices.INSTALLER_RENDER,
        });

        if ((deploymentConfig.analytics || '').startsWith('segment|')) {
            exec(`yq w -i config.yaml analytics.writer segment`, { slice: installerSlices.INSTALLER_RENDER });
            exec(
                `yq w -i config.yaml analytics.segmentKey ${deploymentConfig.analytics!.substring('segment|'.length)}`,
                { slice: installerSlices.INSTALLER_RENDER },
            );
        } else if (!!deploymentConfig.analytics) {
            exec(`yq w -i config.yaml analytics.writer ${deploymentConfig.analytics!}`, {
                slice: installerSlices.INSTALLER_RENDER,
            });
        }

        if (withVM || withObservability) {
            // TODO: there's likely more to do...
            const tracingEndpoint = exec(`yq r ./.werft/jobs/build/helm/values.tracing.yaml tracing.endpoint`, {
                slice: installerSlices.INSTALLER_RENDER,
            }).stdout.trim();
            exec(`yq w -i config.yaml observability.tracing.endpoint ${tracingEndpoint}`, {
                slice: installerSlices.INSTALLER_RENDER,
            });

            // If the preview is running on Harvester, we've already deployed monitoring-satellite during 'VM' phase.
            // Therefore, we want to skip installing it here.
            if (!withVM) {
                try {
                    installMonitoring(
                        deploymentConfig.namespace,
                        nodeExporterPort,
                        monitoringDomain,
                        STACKDRIVER_SERVICEACCOUNT,
                        withVM,
                        jobConfig.observability.branch,
                    );
                } catch (err) {
                    werft.fail('observability', err);
                } finally {
                    werft.done('observability');
                }
            }
        }

        werft.log('authProviders', 'copy authProviders from secret');
        try {
            // auth-provider-secret.yml is a file generated by this job by reading a secret from core-dev cluster
            // 'preview-envs-authproviders' for previews running in core-dev and
            // 'preview-envs-authproviders-harvester' for previews running in Harvester VMs.
            // To understand how it is generated, search for 'auth-provider-secret.yml' in the code.
            exec(
                `for row in $(cat auth-provider-secret.yml \
                    | base64 -d -w 0 \
                    | yq r - authProviders -j \
                    | jq -r 'to_entries | .[] | @base64'); do
                        key=$(echo $row | base64 -d | jq -r '.key')
                        providerId=$(echo $row | base64 -d | jq -r '.value.id | ascii_downcase')
                        data=$(echo $row | base64 -d | yq r - value --prettyPrint)

                        yq w -i ./config.yaml authProviders[$key].kind "secret"
                        yq w -i ./config.yaml authProviders[$key].name "$providerId"

                        kubectl create secret generic "$providerId" \
                            --namespace "${namespace}" \
                            --from-literal=provider="$data" \
                            --dry-run=client -o yaml | \
                            kubectl replace --force -f -
                    done`,
                { silent: true },
            );

            werft.done('authProviders');
        } catch (err) {
            if (!jobConfig.mainBuild) {
                werft.fail('authProviders', err);
            }
            exec('exit 0');
        }

        werft.log('SSH gateway hostkey', 'copy host-key from secret');
        try {
            exec(
                `cat /workspace/host-key.yaml \
            | yq w - metadata.namespace ${namespace} \
            | yq d - metadata.uid \
            | yq d - metadata.resourceVersion \
            | yq d - metadata.creationTimestamp \
            | kubectl apply -f -`,
                { silent: true },
            );
            exec(`yq w -i ./config.yaml sshGatewayHostKey.kind "secret"`);
            exec(`yq w -i ./config.yaml sshGatewayHostKey.name "host-key"`);
            werft.done('SSH gateway hostkey');
        } catch (err) {
            if (!jobConfig.mainBuild) {
                werft.fail('SSH gateway hostkey', err);
            }
            exec('exit 0');
        }

        // validate the config
        exec(`/tmp/installer validate config -c config.yaml`, { slice: installerSlices.INSTALLER_RENDER });

        // validate the cluster
        exec(`/tmp/installer validate cluster -c config.yaml || true`, { slice: installerSlices.INSTALLER_RENDER });

        // render the k8s manifest
        exec(`/tmp/installer render --namespace ${deploymentConfig.namespace} --config config.yaml > k8s.yaml`, {
            silent: true,
        });
        werft.done(installerSlices.INSTALLER_RENDER);
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail(installerSlices.INSTALLER_RENDER, err);
        }
        exec('exit 0');
    }

    try {
        werft.log(installerSlices.INSTALLER_POST_PROCESSING, "Let's post process some k8s manifests...");
        const nodepoolIndex = getNodePoolIndex(namespace);

        if (deploymentConfig.installEELicense) {
            werft.log(installerSlices.INSTALLER_POST_PROCESSING, 'Adding the EE License...');
            // Previews in core-dev and harvester use different domain, which requires different licenses.
            exec(`cp /mnt/secrets/gpsh-${withVM ? 'harvester' : 'coredev'}/license /tmp/license`, {
                slice: installerSlices.INSTALLER_POST_PROCESSING,
            });
            // post-process.sh looks for /tmp/license, and if it exists, adds it to the configmap
        } else {
            exec(`touch /tmp/license`, { slice: installerSlices.INSTALLER_POST_PROCESSING });
        }
        exec(`touch /tmp/defaultFeatureFlags`, { slice: installerSlices.INSTALLER_POST_PROCESSING });
        if (workspaceFeatureFlags && workspaceFeatureFlags.length > 0) {
            werft.log(installerSlices.INSTALLER_POST_PROCESSING, 'Adding feature flags...');
            workspaceFeatureFlags.forEach((featureFlag) => {
                exec(`echo \'"${featureFlag}"\' >> /tmp/defaultFeatureFlags`, {
                    slice: installerSlices.INSTALLER_POST_PROCESSING,
                });
            });
            // post-process.sh looks for /tmp/defaultFeatureFlags
            // each "flag" string gets added to the configmap
        }

        const flags = withVM ? 'WITH_VM=true ' : '';
        exec(
            `${flags}./.werft/jobs/build/installer/post-process.sh ${registryNodePortMeta} ${wsdaemonPortMeta} ${nodepoolIndex} ${deploymentConfig.destname}`,
            { slice: installerSlices.INSTALLER_POST_PROCESSING },
        );
        werft.done(installerSlices.INSTALLER_POST_PROCESSING);
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail(installerSlices.INSTALLER_POST_PROCESSING, err);
        }
        exec('exit 0');
    }

    werft.log(installerSlices.APPLY_INSTALL_MANIFESTS, 'Installing preview environment.');
    try {
        exec(`kubectl delete -n ${deploymentConfig.namespace} job migrations || true`, {
            slice: installerSlices.APPLY_INSTALL_MANIFESTS,
            silent: true,
        });
        // errors could result in outputing a secret to the werft log when kubernetes patches existing objects...
        exec(`kubectl apply -f k8s.yaml`, { slice: installerSlices.APPLY_INSTALL_MANIFESTS, silent: true });
        werft.done(installerSlices.APPLY_INSTALL_MANIFESTS);
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail(installerSlices.APPLY_INSTALL_MANIFESTS, err);
        }
        exec('exit 0');
    } finally {
        // produce the result independently of install succeding, so that in case fails we still have the URL.
        exec(`werft log result -d "dev installation" -c github-check-preview-env url ${url}/workspaces`);
    }

    try {
        werft.log(installerSlices.DEPLOYMENT_WAITING, 'Server not ready. Let the waiting...commence!');
        exec(`kubectl -n ${namespace} rollout status deployment/server --timeout=10m`, {
            slice: installerSlices.DEPLOYMENT_WAITING,
        });
        werft.done(installerSlices.DEPLOYMENT_WAITING);
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail(installerSlices.DEPLOYMENT_WAITING, err);
        }
        exec('exit 0');
    }

    await addDNSRecord(werft, deploymentConfig.namespace, deploymentConfig.domain, !withVM);

    // TODO: Fix sweeper, it does not appear to be doing clean-up
    werft.log('sweeper', 'installing Sweeper');
    const sweeperVersion = deploymentConfig.sweeperImage.split(':')[1];
    werft.log('sweeper', `Sweeper version: ${sweeperVersion}`);

    // prepare args
    const args = {
        period: '10m',
        timeout: '48h', // period of inactivity that triggers a removal
        branch: jobConfig.repository.branch, // the branch to check for deletion
        owner: jobConfig.repository.owner,
        repo: jobConfig.repository.repo,
    };
    const argsStr = Object.entries(args)
        .map(([k, v]) => `\"--${k}\", \"${v}\"`)
        .join(', ');
    const allArgsStr = `--set args="{${argsStr}}" --set githubToken.secret=github-sweeper-read-branches --set githubToken.key=token`;

    // TODO: Implement sweeper logic for VMs in Harvester
    if (!withVM) {
        // copy GH token into namespace
        exec(`kubectl --namespace werft get secret github-sweeper-read-branches -o yaml \
            | yq w - metadata.namespace ${namespace} \
            | yq d - metadata.uid \
            | yq d - metadata.resourceVersion \
            | yq d - metadata.creationTimestamp \
            | kubectl apply -f -`);
        exec(
            `/usr/local/bin/helm3 upgrade --install --set image.version=${sweeperVersion} --set command="werft run github -a namespace=${namespace} --remote-job-path .werft/wipe-devstaging.yaml github.com/gitpod-io/gitpod:main" ${allArgsStr} sweeper ./dev/charts/sweeper`,
        );
    }

    werft.done(phases.DEPLOY);

    async function cleanStateEnv(shellOpts: ExecOptions) {
        await wipeAndRecreateNamespace(helmInstallName, namespace, {
            ...shellOpts,
            slice: installerSlices.CLEAN_ENV_STATE,
        });
        // cleanup non-namespace objects
        werft.log(installerSlices.CLEAN_ENV_STATE, 'removing old unnamespaced objects - this might take a while');
        try {
            await deleteNonNamespaceObjects(namespace, destname, {
                ...shellOpts,
                slice: installerSlices.CLEAN_ENV_STATE,
            });
            werft.done(installerSlices.CLEAN_ENV_STATE);
        } catch (err) {
            werft.fail(installerSlices.CLEAN_ENV_STATE, err);
        }
    }
}

/*
 * Deploy a preview environment using Helm
 */
async function deployToDevWithHelm(
    werft: Werft,
    jobConfig: JobConfig,
    deploymentConfig: DeploymentConfig,
    workspaceFeatureFlags: string[],
    dynamicCPULimits,
    storage,
) {
    const { version, destname, namespace, domain, monitoringDomain, url } = deploymentConfig;
    // find free ports
    werft.log('find free ports', 'Check for some free ports.');
    const [wsdaemonPortMeta, registryNodePortMeta, nodeExporterPort] = findFreeHostPorts(
        [
            { start: 10000, end: 11000 },
            { start: 30000, end: 31000 },
            { start: 31001, end: 32000 },
        ],
        metaEnv({ slice: 'find free ports', silent: true }),
    );
    werft.log(
        'find free ports',
        `wsdaemonPortMeta: ${wsdaemonPortMeta}, registryNodePortMeta: ${registryNodePortMeta}, and nodeExporterPort ${nodeExporterPort}.`,
    );
    werft.done('find free ports');

    // trigger certificate issuing
    werft.log('certificate', 'organizing a certificate for the preview environment...');
    let namespaceRecreatedResolve = undefined;
    let namespaceRecreatedPromise = new Promise((resolve) => {
        namespaceRecreatedResolve = resolve;
    });

    try {
        if (deploymentConfig.cleanSlateDeployment) {
            // re-create namespace
            await cleanStateEnv(metaEnv());
        } else {
            createNamespace(namespace, metaEnv({ slice: 'prep' }));
        }
        // Now we want to execute further kubectl operations only in the created namespace
        setKubectlContextNamespace(namespace, metaEnv({ slice: 'prep' }));

        // trigger certificate issuing
        werft.log('certificate', 'organizing a certificate for the preview environment...');
        await issueMetaCerts(werft, namespace, 'certs', domain, false);
        await installMetaCertificates(werft, namespace);
        werft.done('certificate');
        await addDNSRecord(werft, deploymentConfig.namespace, deploymentConfig.domain, false);
        werft.done('prep');
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail('prep', err);
        }
        exec('exit 0');
    }

    // core-dev specific section start
    werft.log('secret', 'copy secret into namespace');
    try {
        const auth = exec(
            `printf "%s" "_json_key:$(kubectl get secret ${IMAGE_PULL_SECRET_NAME} --namespace=keys -o yaml \
                        | yq r - data['.dockerconfigjson'] \
                        | base64 -d)" | base64 -w 0`,
            { silent: true },
        ).stdout.trim();
        fs.writeFileSync(
            'chart/gcp-sa-registry-auth',
            `{
    "auths": {
        "eu.gcr.io": {
            "auth": "${auth}"
        },
        "europe-docker.pkg.dev": {
            "auth": "${auth}"
        }
    }
}`,
        );
        werft.done('secret');
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail('secret', err);
        }
        exec('exit 0');
    }

    werft.log('authProviders', 'copy authProviders');
    try {
        exec(
            `kubectl get secret preview-envs-authproviders --namespace=keys -o yaml \
                | yq r - data.authProviders \
                | base64 -d -w 0 \
                > authProviders`,
            { slice: 'authProviders' },
        );
        exec(`yq merge --inplace .werft/jobs/build/helm/values.dev.yaml ./authProviders`, { slice: 'authProviders' });
        werft.done('authProviders');
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail('authProviders', err);
        }
        exec('exit 0');
    }
    // core-dev specific section end

    // If observability is enabled, we want to deploy it before installing Gitpod itself.
    // The reason behind it is because Gitpod components will start sending traces to a non-existent
    // OpenTelemetry-collector otherwise.
    werft.log(`observability`, 'Running observability static checks.');
    werft.log(`observability`, 'Installing monitoring-satellite...');
    if (deploymentConfig.withObservability) {
        try {
            await installMonitoring(
                namespace,
                nodeExporterPort,
                monitoringDomain,
                STACKDRIVER_SERVICEACCOUNT,
                false,
                jobConfig.observability.branch,
            );
        } catch (err) {
            if (!jobConfig.mainBuild) {
                werft.fail('observability', err);
            }
            exec('exit 0');
        }
    } else {
        exec(`echo '"with-observability" annotation not set, skipping...'`, { slice: `observability` });
        exec(`echo 'To deploy monitoring-satellite, please add "/werft with-observability" to your PR description.'`, {
            slice: `observability`,
        });
    }
    werft.done('observability');

    // deployment config
    try {
        shell.cd('/workspace/chart');
        werft.log('helm', 'installing Gitpod');

        const commonFlags = addDeploymentFlags();
        installGitpod(commonFlags);

        werft.log('helm', 'done');
        werft.done('helm');
    } catch (err) {
        if (!jobConfig.mainBuild) {
            werft.fail('deploy', err);
        }
        exec('exit 0');
    } finally {
        // produce the result independently of Helm succeding, so that in case Helm fails we still have the URL.
        exec(`werft log result -d "dev installation" -c github-check-preview-env url ${url}/workspaces`);
    }

    function installGitpod(commonFlags: string) {
        let flags = commonFlags;
        flags += ` --set components.wsDaemon.servicePort=${wsdaemonPortMeta}`;
        flags += ` --set components.registryFacade.ports.registry.servicePort=${registryNodePortMeta}`;

        const nodeAffinityValues = getNodeAffinities();

        if (storage === 'gcp') {
            exec(
                'kubectl get secret gcp-sa-gitpod-dev-deployer -n werft -o yaml | yq d - metadata | yq w - metadata.name remote-storage-gcloud | kubectl apply -f -',
            );
            flags += ` -f ../.werft/jobs/build/helm/values.dev.gcp-storage.yaml`;
        }

        /*  A hash is caclulated from the branch name and a subset of that string is parsed to a number x,
            x mod the number of different nodepool-sets defined in the files listed in nodeAffinityValues
            is used to generate a pseudo-random number that consistent as long as the branchname persists.
            We use it to reduce the number of preview-environments accumulating on a singe nodepool.
         */
        const nodepoolIndex = getNodePoolIndex(namespace);

        exec(`helm dependencies up`);
        exec(
            `/usr/local/bin/helm3 upgrade --install --timeout 10m -f ../.werft/jobs/build/helm/${nodeAffinityValues[nodepoolIndex]} -f ../.werft/jobs/build/helm/values.dev.yaml ${flags} ${helmInstallName} .`,
        );

        werft.log('helm', 'installing Sweeper');
        const sweeperVersion = deploymentConfig.sweeperImage.split(':')[1];
        werft.log('helm', `Sweeper version: ${sweeperVersion}`);

        // prepare args
        const args = {
            period: '10m',
            timeout: '48h', // period of inactivity that triggers a removal
            branch: jobConfig.repository.branch, // the branch to check for deletion
            owner: jobConfig.repository.owner,
            repo: jobConfig.repository.repo,
        };
        const argsStr = Object.entries(args)
            .map(([k, v]) => `\"--${k}\", \"${v}\"`)
            .join(', ');
        const allArgsStr = `--set args="{${argsStr}}" --set githubToken.secret=github-sweeper-read-branches --set githubToken.key=token`;

        // copy GH token into namespace
        exec(`kubectl --namespace werft get secret github-sweeper-read-branches -o yaml \
            | yq w - metadata.namespace ${namespace} \
            | yq d - metadata.uid \
            | yq d - metadata.resourceVersion \
            | yq d - metadata.creationTimestamp \
            | kubectl apply -f -`);
        exec(
            `/usr/local/bin/helm3 upgrade --install --set image.version=${sweeperVersion} --set command="werft run github -a namespace=${namespace} --remote-job-path .werft/wipe-devstaging.yaml github.com/gitpod-io/gitpod:main" ${allArgsStr} sweeper ../dev/charts/sweeper`,
        );
    }

    function addDeploymentFlags() {
        let flags = '';
        flags += ` --namespace ${namespace}`;
        flags += ` --set components.imageBuilder.hostDindData=/mnt/disks/raid0/docker-${namespace}`;
        flags += ` --set components.wsDaemon.hostWorkspaceArea=/mnt/disks/raid0/workspaces-${namespace}`;
        flags += ` --set version=${version}`;
        flags += ` --set hostname=${domain}`;
        flags += ` --set devBranch=${destname}`;
        workspaceFeatureFlags.forEach((f, i) => {
            flags += ` --set components.server.defaultFeatureFlags[${i}]='${f}'`;
        });
        if (dynamicCPULimits) {
            flags += ` -f ../.werft/jobs/build/helm/values.variant.cpuLimits.yaml`;
        }
        if ((deploymentConfig.analytics || '').startsWith('segment|')) {
            flags += ` --set analytics.writer=segment`;
            flags += ` --set analytics.segmentKey=${deploymentConfig.analytics!.substring('segment|'.length)}`;
        } else if (!!deploymentConfig.analytics) {
            flags += ` --set analytics.writer=${deploymentConfig.analytics!}`;
        }
        if (deploymentConfig.withObservability) {
            flags += ` -f ../.werft/jobs/build/helm/values.tracing.yaml`;
        }
        werft.log('helm', 'extracting versions');
        try {
            exec(
                `docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${version} cat /versions.yaml | tee versions.yaml`,
            );
        } catch (err) {
            if (!jobConfig.mainBuild) {
                werft.fail('helm', err);
            }
            exec('exit 0');
        }
        const pathToVersions = `${shell.pwd().toString()}/versions.yaml`;
        flags += ` -f ${pathToVersions}`;

        if (deploymentConfig.installEELicense) {
            // We're adding the license rather late just to prevent accidentially printing it.
            // If anyone got ahold of the license not much would be lost, but hey, no need to plaster it on the walls.
            flags += ` --set license=${fs.readFileSync('/mnt/secrets/gpsh-coredev/license').toString()}`;
        }
        if (deploymentConfig.withPayment) {
            flags += ` -f ../.werft/jobs/build/helm/values.payment.yaml`;
            exec(`cp /mnt/secrets/payment-provider-config/providerOptions payment-core-dev-options.json`);
            flags += ` --set payment.chargebee.providerOptionsFile=payment-core-dev-options.json`;
            exec(`cp /mnt/secrets/payment-webhook-config/license payment-core-dev-webhook.json`);
            flags += ` --set components.paymentEndpoint.webhookFile="payment-core-dev-webhook.json"`;
        }
        return flags;
    }

    async function cleanStateEnv(shellOpts: ExecOptions) {
        await wipeAndRecreateNamespace(helmInstallName, namespace, { ...shellOpts, slice: 'prep' });
        // cleanup non-namespace objects
        werft.log('predeploy cleanup', 'removing old unnamespaced objects - this might take a while');
        try {
            await deleteNonNamespaceObjects(namespace, destname, { ...shellOpts, slice: 'predeploy cleanup' });
            werft.done('predeploy cleanup');
        } catch (err) {
            if (!jobConfig.mainBuild) {
                werft.fail('predeploy cleanup', err);
            }
            exec('exit 0');
        }
    }
}

/*  A hash is caclulated from the branch name and a subset of that string is parsed to a number x,
    x mod the number of different nodepool-sets defined in the files listed in nodeAffinityValues
    is used to generate a pseudo-random number that consistent as long as the branchname persists.
    We use it to reduce the number of preview-environments accumulating on a singe nodepool.
*/
function getNodePoolIndex(namespace: string): number {
    const nodeAffinityValues = getNodeAffinities();

    return (
        parseInt(createHash('sha256').update(namespace).digest('hex').substring(0, 5), 16) % nodeAffinityValues.length
    );
}

function getNodeAffinities(): string[] {
    return [
        'values.nodeAffinities_1.yaml',
        'values.nodeAffinities_2.yaml',
        'values.nodeAffinities_0.yaml',
        'values.nodeAffinities_3.yaml',
        'values.nodeAffinities_4.yaml',
        'values.nodeAffinities_5.yaml',
    ];
}

interface DeploymentConfig {
    version: string;
    destname: string;
    namespace: string;
    domain: string;
    monitoringDomain: string;
    url: string;
    analytics?: string;
    cleanSlateDeployment: boolean;
    sweeperImage: string;
    installEELicense: boolean;
    imagePullAuth: string;
    withPayment: boolean;
    withObservability: boolean;
    withVM: boolean;
}

async function addDNSRecord(werft: Werft, namespace: string, domain: string, isLoadbalancer: boolean) {
    let wsProxyLBIP = null;
    if (isLoadbalancer === true) {
        werft.log(installerSlices.DNS_ADD_RECORD, 'Getting ws-proxy loadbalancer IP');
        for (let i = 0; i < 60; i++) {
            try {
                let lb = exec(
                    `kubectl -n ${namespace} get service ws-proxy -o=jsonpath='{.status.loadBalancer.ingress[0].ip}'`,
                    { silent: true },
                );
                if (lb.length > 4) {
                    wsProxyLBIP = lb;
                    break;
                }
                await sleep(1000);
            } catch (err) {
                await sleep(1000);
            }
        }
        if (wsProxyLBIP == null) {
            werft.fail(installerSlices.DNS_ADD_RECORD, new Error("Can't get ws-proxy loadbalancer IP"));
        }
        werft.log(installerSlices.DNS_ADD_RECORD, 'Get ws-proxy loadbalancer IP: ' + wsProxyLBIP);
    } else {
        wsProxyLBIP = getCoreDevIngressIP();
    }

    var cmd = `set -x \
    && cd /workspace/.werft/dns \
    && rm -rf .terraform* \
    && export GOOGLE_APPLICATION_CREDENTIALS="${GCLOUD_SERVICE_ACCOUNT_PATH}" \
    && terraform init -backend-config='prefix=${namespace}' -migrate-state -upgrade \
    && terraform apply -auto-approve \
        -var 'dns_zone_domain=gitpod-dev.com' \
        -var 'domain=${domain}' \
        -var 'ingress_ip=${getCoreDevIngressIP()}' \
        -var 'ws_proxy_ip=${wsProxyLBIP}'`;

    werft.log(installerSlices.DNS_ADD_RECORD, 'Terraform command for create dns record: ' + cmd);
    exec(cmd, { ...metaEnv(), slice: installerSlices.DNS_ADD_RECORD });
    werft.done(installerSlices.DNS_ADD_RECORD);
}

export async function issueMetaCerts(
    werft: Werft,
    previewNamespace: string,
    certsNamespace: string,
    domain: string,
    withVM: boolean,
) {
    let additionalSubdomains: string[] = ['', '*.', `*.ws${withVM ? '' : '-dev'}.`];
    var metaClusterCertParams = new IssueCertificateParams();
    metaClusterCertParams.pathToTemplate = '/workspace/.werft/util/templates';
    metaClusterCertParams.gcpSaPath = GCLOUD_SERVICE_ACCOUNT_PATH;
    metaClusterCertParams.namespace = previewNamespace;
    metaClusterCertParams.certNamespace = certsNamespace;
    metaClusterCertParams.dnsZoneDomain = 'gitpod-dev.com';
    metaClusterCertParams.domain = domain;
    metaClusterCertParams.ip = getCoreDevIngressIP();
    metaClusterCertParams.bucketPrefixTail = '';
    metaClusterCertParams.additionalSubdomains = additionalSubdomains;
    await issueCertficate(werft, metaClusterCertParams, metaEnv());
}

async function installMetaCertificates(werft: Werft, namespace: string) {
    const certName = namespace;
    const metaInstallCertParams = new InstallCertificateParams();
    metaInstallCertParams.certName = certName;
    metaInstallCertParams.certNamespace = 'certs';
    metaInstallCertParams.certSecretName = PROXY_SECRET_NAME;
    metaInstallCertParams.destinationNamespace = namespace;
    await installCertficate(werft, metaInstallCertParams, metaEnv());
}

async function installMonitoring(
    namespace: string,
    nodeExporterPort: number,
    domain: string,
    stackdriverServiceAccount: any,
    withVM: boolean,
    observabilityBranch: string,
) {
    const installMonitoringSatelliteParams = new InstallMonitoringSatelliteParams();
    installMonitoringSatelliteParams.branch = observabilityBranch;
    installMonitoringSatelliteParams.pathToKubeConfig = '';
    installMonitoringSatelliteParams.satelliteNamespace = namespace;
    installMonitoringSatelliteParams.clusterName = namespace;
    installMonitoringSatelliteParams.nodeExporterPort = nodeExporterPort;
    installMonitoringSatelliteParams.previewDomain = domain;
    installMonitoringSatelliteParams.stackdriverServiceAccount = stackdriverServiceAccount;
    installMonitoringSatelliteParams.withVM = withVM;
    installMonitoringSatellite(installMonitoringSatelliteParams);
}

// returns the static IP address
function getCoreDevIngressIP(): string {
    return '104.199.27.246';
}

function metaEnv(_parent?: ExecOptions): ExecOptions {
    return env('', _parent);
}
