import * as shell from 'shelljs';
import * as fs from 'fs';
import * as path from 'path';
import { exec, ExecOptions } from './util/shell';
import { Werft } from './util/werft';
import { waitForDeploymentToSucceed, wipeAndRecreateNamespace, setKubectlContextNamespace, deleteNonNamespaceObjects, findFreeHostPorts, createNamespace, helmInstallName } from './util/kubectl';
import { issueCertficate, installCertficate, IssueCertificateParams, InstallCertificateParams } from './util/certs';
import { reportBuildFailureInSlack } from './util/slack';
import * as semver from 'semver';
import * as util from 'util';
import { sleep, env } from './util/util';
import * as gpctl from './util/gpctl';
import { createHash } from "crypto";
import { InstallMonitoringSatelliteParams, installMonitoringSatellite, observabilityStaticChecks } from './observability/monitoring-satellite';
import { SpanStatusCode } from '@opentelemetry/api';
import * as Tracing from './observability/tracing'

// Will be set once tracing has been initialized
let werft: Werft

const readDir = util.promisify(fs.readdir)

const GCLOUD_SERVICE_ACCOUNT_PATH = "/mnt/secrets/gcp-sa/service-account.json";

// used by both deploys (helm and Installer)
const PROXY_SECRET_NAME = "proxy-config-certificates";
const IMAGE_PULL_SECRET_NAME = "gcp-sa-registry-auth";

const context = JSON.parse(fs.readFileSync('context.json').toString());

const version = parseVersion(context);


Tracing.initialize()
    .then(() => {
        werft = new Werft("build")
    })
    .then(() => build(context, version))
    .then(() => werft.endAllSpans())
    .catch((err) => {
        werft.rootSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err
        })
        werft.endAllSpans()

        if (context.Repository.ref === "refs/heads/main") {
            reportBuildFailureInSlack(context, err, () => process.exit(1));
        } else {
            console.log('Error', err)
            // Explicitly not using process.exit as we need to flush tracing, see tracing.js
            process.exitCode = 1
        }
    })

// Werft phases
const phases = {
    DEPLOY: 'deploy',
    TRIGGER_INTEGRATION_TESTS: 'trigger integration tests',
    REGISTER_K3S_WS_CLUSTER: "register k3s ws cluster"
}

// Werft slices for deploy phase via installer
const installerSlices = {
    FIND_FREE_HOST_PORTS: "find free ports",
    IMAGE_PULL_SECRET: "image pull secret",
    ISSUE_CERTIFICATES: "install certs",
    CLEAN_ENV_STATE: "clean envirionment",
    SET_CONTEXT: "set namespace",
    INSTALLER_INIT: "installer init",
    INSTALLER_RENDER: "installer render",
    INSTALLER_POST_PROCESSING: "installer post processing",
    APPLY_INSTALL_MANIFESTS: "installer apply",
    INSTALL_GITPOD: "install Gitpod"
}

export function parseVersion(context) {
    let buildConfig = context.Annotations || {};
    const explicitVersion = buildConfig.version;
    if (explicitVersion) {
        return explicitVersion;
    }
    let version = context.Name;
    const PREFIX_TO_STRIP = "gitpod-build-";
    if (version.substr(0, PREFIX_TO_STRIP.length) === PREFIX_TO_STRIP) {
        version = version.substr(PREFIX_TO_STRIP.length);
    }
    return version
}

export async function build(context, version) {
    werft.phase('validate-changes', 'validating changes');
    try {
        exec(`pre-commit run --all-files --show-diff-on-failure`);
        werft.done('validate-changes');
    } catch (err) {
        werft.fail('validate-changes', err);
    }

    /**
    * Prepare
    */
    werft.phase("prepare");

    const werftImg = shell.exec("cat .werft/build.yaml | grep dev-environment").trim().split(": ")[1];
    const devImg = shell.exec("yq r .gitpod.yml image").trim();
    if (werftImg !== devImg) {
        werft.fail('prep', `Werft job image (${werftImg}) and Gitpod dev image (${devImg}) do not match`);
    }

    let buildConfig = context.Annotations || {};
    const k3sWsCluster = "k3s-ws" in buildConfig;
    try {
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
        exec("gcloud auth configure-docker --quiet");
        exec('gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev');

        if (k3sWsCluster) {
            // get and store the ws cluster kubeconfig to root of the project
            shell.exec("kubectl get secret k3sdev -n werft -o=go-template='{{index .data \"k3s-external.yaml\"}}' | base64 -d > k3s-external.yaml").trim()
        }
        werft.done('prep');
    } catch (err) {
        werft.fail('prep', err);
    }
    const repo = `${context.Repository.host}/${context.Repository.owner}/${context.Repository.repo}`;
    const mainBuild = repo === "github.com/gitpod-io/gitpod" && context.Repository.ref.includes("refs/heads/main");
    const dontTest = "no-test" in buildConfig;
    const publishRelease = "publish-release" in buildConfig;
    const workspaceFeatureFlags: string[] = ((): string[] => {
        const raw: string = buildConfig["ws-feature-flags"] || "";
        if (!raw) {
            return [];
        }
        return raw.split(",").map(e => e.trim());
    })();
    const dynamicCPULimits = "dynamic-cpu-limits" in buildConfig;
    const withContrib = "with-contrib" in buildConfig || mainBuild;
    const noPreview = ("no-preview" in buildConfig && buildConfig["no-preview"] !== "false") || publishRelease;
    const storage = buildConfig["storage"] || "";
    const withIntegrationTests = "with-integration-tests" in buildConfig;
    const publishToNpm = "publish-to-npm" in buildConfig || mainBuild;
    const analytics = buildConfig["analytics"];
    const localAppVersion = mainBuild || ("with-localapp-version" in buildConfig) ? version : "unknown";
    const retag = ("with-retag" in buildConfig) ? "" : "--dont-retag";
    const cleanSlateDeployment = mainBuild || ("with-clean-slate-deployment" in buildConfig);
    const installEELicense = !("without-ee-license" in buildConfig);
    const withPayment= "with-payment" in buildConfig;
    const withObservability = "with-observability" in buildConfig;
    const withHelm = "with-helm" in buildConfig;

    const jobConfig = {
        buildConfig,
        version,
        mainBuild,
        dontTest,
        publishRelease,
        workspaceFeatureFlags,
        dynamicCPULimits,
        noPreview,
        storage: storage,
        withIntegrationTests,
        k3sWsCluster,
        publishToNpm,
        analytics,
        localAppVersion,
        retag,
        cleanSlateDeployment,
        installEELicense,
        withObservability,
        withHelm,
    }
    werft.log("job config", JSON.stringify(jobConfig));
    werft.rootSpan.setAttributes(Object.fromEntries(Object.entries(jobConfig).map((kv) => {
        const [key, value] = kv
        return [`werft.job.config.${key}`, value]
    })))
    werft.rootSpan.setAttribute('werft.job.config.branch', context.Repository.ref)

    /**
     * Build
     */
    werft.phase("build", "build running");
    const imageRepo = publishRelease ? "gcr.io/gitpod-io/self-hosted" : "eu.gcr.io/gitpod-core-dev/build";

    const coverageOutput = exec("mktemp -d", { silent: true }).stdout.trim();

    exec(`LICENCE_HEADER_CHECK_ONLY=true leeway run components:update-license-header || { echo "[build|FAIL] There are some license headers missing. Please run 'leeway run components:update-license-header'."; exit 1; }`)
    exec(`leeway vet --ignore-warnings`);
    exec(`leeway build --docker-build-options network=host --werft=true -c remote ${dontTest ? '--dont-test' : ''} --dont-retag --coverage-output-path=${coverageOutput} --save /tmp/dev.tar.gz -Dversion=${version} -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev dev:all`);
    const sweeperImage = exec(`tar xfO /tmp/dev.tar.gz ./sweeper.txt`).stdout.trim();
    if (publishRelease) {
        exec(`gcloud auth activate-service-account --key-file "/mnt/secrets/gcp-sa-release/service-account.json"`);
    }
    if (withContrib || publishRelease) {
        exec(`leeway build --docker-build-options network=host --werft=true -c remote ${dontTest ? '--dont-test' : ''} -Dversion=${version} -DimageRepoBase=${imageRepo} contrib:all`);
    }
    exec(`leeway build --docker-build-options network=host --werft=true -c remote ${dontTest ? '--dont-test' : ''} ${retag} --coverage-output-path=${coverageOutput} -Dversion=${version} -DremoveSources=false -DimageRepoBase=${imageRepo} -DlocalAppVersion=${localAppVersion} -DnpmPublishTrigger=${publishToNpm ? Date.now() : 'false'}`);
    if (publishRelease) {
        try {
            werft.phase("publish", "checking version semver compliance...");
            if (!semver.valid(version)) {
                // make this an explicit error as early as possible. Is required by helm Charts.yaml/version
                throw new Error(`'${version}' is not semver compliant and thus cannot used for Self-Hosted releases!`)
            }

            werft.phase("publish", "publishing Helm chart...");
            publishHelmChart("gcr.io/gitpod-io/self-hosted", version);

            werft.phase("publish", `preparing GitHub release files...`);
            const releaseFilesTmpDir = exec("mktemp -d", { silent: true }).stdout.trim();
            const releaseTarName = "release.tar.gz";
            exec(`leeway build --docker-build-options network=host --werft=true chart:release-tars -Dversion=${version} -DimageRepoBase=${imageRepo} --save ${releaseFilesTmpDir}/${releaseTarName}`);
            exec(`cd ${releaseFilesTmpDir} && tar xzf ${releaseTarName} && rm -f ${releaseTarName}`);

            werft.phase("publish", `publishing GitHub release ${version}...`);
            const prereleaseFlag = semver.prerelease(version) !== null ? "-prerelease" : "";
            const tag = `v${version}`;
            const releaseBranch = context.Repository.ref;
            const description = `Gitpod Self-Hosted ${version}<br/><br/>Docs: https://www.gitpod.io/docs/self-hosted/latest/self-hosted/`;
            exec(`github-release ${prereleaseFlag} gitpod-io/gitpod ${tag} ${releaseBranch} '${description}' "${releaseFilesTmpDir}/*"`);

            werft.done('publish');
        } catch (err) {
            werft.fail('publish', err);
        } finally {
            exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
        }
    }
    // gitTag(`build/${version}`);

    // Configure codecov as docker: SOURCE_BRANCH, SOURCE_COMMIT, DOCKER_REPO
    // (there is no support for werft)
    // --parent The commit SHA of the parent for which you are uploading coverage
    // --dir    Directory to search for coverage reports
    werft.phase('coverage', 'uploading code coverage to codecov');
    const parent_commit = exec(`git rev-parse HEAD^`, { silent: true }).stdout.trim();;
    try {
        // if we don't remove the go directory codecov will scan it recursively
        exec(`sudo rm -rf go`);
        const coverageFiles = await readDir(coverageOutput);
        for (let index = 0; index < coverageFiles.length; index++) {
            const file = coverageFiles[index];
            if (file.indexOf("-coverage.out") == -1) {
                continue
            }
            let flag = file.substring(0, file.length - "-coverage.out".length);
            exec(`codecov -N "${parent_commit}" --flags=${flag} --file "${coverageOutput}/${file}"`, {slice: "coverage"});
        }

        werft.done('coverage');
    } catch (err) {
        werft.fail('coverage', err);
    }

    // if (mainBuild) {
    /**
     * Deploy master
     *
     * [cw] we don't have a core-staging environment (yet)
     */
    // exec(`git config --global user.name "${context.Owner}"`);
    // exec(`werft run --follow-with-prefix=deploy --remote-job-path .werft/deploy-staging.yaml -a version=${version} github`);
    // return;
    // }

    if (noPreview) {
        werft.phase("deploy", "not deploying");
        console.log("no-preview or publish-release is set");
        return
    }

    const destname = version.split(".")[0];
    const namespace = `staging-${destname}`;
    const domain = `${destname}.staging.gitpod-dev.com`;
    const monitoringDomain = `${destname}.preview.gitpod-dev.com`;
    const url = `https://${domain}`;
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
        k3sWsCluster,
        withPayment,
        withObservability,
    };
    if (withHelm) {
        await deployToDev(deploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage);
    } else {
        await deployToDevWithInstaller(deploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage);
    }
    await triggerIntegrationTests(deploymentConfig.version, deploymentConfig.namespace, context.Owner, !withIntegrationTests)
}

interface DeploymentConfig {
    version: string;
    destname: string;
    namespace: string;
    domain: string;
    monitoringDomain: string,
    url: string;
    k3sWsCluster?: boolean;
    analytics?: string;
    cleanSlateDeployment: boolean;
    sweeperImage: string;
    installEELicense: boolean;
    withPayment: boolean;
    withObservability: boolean;
}

/*
* Deploy a preview environment using the Installer
*
* TODO: add support for tracing, if needed, use with-helm for now
* TODO: add support for k3sWsCluster, if needed, use with-helm for now
*/
export async function deployToDevWithInstaller(deploymentConfig: DeploymentConfig, workspaceFeatureFlags: string[], dynamicCPULimits, storage) {
    // to test this function, change files in your workspace, and sideload (-s) changed files into werft like so
    // werft run github -f -j ./.werft/build.yaml -s ./.werft/build.ts -s ./.werft/post-process.sh -a with-clean-slate-deployment=true

    werft.phase(phases.DEPLOY, "deploying to dev")

    const { version, destname, namespace, domain, monitoringDomain, url } = deploymentConfig;

    // find free ports
    werft.log(installerSlices.FIND_FREE_HOST_PORTS, "Check for some free ports.");
    const [wsdaemonPortMeta, registryNodePortMeta, nodeExporterPort] = findFreeHostPorts([
        { start: 10000, end: 11000 },
        { start: 30000, end: 31000 },
        { start: 31001, end: 32000 },
    ], metaEnv({ slice: installerSlices.FIND_FREE_HOST_PORTS, silent: true }));
    werft.log(installerSlices.FIND_FREE_HOST_PORTS,
        `wsdaemonPortMeta: ${wsdaemonPortMeta}, registryNodePortMeta: ${registryNodePortMeta}, and nodeExporterPort ${nodeExporterPort}.`);
    werft.done(installerSlices.FIND_FREE_HOST_PORTS);

    // clean environment state
    try {
        if (deploymentConfig.cleanSlateDeployment) {
            werft.log(installerSlices.CLEAN_ENV_STATE, "Clean the preview environment slate...");
            // re-create namespace
            await cleanStateEnv(metaEnv());

        } else {
            werft.log(installerSlices.CLEAN_ENV_STATE, "Clean the preview environment slate...");
            createNamespace(namespace, metaEnv({ slice: installerSlices.CLEAN_ENV_STATE }));
        }
        werft.done(installerSlices.CLEAN_ENV_STATE);
    } catch (err) {
        werft.fail(installerSlices.CLEAN_ENV_STATE, err);
    }

    // Now we want to execute further kubectl operations only in the created namespace
    setKubectlContextNamespace(namespace, metaEnv({ slice: installerSlices.SET_CONTEXT }));

    // trigger certificate issuing
    try {
        werft.log(installerSlices.ISSUE_CERTIFICATES, "organizing a certificate for the preview environment...");

        // trigger certificate issuing
        await issueMetaCerts(namespace, domain);
        await installMetaCertificates(namespace);
        werft.done(installerSlices.ISSUE_CERTIFICATES);
    } catch (err) {
        werft.fail(installerSlices.ISSUE_CERTIFICATES, err);
    }

    // add the image pull secret to the namespcae if it doesn't exist
    const hasPullSecret = (exec(`kubectl get secret ${IMAGE_PULL_SECRET_NAME} -n ${namespace}`, {slice: installerSlices.IMAGE_PULL_SECRET, dontCheckRc: true, silent: true })).code === 0;
    if (!hasPullSecret) {
        try {
            werft.log(installerSlices.IMAGE_PULL_SECRET, "Adding the image pull secret to the namespace");
            const auth = exec(`echo -n "_json_key:$(kubectl get secret ${IMAGE_PULL_SECRET_NAME} --namespace=keys -o yaml \
                | yq r - data['.dockerconfigjson'] \
                | base64 -d)" | base64 -w 0`, { silent: true }).stdout.trim();
            fs.writeFileSync(`./${IMAGE_PULL_SECRET_NAME}`,
            `{
    "auths": {
        "eu.gcr.io": {
            "auth": "${auth}"
        }
    }
}`);
            exec(`kubectl create secret docker-registry ${IMAGE_PULL_SECRET_NAME} -n ${namespace} --from-file=.dockerconfigjson=./${IMAGE_PULL_SECRET_NAME}`);
            werft.done(installerSlices.IMAGE_PULL_SECRET);
        }
        catch (err) {
            werft.fail(installerSlices.IMAGE_PULL_SECRET, err);
        }
    }

    // download and init with the installer
    try {
        werft.log(installerSlices.INSTALLER_INIT, "Downloading installer and initializing config file");
        exec(`docker run --entrypoint sh --rm eu.gcr.io/gitpod-core-dev/build/installer:${version} -c "cat /app/installer" > /tmp/installer`, {slice: installerSlices.INSTALLER_INIT});
        exec(`chmod +x /tmp/installer`, {slice: installerSlices.INSTALLER_INIT});
        exec(`/tmp/installer init > config.yaml`, {slice: installerSlices.INSTALLER_INIT});
        werft.done(installerSlices.INSTALLER_INIT);
    } catch (err) {
        werft.fail(installerSlices.INSTALLER_INIT, err)
    }

    // prepare a proper config file
    try {
        werft.log(installerSlices.INSTALLER_RENDER, "Post process the base installer config file and render k8s manifests");
        const PROJECT_NAME="gitpod-core-dev";
        const CONTAINER_REGISTRY_URL=`eu.gcr.io/${PROJECT_NAME}/build/`;
        const CONTAINERD_RUNTIME_DIR = "/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io";

        // get some values we need to customize the config and write them to file
        exec(`yq r ./.werft/values.dev.yaml components.server.blockNewUsers \
        | yq prefix - 'blockNewUsers' > ./blockNewUsers`, { slice: installerSlices.INSTALLER_RENDER });
        exec(`yq r ./.werft/values.variant.cpuLimits.yaml workspaceSizing | yq prefix - 'workspace' > ./workspaceSizing`, { slice: installerSlices.INSTALLER_RENDER });

        // merge values from files
        exec(`yq m -i --overwrite config.yaml ./blockNewUsers`, { slice: installerSlices.INSTALLER_RENDER });
        exec(`yq m -i config.yaml ./workspaceSizing`, { slice: installerSlices.INSTALLER_RENDER });

        // write some values inline
        exec(`yq w -i config.yaml certificate.name ${PROXY_SECRET_NAME}`, {slice: installerSlices.INSTALLER_RENDER});
        exec(`yq w -i config.yaml containerRegistry.inCluster ${false}`, {slice: installerSlices.INSTALLER_RENDER});
        exec(`yq w -i config.yaml containerRegistry.external.url ${CONTAINER_REGISTRY_URL}`, {slice: installerSlices.INSTALLER_RENDER});
        exec(`yq w -i config.yaml containerRegistry.external.certificate.kind ${"secret"}`, {slice: installerSlices.INSTALLER_RENDER});
        exec(`yq w -i config.yaml containerRegistry.external.certificate.name ${IMAGE_PULL_SECRET_NAME}`, {slice: installerSlices.INSTALLER_RENDER});
        exec(`yq w -i config.yaml domain ${deploymentConfig.domain}`, {slice: installerSlices.INSTALLER_RENDER});
        exec(`yq w -i config.yaml workspace.runtime.containerdRuntimeDir ${CONTAINERD_RUNTIME_DIR}`, {slice: installerSlices.INSTALLER_RENDER});

        // TODO: need to circle back to tracing
        // exec(`yq w -i config.yaml jaegerOperator.inCluster ${false}`, {slice: installerSlices.INSTALLER_RENDER});

        // TODO: Remove this after #6867 is done
        werft.log("authProviders", "copy authProviders")
        try {
            exec(`kubectl get secret preview-envs-authproviders --namespace=keys -o yaml \
                    | yq r - data.authProviders \
                    | base64 -d -w 0 \
                    > ./authProviders`, { silent: true });
            exec(`yq merge --inplace config.yaml ./authProviders`, { silent: true })
            werft.done('authProviders');
        } catch (err) {
            werft.fail('authProviders', err);
        }

        // validate the config and cluster
        exec(`/tmp/installer validate config -c config.yaml`, {slice: installerSlices.INSTALLER_RENDER});

        // TODO: Ignore cluster validation errors (our k8s version is too old in core-dev)
        // consider removing '|| true' after we've left core-dev and are using K3s for preview envs
        exec(`/tmp/installer validate cluster -c config.yaml || true`, {slice: installerSlices.INSTALLER_RENDER});

        // render the k8s manifest
        exec(`/tmp/installer render --namespace ${deploymentConfig.namespace} --config config.yaml > k8s.yaml`, { silent: true });
        werft.done(installerSlices.INSTALLER_RENDER);
    } catch (err) {
        werft.fail(installerSlices.INSTALLER_RENDER, err)
    }

    try {
        werft.log(installerSlices.INSTALLER_POST_PROCESSING, "Let's post process some k8s manifests...");
        const nodepoolIndex = getNodePoolIndex(namespace);
        exec(`chmod +x ./.werft/post-process.sh`,{slice: installerSlices.INSTALLER_POST_PROCESSING});
        exec(`./.werft/post-process.sh ${registryNodePortMeta} ${wsdaemonPortMeta} ${nodepoolIndex}`,{slice: installerSlices.INSTALLER_POST_PROCESSING});
        werft.done(installerSlices.INSTALLER_POST_PROCESSING);
    } catch (err) {
        werft.fail(installerSlices.INSTALLER_POST_PROCESSING, err);
    }

    werft.log(installerSlices.APPLY_INSTALL_MANIFESTS, "Installing preview environment.");
    try {
        exec(`kubectl apply -f k8s.yaml`,{ silent: true });
        werft.done(installerSlices.APPLY_INSTALL_MANIFESTS);
    } catch (err) {
        werft.fail(installerSlices.APPLY_INSTALL_MANIFESTS, err);
    } finally {
        // produce the result independently of Helm succeding, so that in case Helm fails we still have the URL.
        exec(`werft log result -d "dev installation" -c github-check-preview-env url ${url}/projects`);
    }

    // TODO: test sweeper is installed
    werft.log('sweeper', 'installing Sweeper');
    const sweeperVersion = deploymentConfig.sweeperImage.split(":")[1];
    werft.log('sweeper', `Sweeper version: ${sweeperVersion}`);

    // prepare args
    const refsPrefix = "refs/heads/";
    const owner: string = context.Repository.owner;
    const repo: string = context.Repository.repo;
    let branch: string = context.Repository.ref;
    if (branch.startsWith(refsPrefix)) {
        branch = branch.substring(refsPrefix.length);
    }
    const args = {
        "period": "10m",
        "timeout": "48h",   // period of inactivity that triggers a removal
        branch,             // the branch to check for deletion
        owner,
        repo,
    };
    const argsStr = Object.entries(args).map(([k, v]) => `\"--${k}\", \"${v}\"`).join(", ");
    const allArgsStr = `--set args="{${argsStr}}" --set githubToken.secret=github-sweeper-read-branches --set githubToken.key=token`;

    // copy GH token into namespace
    exec(`kubectl --namespace werft get secret github-sweeper-read-branches -o yaml \
        | yq w - metadata.namespace ${namespace} \
        | yq d - metadata.uid \
        | yq d - metadata.resourceVersion \
        | yq d - metadata.creationTimestamp \
        | kubectl apply -f -`);
    exec(`/usr/local/bin/helm3 upgrade --install --set image.version=${sweeperVersion} --set command="werft run github -a namespace=${namespace} --remote-job-path .werft/wipe-devstaging.yaml github.com/gitpod-io/gitpod:main" ${allArgsStr} sweeper ./dev/charts/sweeper`);

    // TODO: There is a method used by the current deploy, addDeploymentFlags, which uses helm flags to set many things for the install.
    // We're not honoring them now, such as:
    //  adding a license (Simon created #6868)
    //  intergrating with charge bees (get feedback from meta team)
    //  disk paths are set for for ws-daemon and image builder (test and see if this works "as is")
    //  Server feature flags (get feedback from meta team)
    //  analytics (get feedback from meta team)

    werft.done(phases.DEPLOY);

    async function cleanStateEnv(shellOpts: ExecOptions) {
        // TODO: check to see if anything lingers after this point ... mysql, minio, jaeger, etc.
        await wipeAndRecreateNamespace(helmInstallName, namespace, { ...shellOpts, slice: installerSlices.CLEAN_ENV_STATE });
        // cleanup non-namespace objects
        werft.log(installerSlices.CLEAN_ENV_STATE, "removing old unnamespaced objects - this might take a while");
        try {
            await deleteNonNamespaceObjects(namespace, destname, { ...shellOpts, slice:  installerSlices.CLEAN_ENV_STATE });
            werft.done(installerSlices.CLEAN_ENV_STATE);
        } catch (err) {
            werft.fail(installerSlices.CLEAN_ENV_STATE, err);
        }
    }
}

/**
 * Deploy dev
 */
export async function deployToDev(deploymentConfig: DeploymentConfig, workspaceFeatureFlags: string[], dynamicCPULimits, storage) {
    werft.phase("deploy", "deploying to dev");
    const { version, destname, namespace, domain, monitoringDomain, url, k3sWsCluster } = deploymentConfig;
    const [wsdaemonPortMeta, registryNodePortMeta, nodeExporterPort] = findFreeHostPorts([
        { start: 10000, end: 11000 },
        { start: 30000, end: 31000 },
        { start: 31001, end: 32000 },
    ], metaEnv({ slice: 'hostports' }));
    const [wsdaemonPortK3sWs, registryNodePortK3sWs] = !k3sWsCluster ? [0, 0] : findFreeHostPorts([
        { start: 10000, end: 11000 },
        { start: 30000, end: 31000 },
    ], k3sEnv({ slice: 'hostports' }));

    // trigger certificate issuing
    werft.log('certificate', "organizing a certificate for the preview environment...");
    let namespaceRecreatedResolve = undefined;
    let namespaceRecreatedPromise = new Promise((resolve) => {
        namespaceRecreatedResolve = resolve;
    });

    var k3sWsProxyIP = "";
    if (k3sWsCluster) {
        try {
            // The output of gcloud compute addresses describe contains a list of values in <key>:__<value> form. We get rid of the `address:  ` to find the ip
            const existingIP = exec(`gcloud compute addresses describe ${namespace} --region europe-west1 | grep 'address:' | cut -c 10-`, { silent: true }).trim();
            werft.log('certificate', `The gcloud compute address describe returned: ${existingIP}`)
            if (existingIP.indexOf("ERROR:") == -1 && existingIP != "") {
                k3sWsProxyIP = existingIP;
                werft.log('certificate', `found existing ip named ${namespace} and value: ${k3sWsProxyIP}`)
            } else {
                exec(`gcloud compute addresses create ${namespace} --region europe-west1`)
                const newIP = exec(`gcloud compute addresses describe ${namespace} --region europe-west1 | grep 'address:' | cut -c 10-`).trim();
                k3sWsProxyIP = newIP
                werft.log('certificate', `created new ip named ${namespace} and value: ${k3sWsProxyIP}`)
            }
        } catch (err) {
            werft.fail('certificate', err.toString())
        }
    }

    try {
        if (deploymentConfig.cleanSlateDeployment) {
            // re-create namespace
            await cleanStateEnv(metaEnv());
            if (k3sWsCluster) {
                await cleanStateEnv(k3sEnv());
            }
        } else {
            createNamespace(namespace, metaEnv({ slice: 'prep' }));
            if (k3sWsCluster) {
                createNamespace(namespace, k3sEnv({ slice: 'prep'}));
            }
        }
        // Now we want to execute further kubectl operations only in the created namespace
        setKubectlContextNamespace(namespace, metaEnv({ slice: 'prep' }));
        if (k3sWsCluster) {
            setKubectlContextNamespace(namespace, k3sEnv({ slice: 'prep'}));
        }

        // trigger certificate issuing
        werft.log('certificate', "organizing a certificate for the preview environment...");
        await issueMetaCerts(namespace, domain);
        await installMetaCertificates(namespace);
        if (k3sWsCluster) {
            await issueK3sWsCerts(k3sWsProxyIP);
            await installWsCertificates();
        }
        werft.done('certificate');

        werft.done('prep');
    } catch (err) {
        werft.fail('prep', err);
    }

    // core-dev specific section start
    werft.log("secret", "copy secret into namespace")
    try {
        const auth = exec(`echo -n "_json_key:$(kubectl get secret ${IMAGE_PULL_SECRET_NAME} --namespace=keys -o yaml \
                        | yq r - data['.dockerconfigjson'] \
                        | base64 -d)" | base64 -w 0`, { silent: true }).stdout.trim();
        fs.writeFileSync("chart/gcp-sa-registry-auth",
            `{
    "auths": {
        "eu.gcr.io": {
            "auth": "${auth}"
        }
    }
}`      );
        werft.done('secret');
    } catch (err) {
        werft.fail('secret', err);
    }

    werft.log("authProviders", "copy authProviders")
    try {
        exec(`kubectl get secret preview-envs-authproviders --namespace=keys -o yaml \
                | yq r - data.authProviders \
                | base64 -d -w 0 \
                > authProviders`, { slice: "authProviders" });
        exec(`yq merge --inplace .werft/values.dev.yaml ./authProviders`, { slice: "authProviders" })
        werft.done('authProviders');
    } catch (err) {
        werft.fail('authProviders', err);
    }
    // core-dev specific section end


    // If observability is enabled, we want to deploy it before installing Gitpod itself.
    // The reason behind it is because Gitpod components will start sending traces to a non-existent
    // OpenTelemetry-collector otherwise.
    werft.log(`observability`, "Running observability static checks.")
    observabilityStaticChecks()
    werft.log(`observability`, "Installing monitoring-satellite...")
    if (deploymentConfig.withObservability) {
        await installMonitoring();
        exec(`werft log result -d "Monitoring Satellite - Grafana" -c github-check-Grafana url https://grafana-${monitoringDomain}/dashboards`);
        exec(`werft log result -d "Monitoring Satellite - Prometheus" -c github-check-Prometheus url https://prometheus-${monitoringDomain}/graph`);
    } else {
        exec(`echo '"with-observability" annotation not set, skipping...'`, {slice: `observability`})
        exec(`echo 'To deploy monitoring-satellite, please add "/werft with-observability" to your PR description.'`, {slice: `observability`})
    }
    werft.done('observability');

    // deployment config
    try {
        shell.cd("/workspace/chart");
        werft.log('helm', 'installing Gitpod');

        const commonFlags = addDeploymentFlags();
        installGitpod(commonFlags);
        if (k3sWsCluster) {
            installGitpodOnK3sWsCluster(commonFlags, k3sWsProxyIP, k3sEnv());
        }

        werft.log('helm', 'done');
        werft.done('helm');
    } catch (err) {
        werft.fail('deploy', err);
    } finally {
        // produce the result independently of Helm succeding, so that in case Helm fails we still have the URL.
        exec(`werft log result -d "dev installation" -c github-check-preview-env url ${url}/projects`);
    }

    if (k3sWsCluster) {
        try {
            werft.phase(phases.REGISTER_K3S_WS_CLUSTER, "Register K3s ws cluster")
            await registerK3sWsCluster(namespace, domain);
        } catch (err) {
            werft.fail(phases.REGISTER_K3S_WS_CLUSTER, err.toString())
        }
    }

    function installGitpod(commonFlags: string) {
        let flags = commonFlags
        flags += ` --set components.wsDaemon.servicePort=${wsdaemonPortMeta}`;
        flags += ` --set components.registryFacade.ports.registry.servicePort=${registryNodePortMeta}`;

        const nodeAffinityValues = getNodeAffinities();

        if (storage === "gcp") {
            exec("kubectl get secret gcp-sa-gitpod-dev-deployer -n werft -o yaml | yq d - metadata | yq w - metadata.name remote-storage-gcloud | kubectl apply -f -");
            flags += ` -f ../.werft/values.dev.gcp-storage.yaml`;
        }

        /*  A hash is caclulated from the branch name and a subset of that string is parsed to a number x,
            x mod the number of different nodepool-sets defined in the files listed in nodeAffinityValues
            is used to generate a pseudo-random number that consistent as long as the branchname persists.
            We use it to reduce the number of preview-environments accumulating on a singe nodepool.
         */
        const nodepoolIndex = getNodePoolIndex(namespace);

        exec(`helm dependencies up`);
        exec(`/usr/local/bin/helm3 upgrade --install --timeout 10m -f ../.werft/${nodeAffinityValues[nodepoolIndex]} -f ../.werft/values.dev.yaml ${flags} ${helmInstallName} .`);
        exec(`kubectl apply -f ../.werft/jaeger.yaml`);

        werft.log('helm', 'installing Sweeper');
        const sweeperVersion = deploymentConfig.sweeperImage.split(":")[1];
        werft.log('helm', `Sweeper version: ${sweeperVersion}`);

        // prepare args
        const refsPrefix = "refs/heads/";
        const owner: string = context.Repository.owner;
        const repo: string = context.Repository.repo;
        let branch: string = context.Repository.ref;
        if (branch.startsWith(refsPrefix)) {
            branch = branch.substring(refsPrefix.length);
        }
        const args = {
            "period": "10m",
            "timeout": "48h",   // period of inactivity that triggers a removal
            branch,             // the branch to check for deletion
            owner,
            repo,
        };
        const argsStr = Object.entries(args).map(([k, v]) => `\"--${k}\", \"${v}\"`).join(", ");
        const allArgsStr = `--set args="{${argsStr}}" --set githubToken.secret=github-sweeper-read-branches --set githubToken.key=token`;

        // copy GH token into namespace
        exec(`kubectl --namespace werft get secret github-sweeper-read-branches -o yaml \
            | yq w - metadata.namespace ${namespace} \
            | yq d - metadata.uid \
            | yq d - metadata.resourceVersion \
            | yq d - metadata.creationTimestamp \
            | kubectl apply -f -`);
        exec(`/usr/local/bin/helm3 upgrade --install --set image.version=${sweeperVersion} --set command="werft run github -a namespace=${namespace} --remote-job-path .werft/wipe-devstaging.yaml github.com/gitpod-io/gitpod:main" ${allArgsStr} sweeper ../dev/charts/sweeper`);
    }

    function installGitpodOnK3sWsCluster(commonFlags: string, wsProxyIP: string, shellOpts: ExecOptions) {
        let flags = commonFlags
        flags += ` -f ../.werft/values.disableMeta.yaml`
        flags += ` --set components.wsDaemon.servicePort=${wsdaemonPortK3sWs}`;
        flags += ` --set components.registryFacade.ports.registry.servicePort=${registryNodePortK3sWs}`;
        flags += ` --set components.wsProxy.loadBalancerIP=${wsProxyIP}`;
        if (storage === "gcp") {
            // notice below that we are not using the k3s cluster to get the gcp-sa-gitpod-dev-deployer. As it is present in the dev cluster only
            exec("kubectl get secret gcp-sa-gitpod-dev-deployer -n werft -o yaml | yq d - metadata | yq w - metadata.name remote-storage-gcloud > remote-storage-gcloud.yaml", metaEnv(shellOpts));
            // After storing the yaml we apply it to the k3s cluster
            exec(`kubectl apply -f remote-storage-gcloud.yaml`, shellOpts)
            flags += ` -f ../.werft/values.dev.gcp-storage.yaml`;
        }

        werft.log("helm", "installing k3s ws cluster")
        exec(`helm dependencies up`, shellOpts);
        exec(`/usr/local/bin/helm3 upgrade --install --timeout 10m -f ../.werft/values.k3sWsCluster.yaml ${flags} ${helmInstallName} .`, shellOpts);
    }

    function addDeploymentFlags() {
        let flags = ""
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
            flags += ` -f ../.werft/values.variant.cpuLimits.yaml`;
        }
        if ((deploymentConfig.analytics || "").startsWith("segment|")) {
            flags += ` --set analytics.writer=segment`;
            flags += ` --set analytics.segmentKey=${deploymentConfig.analytics!.substring("segment|".length)}`;
        } else if (!!deploymentConfig.analytics) {
            flags += ` --set analytics.writer=${deploymentConfig.analytics!}`;
        }
        if (deploymentConfig.withObservability) {
            flags += ` -f ../.werft/values.tracing.yaml`;
        }
        werft.log("helm", "extracting versions");
        try {
            exec(`docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${version} cat /versions.yaml | tee versions.yaml`);
        } catch (err) {
            werft.fail('helm', err);
        }
        const pathToVersions = `${shell.pwd().toString()}/versions.yaml`;
        flags += ` -f ${pathToVersions}`;

        if (deploymentConfig.installEELicense) {
            // We're adding the license rather late just to prevent accidentially printing it.
            // If anyone got ahold of the license not much would be lost, but hey, no need to plaster it on the walls.
            flags += ` --set license=${fs.readFileSync('/mnt/secrets/gpsh-coredev/license').toString()}`
        }
        if (deploymentConfig.withPayment) {
            flags += ` -f ../.werft/values.payment.yaml`;
            exec(`cp /mnt/secrets/payment-provider-config/providerOptions payment-core-dev-options.json`);
            flags += ` --set payment.chargebee.providerOptionsFile=payment-core-dev-options.json`;
            exec(`cp /mnt/secrets/payment-webhook-config/webhook payment-core-dev-webhook.json`);
            flags += ` --set components.paymentEndpoint.webhookFile="payment-core-dev-webhook.json"`;
        }
        return flags;
    }

    async function cleanStateEnv(shellOpts: ExecOptions) {
        await wipeAndRecreateNamespace(helmInstallName, namespace, { ...shellOpts, slice: 'prep' });
        // cleanup non-namespace objects
        werft.log("predeploy cleanup", "removing old unnamespaced objects - this might take a while");
        try {
            await deleteNonNamespaceObjects(namespace, destname, { ...shellOpts, slice: 'predeploy cleanup' });
            werft.done('predeploy cleanup');
        } catch (err) {
            werft.fail('predeploy cleanup', err);
        }
    }

    async function installWsCertificates() {
        const wsInstallCertParams = new InstallCertificateParams()
        wsInstallCertParams.certName = namespace
        wsInstallCertParams.certNamespace = "certmanager"
        wsInstallCertParams.certSecretName = PROXY_SECRET_NAME
        wsInstallCertParams.destinationNamespace = namespace
        await installCertficate(werft, wsInstallCertParams, k3sEnv());
    }

    async function installMonitoring() {
        const installMonitoringSatelliteParams = new InstallMonitoringSatelliteParams();
        installMonitoringSatelliteParams.branch = context.Annotations.withObservabilityBranch || "main";
        installMonitoringSatelliteParams.pathToKubeConfig = ""
        installMonitoringSatelliteParams.satelliteNamespace = namespace
        installMonitoringSatelliteParams.clusterName = namespace
        installMonitoringSatelliteParams.nodeExporterPort = nodeExporterPort
        installMonitoringSatelliteParams.previewDomain = monitoringDomain
        await installMonitoringSatellite(installMonitoringSatelliteParams);
    }




    async function issueK3sWsCerts(ip: string) {
        let additionalSubdomains: string[] = ["reg.", "*.ws-k3s.", "ws-k3s."]
        var k3sClusterCertParams = new IssueCertificateParams();
        k3sClusterCertParams.pathToTerraform = "/workspace/.werft/certs";
        k3sClusterCertParams.gcpSaPath = GCLOUD_SERVICE_ACCOUNT_PATH;
        k3sClusterCertParams.namespace = namespace;
        k3sClusterCertParams.dnsZoneDomain = "gitpod-dev.com";
        k3sClusterCertParams.domain = domain;
        k3sClusterCertParams.certNamespace = "certmanager";
        k3sClusterCertParams.ip = ip; // the ip assigned to the ws-proxy
        k3sClusterCertParams.bucketPrefixTail = "-k3s-ws"
        k3sClusterCertParams.additionalSubdomains = additionalSubdomains
        await issueCertficate(werft, k3sClusterCertParams, k3sEnv());
    }

}

export async function issueMetaCerts(namespace: string, domain: string) {
    let additionalSubdomains: string[] = ["", "*.", "*.ws-dev."]
    var metaClusterCertParams = new IssueCertificateParams();
    metaClusterCertParams.pathToTerraform = "/workspace/.werft/certs";
    metaClusterCertParams.gcpSaPath = GCLOUD_SERVICE_ACCOUNT_PATH;
    metaClusterCertParams.namespace = namespace;
    metaClusterCertParams.certNamespace = "certs";
    metaClusterCertParams.dnsZoneDomain = "gitpod-dev.com";
    metaClusterCertParams.domain = domain;
    metaClusterCertParams.ip = getCoreDevIngressIP();
    metaClusterCertParams.bucketPrefixTail = ""
    metaClusterCertParams.additionalSubdomains = additionalSubdomains
    await issueCertficate(werft, metaClusterCertParams, metaEnv());
}

async function installMetaCertificates(namespace: string) {
    const certName = namespace;
    const metaInstallCertParams = new InstallCertificateParams()
    metaInstallCertParams.certName = certName
    metaInstallCertParams.certNamespace = "certs"
    metaInstallCertParams.certSecretName = PROXY_SECRET_NAME
    metaInstallCertParams.destinationNamespace = namespace
    await installCertficate(werft, metaInstallCertParams, metaEnv());
}

// returns the static IP address
function getCoreDevIngressIP(): string {
    return "104.199.27.246";
}

// returns the default K3s ws kubeconfig path
function getK3sWsKubeConfigPath(): string {
    return "/workspace/k3s-external.yaml";
}

/**
 * Trigger integration tests
 */
export async function triggerIntegrationTests(version: string, namespace: string, username: string, skip: boolean) {
    werft.phase(phases.TRIGGER_INTEGRATION_TESTS, "Trigger integration tests");

    if (skip) {
        // If we're skipping integration tests we wont trigger the job, which in turn won't create the
        // ci/werft/run-integration-tests Github Check. As ci/werft/run-integration-tests is a required
        // check this means you can't merge your PR without override checks.
        werft.log(phases.TRIGGER_INTEGRATION_TESTS, "Skipped integration tests")
        werft.done(phases.TRIGGER_INTEGRATION_TESTS);
        return
    }

    try {
        const imageVersion = exec(`docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${version} cat /versions.yaml | yq r - 'components.integrationTest.version'`, { silent: true })
            .stdout.trim();

        exec(`git config --global user.name "${username}"`);
        const annotations = [
            `version=${imageVersion}`,
            `namespace=${namespace}`,
            `username=${username}`,
            `updateGitHubStatus=gitpod-io/gitpod`
        ].map(annotation => `-a ${annotation}`).join(' ')
        exec(`werft run --remote-job-path .werft/run-integration-tests.yaml ${annotations} github`, { slice: phases.TRIGGER_INTEGRATION_TESTS }).trim();

        werft.done(phases.TRIGGER_INTEGRATION_TESTS);
    } catch (err) {
        werft.fail(phases.TRIGGER_INTEGRATION_TESTS, err);
    }
}

// Registers a WS cluster to the meta cluster
async function registerK3sWsCluster(namespace: string, domain: string) {
    const k3sOpts: ExecOptions = k3sEnv();
    const metaOpts: ExecOptions = metaEnv();

    // When we deploy the ws proxy then certs are not generate. So the pods could go into a long waiting state without kubelet reattempting to mount the volume
    // So, we just restart the deployment for secrets to be mounted.
    shell.exec(`kubectl rollout restart deploy ws-proxy -n ${namespace}`, k3sOpts),
    waitForDeploymentToSucceed("ws-proxy", namespace, "deploy", k3sOpts);

    // Following deployments must have succeede for us to register the cluster
    waitForDeploymentToSucceed("ws-manager-bridge", namespace, "deploy", metaOpts);
    waitForDeploymentToSucceed("ws-manager", namespace, "deploy", metaOpts);
    waitForDeploymentToSucceed("server", namespace, "deploy", metaOpts);

    // explicitly wait for 15s assuming the k3s service would have picked the new ws-proxy pod
    await sleep(15000);

    gpctl.buildGpctlBinary();

    const wsProxyUrl = `ws-k3s.${domain}:8081`;

    // list available clusters
    let returnedValue = gpctl.printClustersList(metaOpts);
    werft.log(phases.REGISTER_K3S_WS_CLUSTER, returnedValue);

    // get certificate of ws cluster
    returnedValue = gpctl.getClusterTLS(k3sOpts);
    werft.log(phases.REGISTER_K3S_WS_CLUSTER, returnedValue);

    // register the ws cluster
    returnedValue = gpctl.registerCluster("k3s", wsProxyUrl, metaOpts);
    werft.log(phases.REGISTER_K3S_WS_CLUSTER, returnedValue);

    // clear the constraint and uncordon
    returnedValue = gpctl.uncordonCluster("k3s", metaOpts);
    werft.log(phases.REGISTER_K3S_WS_CLUSTER, returnedValue);

    werft.phase(phases.REGISTER_K3S_WS_CLUSTER, "done");
}

/**
 * Publish Charts
 */
async function publishHelmChart(imageRepoBase: string, version: string) {
    werft.phase("publish-charts", "Publish charts");
    [
        "gcloud config set project gitpod-io",
        `leeway build --docker-build-options network=host -Dversion=${version} -DimageRepoBase=${imageRepoBase} --save helm-repo.tar.gz chart:helm`,
        "tar xzfv helm-repo.tar.gz",
        "mkdir helm-repo",
        "cp gitpod*tgz helm-repo/",
        "gsutil cp gs://charts-gitpod-io-public/index.yaml old-index.yaml",
        "cp gitpod*.tgz helm-repo/",
        "helm3 repo index --merge old-index.yaml helm-repo",
        "gsutil -m rsync -r helm-repo/ gs://charts-gitpod-io-public/"
    ].forEach(cmd => {
        exec(cmd, { slice: 'publish-charts' });
    });
}

/*  A hash is caclulated from the branch name and a subset of that string is parsed to a number x,
        x mod the number of different nodepool-sets defined in the files listed in nodeAffinityValues
        is used to generate a pseudo-random number that consistent as long as the branchname persists.
        We use it to reduce the number of preview-environments accumulating on a singe nodepool.
     */
function getNodePoolIndex(namespace: string): number {
    const nodeAffinityValues = getNodeAffinities();

    return parseInt(createHash('sha256').update(namespace).digest('hex').substring(0,5),16) % nodeAffinityValues.length;
}

function getNodeAffinities(): string[] {
    return [
        "values.nodeAffinities_1.yaml",
        "values.nodeAffinities_2.yaml",
        "values.nodeAffinities_0.yaml",
    ]
}

function metaEnv(_parent?: ExecOptions): ExecOptions {
    return env("", _parent);
}

function k3sEnv(_parent?: ExecOptions): ExecOptions {
    return env(getK3sWsKubeConfigPath(), _parent);
}
