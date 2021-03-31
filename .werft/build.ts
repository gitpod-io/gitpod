import * as shell from 'shelljs';
import * as fs from 'fs';
import { werft, exec, gitTag } from './util/shell';
import { wipeAndRecreateNamespace, setKubectlContextNamespace, deleteNonNamespaceObjects, findFreeHostPorts } from './util/kubectl';
import { issueCertficate, installCertficate } from './util/certs';
import { reportBuildFailureInSlack } from './util/slack';
import * as semver from 'semver';

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
    try {
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
        exec("gcloud auth configure-docker --quiet");
        exec('gcloud container clusters get-credentials dev --zone europe-west1-b --project gitpod-core-dev');
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
    const withIntegrationTests = buildConfig["with-integration-tests"] == "true";
    const publishToNpm = "publish-to-npm" in buildConfig || mainBuild;
    const analytics = buildConfig["analytics"];

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
        publishToNpm,
        analytics
    }));

    /**
     * Build
     */
    werft.phase("build", "build running");
    const imageRepo = publishRelease ? "gcr.io/gitpod-io/self-hosted" : "eu.gcr.io/gitpod-core-dev/build";

    exec(`LICENCE_HEADER_CHECK_ONLY=true leeway run components:update-license-header || { echo "[build|FAIL] There are some license headers missing. Please run 'leeway run components:update-license-header'."; exit 1; }`)
    exec(`leeway vet --ignore-warnings`);
    exec(`leeway build --werft=true -c ${cacheLevel} ${dontTest ? '--dont-test' : ''} -Dversion=${version} -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev dev:all`);
    if (publishRelease) {
        exec(`gcloud auth activate-service-account --key-file "/mnt/secrets/gcp-sa-release/service-account.json"`);
    }
    if (withInstaller || publishRelease) {
        exec(`leeway build --werft=true -c ${cacheLevel} ${dontTest ? '--dont-test' : ''} -Dversion=${version} -DimageRepoBase=${imageRepo} install:all`);
    }
    exec(`leeway build --werft=true -Dversion=${version} -DremoveSources=false -DimageRepoBase=${imageRepo} -DnpmPublishTrigger=${publishToNpm ? Date.now() : 'false'}`);
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
        analytics
    };
    await deployToDev(deploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage);

    if (withIntegrationTests) {
        exec(`git config --global user.name "${context.Owner}"`);
        exec(`werft run --follow-with-prefix="int-tests: " --remote-job-path .werft/run-integration-tests.yaml -a version=${deploymentConfig.version} -a namespace=${deploymentConfig.namespace} github`);
    }
}

interface DeploymentConfig {
    version: string;
    destname: string;
    namespace: string;
    domain: string;
    url: string;
    wsCluster?: PreviewWorkspaceClusterRef | undefined;
    withWsCluster?: PreviewWorkspaceClusterRef | undefined;
    analytics?: string;
}

/**
 * Deploy dev
 */
export async function deployToDev(deploymentConfig: DeploymentConfig, workspaceFeatureFlags, dynamicCPULimits, storage) {
    werft.phase("deploy", "deploying to dev");
    const { version, destname, namespace, domain, url, wsCluster, withWsCluster } = deploymentConfig;
    const [wsdaemonPort, registryProxyPort, registryNodePort] = findFreeHostPorts([
        { start: 10000, end: 11000 },
        { start: 20000, end: 21000 },
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
            const additionalWsSubdomains = withWsCluster ? [withWsCluster.shortname] : [];
            await issueCertficate(werft, ".werft/certs", GCLOUD_SERVICE_ACCOUNT_PATH, namespace, "gitpod-dev.com", domain, "34.76.116.244", additionalWsSubdomains);
        }

        werft.log('certificate', 'waiting for preview env namespace being re-created...');
        await namespaceRecreatedPromise;

        const fromNamespace = wsCluster ? wsCluster.namespace : namespace;
        await installCertficate(werft, fromNamespace, namespace, "proxy-config-certificates");
    })();


    // re-create namespace
    try {
        await wipeAndRecreateNamespace(helmInstallName, namespace, { slice: 'prep' });
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

    // cleanup non-namespace objects
    werft.log("predeploy cleanup", "removing old unnamespaced objects - this might take a while");
    try {
        deleteNonNamespaceObjects(namespace, destname, { slice: 'predeploy cleanup' })
        werft.done('predeploy cleanup');
    } catch (err) {
        werft.fail('predeploy cleanup', err);
    }

    // versions
    werft.log("deploy", "extracting versions");
    try {
        // TODO [geropl] versions is not a core component yet
        // exec(`docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${version} cat /versions.yaml | tee versions.yaml`);
        werft.done('deploy');
    } catch (err) {
        werft.fail('deploy', err);
    }

    // deployment config
    let flags = "";
    flags += ` --namespace ${namespace}`;
    flags += ` --set components.imageBuilder.hostDindData=/mnt/disks/ssd0/docker-${namespace}`;
    flags += ` --set version=${version}`;
    flags += ` --set hostname=${domain}`;
    flags += ` --set devBranch=${destname}`;
    flags += ` --set components.wsDaemon.servicePort=${wsdaemonPort}`;
    flags += ` --set components.wsDaemon.registryProxyPort=${registryProxyPort}`;
    flags += ` --set components.registryFacade.ports.registry.servicePort=${registryNodePort}`;
    workspaceFeatureFlags.forEach((f, i) => {
        flags += ` --set components.server.defaultFeatureFlags[${i}]='${f}'`
    })
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
        flags += ` --set analytics.segmentKey=${deploymentConfig.analytics!.substring("segment|".length)}`
    } else if (!!deploymentConfig.analytics) {
        flags += ` --set analytics.writer=${deploymentConfig.analytics!}`;
    }

    // const pathToVersions = `${shell.pwd().toString()}/versions.yaml`;
    // if (fs.existsSync(pathToVersions)) {
    //     flags+=` -f ${pathToVersions}`;
    // } else {
    //     werft.log(`versions file not found at '${pathToVersions}', not using it.`);
    // }
    if (!certificatePromise) {
        // it's not possible to set certificatesSecret={} so we set secretName to empty string
        flags += ` --set certificatesSecret.secretName=""`;
    }

    try {
        shell.cd("chart");
        werft.log('helm', 'installing Gitpod');

        if (storage === "gcp") {
            exec("kubectl get secret gcp-sa-cloud-storage-dev-sync-key -n werft -o yaml | yq d - metadata | yq w - metadata.name remote-storage-gcloud | kubectl apply -f -")
            flags += ` -f ../.werft/values.dev.gcp-storage.yaml`;
        }

        exec(`helm dependencies up`);
        exec(`/usr/local/bin/helm3 upgrade --install --timeout 10m -f ../.werft/values.dev.yaml ${flags} ${helmInstallName} .`);
        exec(`kubectl apply -f ../.werft/jaeger.yaml`);

        if (!wsCluster) {
            werft.log('helm', 'installing Sweeper');
            exec(`/usr/local/bin/helm3 upgrade --install --set image.version=${version} --set command="werft run github -a namespace=${namespace} --remote-job-path .werft/wipe-devstaging.yaml github.com/gitpod-io/gitpod:main" sweeper ../dev/charts/sweeper`);
        }

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
