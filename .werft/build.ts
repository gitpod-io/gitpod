import * as shell from 'shelljs';
import * as fs from 'fs';
import { werft, exec, gitTag } from './util/shell';
import { wipeAndRecreateNamespace, setKubectlContextNamespace, deleteNonNamespaceObjects, findFreeHostPorts, createNamespace } from './util/kubectl';
import { issueCertficate, installCertficate, IssueCertificateParams, InstallCertificateParams } from './util/certs';
import { reportBuildFailureInSlack } from './util/slack';
import * as semver from 'semver';
import * as util from 'util';


const readDir = util.promisify(fs.readdir)

const GCLOUD_SERVICE_ACCOUNT_PATH = "/mnt/secrets/gcp-sa/service-account.json";

const context = JSON.parse(fs.readFileSync('context.json').toString());

const version = parseVersion(context);
build(context, version)
    .catch((err) => {
        if (context.Repository.ref === "refs/heads/main") {
            reportBuildFailureInSlack(context, err, () => process.exit(1));
        } else {
            process.exit(1);
        }
    });

// Werft phases
const phases = {
    TRIGGER_INTEGRATION_TESTS: 'trigger integration tests'
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
        exec(`pre-commit run --from-ref origin/HEAD --to-ref HEAD`);
        werft.result("validate changes", "github-check-changes", "conclusion success");
        werft.done('validate-changes');
    } catch (err) {
        werft.result("validate changes", "github-check-changes", "conclusion failure");
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
        exec('gcloud container clusters get-credentials dev --zone europe-west1-b --project gitpod-core-dev');

        if (k3sWsCluster) {
            // get and store the ws clsuter kubeconfig to root of the project
            shell.exec("kubectl get secret k3sdev -n werft -o=go-template='{{index .data \"k3s-external.yaml\"}}' | base64 -d > k3s-external.yaml").trim()
        }
        werft.done('prep');
    } catch (err) {
        werft.fail('prep', err);
    }
    const repo = `${context.Repository.host}/${context.Repository.owner}/${context.Repository.repo}`;
    const mainBuild = repo === "github.com/gitpod-io/gitpod" && context.Repository.ref.includes("refs/heads/main");
    const dontTest = "no-test" in buildConfig;
    const cacheLevel = "no-cache" in buildConfig ? "remote-push" : "remote";
    const publishRelease = "publish-release" in buildConfig;
    const workspaceFeatureFlags = (buildConfig["ws-feature-flags"] || "").split(",").map(e => e.trim())
    const dynamicCPULimits = "dynamic-cpu-limits" in buildConfig;
    const withInstaller = "with-installer" in buildConfig || mainBuild;
    const noPreview = "no-preview" in buildConfig || publishRelease;
    const storage = buildConfig["storage"] || "";
    const withIntegrationTests = "with-integration-tests" in buildConfig;
    const publishToNpm = "publish-to-npm" in buildConfig || mainBuild;
    const analytics = buildConfig["analytics"];
    const localAppVersion = mainBuild || ("with-localapp-version" in buildConfig) ? version : "unknown";
    const retag = ("with-retag" in buildConfig) ? "" : "--dont-retag";
    const cleanSlateDeployment = mainBuild || ("with-clean-slate-deployment" in buildConfig);
    const installEELicense = !("without-ee-license" in buildConfig);
    const withWsCluster = parseWsCluster(buildConfig["with-ws-cluster"]);   // e.g., "dev2|gpl-ws-cluster-branch": prepares this branch to host (an additional) workspace cluster
    const wsCluster = parseWsCluster(buildConfig["as-ws-cluster"]);         // e.g., "dev2|gpl-fat-cluster-branch": deploys this build as so that it is available under that subdomain as that cluster

    werft.log("job config", JSON.stringify({
        buildConfig,
        version,
        mainBuild,
        dontTest,
        cacheLevel,
        publishRelease,
        workspaceFeatureFlags,
        dynamicCPULimits,
        noPreview,
        storage: storage,
        withIntegrationTests,
        withWsCluster,
        wsCluster,
        k3sWsCluster,
        publishToNpm,
        analytics,
        localAppVersion,
        retag,
        cleanSlateDeployment,
        installEELicense,
    }));

    /**
     * Build
     */
    werft.phase("build", "build running");
    const imageRepo = publishRelease ? "gcr.io/gitpod-io/self-hosted" : "eu.gcr.io/gitpod-core-dev/build";

    const coverageOutput = exec("mktemp -d", { silent: true }).stdout.trim();

    exec(`LICENCE_HEADER_CHECK_ONLY=true leeway run components:update-license-header || { echo "[build|FAIL] There are some license headers missing. Please run 'leeway run components:update-license-header'."; exit 1; }`)
    exec(`leeway vet --ignore-warnings`);
    exec(`leeway build --werft=true -c ${cacheLevel} ${dontTest ? '--dont-test' : ''} --dont-retag --coverage-output-path=${coverageOutput} --save /tmp/dev.tar.gz -Dversion=${version} -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev dev:all`);
    const sweeperImage = exec(`tar xfO /tmp/dev.tar.gz ./sweeper.txt`).stdout.trim();
    if (publishRelease) {
        exec(`gcloud auth activate-service-account --key-file "/mnt/secrets/gcp-sa-release/service-account.json"`);
    }
    if (withInstaller || publishRelease) {
        exec(`leeway build --werft=true -c ${cacheLevel} ${dontTest ? '--dont-test' : ''} -Dversion=${version} -DimageRepoBase=${imageRepo} install:all`);
    }
    exec(`leeway build --werft=true -c ${cacheLevel} ${retag} --coverage-output-path=${coverageOutput} -Dversion=${version} -DremoveSources=false -DimageRepoBase=${imageRepo} -DlocalAppVersion=${localAppVersion} -DnpmPublishTrigger=${publishToNpm ? Date.now() : 'false'}`);
    if (publishRelease) {
        try {
            werft.phase("publish", "checking version semver compliance...");
            if (!semver.valid(version)) {
                // make this an explicit error as early as possible. Is required by helm Charts.yaml/version
                throw new Error(`'${version}' is not semver compliant and thus cannot used for Self-Hosted releases!`)
            }

            werft.phase("publish", "publishing docker images...");
            exec(`leeway run --werft=true install/installer:publish-as-latest -Dversion=${version} -DimageRepoBase=${imageRepo}`);

            werft.phase("publish", "publishing Helm chart...");
            publishHelmChart("gcr.io/gitpod-io/self-hosted", version);

            werft.phase("publish", `preparing GitHub release files...`);
            const releaseFilesTmpDir = exec("mktemp -d", { silent: true }).stdout.trim();
            const releaseTarName = "release.tar.gz";
            exec(`leeway build --werft=true chart:release-tars -Dversion=${version} -DimageRepoBase=${imageRepo} --save ${releaseFilesTmpDir}/${releaseTarName}`);
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
            exec(`codecov -N "${parent_commit}" --flags=${flag} --file "${coverageOutput}/${file}"`);
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
    const url = `https://${domain}`;
    const deploymentConfig = {
        version,
        destname,
        namespace,
        domain,
        url,
        wsCluster,
        withWsCluster,
        analytics,
        cleanSlateDeployment,
        sweeperImage,
        installEELicense,
        k3sWsCluster,
    };
    await deployToDev(deploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage);
    await triggerIntegrationTests(deploymentConfig.version, deploymentConfig.namespace, context.Owner, !withIntegrationTests)
}

interface DeploymentConfig {
    version: string;
    destname: string;
    namespace: string;
    domain: string;
    url: string;
    wsCluster?: PreviewWorkspaceClusterRef | undefined;
    withWsCluster?: PreviewWorkspaceClusterRef | undefined;
    k3sWsCluster?: boolean;
    analytics?: string;
    cleanSlateDeployment: boolean;
    sweeperImage: string;
    installEELicense: boolean;
}

/**
 * Deploy dev
 */
export async function deployToDev(deploymentConfig: DeploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage) {
    werft.phase("deploy", "deploying to dev");
    const { version, destname, namespace, domain, url, wsCluster, withWsCluster, k3sWsCluster } = deploymentConfig;
    const [wsdaemonPort, registryNodePort] = findFreeHostPorts("", [
        { start: 10000, end: 11000 },
        { start: 30000, end: 31000 },
    ], 'hostports');
    const helmInstallName = "gitpod";

    // trigger certificate issuing
    werft.log('certificate', "organizing a certificate for the preview environment...");
    let namespaceRecreatedResolve = undefined;
    let namespaceRecreatedPromise = new Promise((resolve) => {
        namespaceRecreatedResolve = resolve;
    });
    const certificatePromise = (async function () {
        if (!wsCluster) {
            await issueMetaCerts();
        }
        if (k3sWsCluster) {
            await issueK3sWsCerts();
        }

        werft.log('certificate', 'waiting for preview env namespace being re-created...');
        await namespaceRecreatedPromise;

        await installMetaCertificates();

        if (k3sWsCluster) {
            await installWsCertificates();
        }

    })();

    try {
        if (deploymentConfig.cleanSlateDeployment) {
            // re-create namespace
            await cleanStateEnv("");

        } else {
            createNamespace("", namespace, { slice: 'prep' });
        }
        // check how this affects further steps
        setKubectlContextNamespace(namespace, { slice: 'prep' });
        namespaceRecreatedResolve();    // <-- signal for certificate
        werft.done('prep');
    } catch (err) {
        werft.fail('prep', err);
    }

    // core-dev specific section start
    werft.log("secret", "copy secret into namespace")
    try {
        const auth = exec(`echo -n "_json_key:$(kubectl get secret gcp-sa-registry-auth --namespace=keys -o yaml \
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

    // deployment config
    let commonFlags = addDeploymentFlags();

    try {
        shell.cd("chart");
        werft.log('helm', 'installing Gitpod');

        installGitpod(commonFlags);
        installGitpodOnK3sWsCluster(commonFlags, "/workspace/k3s-external.yaml");

        werft.log('helm', 'done');
        werft.done('helm');
    } catch (err) {
        werft.fail('deploy', err);
    } finally {
        // produce the result independently of Helm succeding, so that in case Helm fails we still have the URL.
        exec(`werft log result -d "dev installation" -c github url ${url}/workspaces/`);
    }

    if (certificatePromise) {
        // Delay success until certificate is actually present
        werft.log('certificate', "awaiting promised certificate")
        try {
            await certificatePromise;
            werft.done('certificate');
        } catch (err) {
            werft.log('certificate', err.toString());  // This ensures the err message is picked up by the werft UI
            werft.fail('certificate', err);
        }
    }

    function installGitpod(commonFlags: string) {
        let flags = commonFlags
        if (storage === "gcp") {
            exec("kubectl get secret gcp-sa-cloud-storage-dev-sync-key -n werft -o yaml | yq d - metadata | yq w - metadata.name remote-storage-gcloud | kubectl apply -f -");
            flags += ` -f ../.werft/values.dev.gcp-storage.yaml`;
        }

        exec(`helm dependencies up`);
        exec(`/usr/local/bin/helm3 upgrade --install --timeout 10m -f ../.werft/values.dev.yaml ${flags} ${helmInstallName} .`);
        exec(`kubectl apply -f ../.werft/jaeger.yaml`);

        if (!wsCluster) {
            werft.log('helm', 'installing Sweeper');
            const sweeperVersion = deploymentConfig.sweeperImage.split(":")[1];
            werft.log('helm', `Sweeper version: ${sweeperVersion}`);
            exec(`/usr/local/bin/helm3 upgrade --install --set image.version=${sweeperVersion} --set command="werft run github -a namespace=${namespace} --remote-job-path .werft/wipe-devstaging.yaml github.com/gitpod-io/gitpod:main" sweeper ../dev/charts/sweeper`);
        }
    }

    function installGitpodOnK3sWsCluster(commonFlags: string, pathToKubeConfig: string) {
        if (!k3sWsCluster) {
            return
        }
        let flags = commonFlags
        flags += ` -f ../.werft/values.k3sWsCluster.yaml`;
        if (storage === "gcp") {
            // notice below that we are not using the k3s cluster to get the gcp-sa-cloud-storage-dev-sync-key. As it is present in the dev cluster only
            exec("kubectl get secret gcp-sa-cloud-storage-dev-sync-key -n werft -o yaml | yq d - metadata | yq w - metadata.name remote-storage-gcloud > remote-storage-gcloud.yaml");
            // After storing the yaml we apply it to the k3s cluster
            exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl apply -f remote-storage-gcloud.yaml`)
            flags += ` -f ../.werft/values.dev.gcp-storage.yaml`;
        }

        exec(`export KUBECONFIG=${pathToKubeConfig} && helm dependencies up`);
        exec(`export KUBECONFIG=${pathToKubeConfig} && /usr/local/bin/helm3 upgrade --install --timeout 10m -f ../.werft/values.dev.yaml ${flags} ${helmInstallName} .`);
        // exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl apply -f ../.werft/jaeger.yaml`);
    }

    function addDeploymentFlags() {
        let flags = ""
        flags += ` --namespace ${namespace}`;
        flags += ` --set components.imageBuilder.hostDindData=/mnt/disks/ssd0/docker-${namespace}`;
        flags += ` --set version=${version}`;
        flags += ` --set hostname=${domain}`;
        flags += ` --set devBranch=${destname}`;
        flags += ` --set components.wsDaemon.servicePort=${wsdaemonPort}`;
        flags += ` --set components.registryFacade.ports.registry.servicePort=${registryNodePort}`;
        workspaceFeatureFlags.forEach((f, i) => {
            flags += ` --set components.server.defaultFeatureFlags[${i}]='${f}'`;
        });
        if (dynamicCPULimits) {
            flags += ` -f ../.werft/values.variant.cpuLimits.yaml`;
        }
        if (withWsCluster) {
            // Create redirect ${withWsCluster.shortname} -> ws-proxy.${wsCluster.dstNamespace}
            flags += ` --set components.proxy.withWsCluster.shortname=${withWsCluster.shortname}`;
            flags += ` --set components.proxy.withWsCluster.namespace=${withWsCluster.namespace}`;
        }
        if (wsCluster) {
            flags += ` --set hostname=${wsCluster.domain}`;
            flags += ` --set installation.shortname=${wsCluster.shortname}`;

            flags += ` -f ../.werft/values.wsCluster.yaml`;
        }
        if ((deploymentConfig.analytics || "").startsWith("segment|")) {
            flags += ` --set analytics.writer=segment`;
            flags += ` --set analytics.segmentKey=${deploymentConfig.analytics!.substring("segment|".length)}`;
        } else if (!!deploymentConfig.analytics) {
            flags += ` --set analytics.writer=${deploymentConfig.analytics!}`;
        }

        werft.log("helm", "extracting versions");
        try {
            exec(`docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${version} cat /versions.yaml | tee versions.yaml`);
        } catch (err) {
            werft.fail('helm', err);
        }
        const pathToVersions = `${shell.pwd().toString()}/versions.yaml`;
        flags += ` -f ${pathToVersions}`;

        if (!certificatePromise) {
            // it's not possible to set certificatesSecret={} so we set secretName to empty string
            flags += ` --set certificatesSecret.secretName=""`;
        }

        if (deploymentConfig.installEELicense) {
            // We're adding the license rather late just to prevent accidentially printing it.
            // If anyone got ahold of the license not much would be lost, but hey, no need to plaster it on the walls.
            flags += ` --set license=${fs.readFileSync('/mnt/secrets/gpsh-coredev/license').toString()}`
        }
        return flags;
    }

    async function cleanStateEnv(pathToKubeConfig: string) {
        await wipeAndRecreateNamespace(pathToKubeConfig, helmInstallName, namespace, { slice: 'prep' });
        // cleanup non-namespace objects
        werft.log("predeploy cleanup", "removing old unnamespaced objects - this might take a while");
        try {
            deleteNonNamespaceObjects(pathToKubeConfig, namespace, destname, { slice: 'predeploy cleanup' });
            werft.done('predeploy cleanup');
        } catch (err) {
            werft.fail('predeploy cleanup', err);
        }
    }

    async function installMetaCertificates() {
        const certName = wsCluster ? wsCluster.namespace : namespace;
        const metaInstallCertParams = new InstallCertificateParams()
        metaInstallCertParams.certName = certName
        metaInstallCertParams.certNamespace = "certs"
        metaInstallCertParams.certSecretName = "proxy-config-certificates"
        metaInstallCertParams.destinationNamespace = namespace
        metaInstallCertParams.pathToKubeConfig = ""
        await installCertficate(werft, metaInstallCertParams);
    }

    async function installWsCertificates() {
        const wsInstallCertParams = new InstallCertificateParams()
        wsInstallCertParams.certName = namespace
        wsInstallCertParams.certNamespace = "certmanager"
        wsInstallCertParams.certSecretName = "proxy-config-certificates"
        wsInstallCertParams.destinationNamespace = namespace
        wsInstallCertParams.pathToKubeConfig = "/workspace/k3s-external.yaml"
        await installCertficate(werft, wsInstallCertParams);
    }


    async function issueMetaCerts() {
        var additionalWsSubdomains = withWsCluster ? [withWsCluster.shortname] : [];
        var metaClusterParams = new IssueCertificateParams();
        metaClusterParams.pathToTerraform = "/workspace/.werft/certs";
        metaClusterParams.gcpSaPath = GCLOUD_SERVICE_ACCOUNT_PATH;
        metaClusterParams.namespace = namespace;
        metaClusterParams.certNamespace = "certs";
        metaClusterParams.dnsZoneDomain = "gitpod-dev.com";
        metaClusterParams.domain = domain;
        metaClusterParams.ip = "34.76.116.244";
        metaClusterParams.additionalWsSubdomains = additionalWsSubdomains;
        metaClusterParams.includeDefaults = true;
        metaClusterParams.pathToKubeConfig = "";
        metaClusterParams.bucketPrefixTail = ""
        await issueCertficate(werft, metaClusterParams);
    }

    async function issueK3sWsCerts() {
        var additionalWsSubdomains = ["k3s"];
        var metaClusterParams = new IssueCertificateParams();
        metaClusterParams.pathToTerraform = "/workspace/.werft/certs";
        metaClusterParams.gcpSaPath = GCLOUD_SERVICE_ACCOUNT_PATH;
        metaClusterParams.namespace = namespace;
        metaClusterParams.dnsZoneDomain = "gitpod-dev.com";
        metaClusterParams.domain = domain;
        metaClusterParams.certNamespace = "certmanager";
        metaClusterParams.ip = "34.79.158.226"; // External ip of ingress service in k3s cluster
        metaClusterParams.additionalWsSubdomains = additionalWsSubdomains;
        metaClusterParams.includeDefaults = false;
        metaClusterParams.pathToKubeConfig = "/workspace/k3s-external.yaml";
        metaClusterParams.bucketPrefixTail = "-k3s-ws"
        await issueCertficate(werft, metaClusterParams);
    }
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

interface PreviewWorkspaceClusterRef {
    shortname: string;
    subdomain: string;
    namespace: string;
    domain: string;
}
function parseWsCluster(rawString: string): PreviewWorkspaceClusterRef | undefined {
    if (rawString) {
        let parts = rawString.split("|");
        if (parts.length !== 2) {
            throw new Error("'as-|with-ws-cluster' must be of the form 'dev2|gpl-my-branch'!");
        }
        const shortname = parts[0];
        const subdomain = parts[1];
        return {
            shortname,
            subdomain,
            namespace: `staging-${subdomain}`,
            domain: `${subdomain}.staging.gitpod-dev.com`,
        }
    }
    return undefined;
}


/**
 * Publish Charts
 */
async function publishHelmChart(imageRepoBase, version) {
    werft.phase("publish-charts", "Publish charts");
    [
        "gcloud config set project gitpod-io",
        `leeway build -Dversion=${version} -DimageRepoBase=${imageRepoBase} --save helm-repo.tar.gz chart:helm`,
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
