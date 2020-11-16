const shell = require('shelljs');
const fs = require('fs');
const { werft, exec, gitTag } = require('./util/shell.js');
const { sleep } = require('./util/util.js');
const { recreateNamespace } = require('./util/kubectl.js');

const GCLOUD_SERVICE_ACCOUNT_PATH = "/mnt/secrets/gcp-sa/service-account.json";

const context = JSON.parse(fs.readFileSync('context.json'));

const version = parseVersion(context);
build(context, version)
    .catch((err) => process.exit(1));

function parseVersion(context) {
    let buildConfig = context.Annotations || {};
    const explicitVersion = buildConfig.version;
    if(explicitVersion) {
        return explicitVersion;
    }
    let version = context.Name;
    const PREFIX_TO_STRIP = "gitpod-build-";
    if (version.substr(0, PREFIX_TO_STRIP.length) === PREFIX_TO_STRIP) {
        version = version.substr(PREFIX_TO_STRIP.length);
    }
    return version
}

async function build(context, version) {
    /**
     * Prepare
     */
    werft.phase("prepare");
    let buildConfig = context.Annotations || {};
    try {
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
        exec("gcloud auth configure-docker --quiet");
        exec('gcloud container clusters get-credentials dev --zone europe-west1-b --project gitpod-core-dev');
        werft.done('prep');
    } catch (err) {
        werft.fail('prep', err);
    }
    const masterBuild = context.Repository.ref.includes("refs/heads/master");
    const dontTest = "no-test" in buildConfig;
    const cacheLevel = "no-cache" in buildConfig ? "remote-push" : "remote";
    const publishRelease = "publish-release" in buildConfig;
    const previewWithHttps = "https" in buildConfig;
    const workspaceFeatureFlags = (buildConfig["ws-feature-flags"] || "").split(",").map(e => e.trim())
    const dynamicCPULimits = "dynamic-cpu-limits" in buildConfig;
    const withInstaller = "with-installer" in buildConfig || masterBuild;
    werft.log("job config", JSON.stringify({
        buildConfig,
        version,
        masterBuild,
        dontTest,
        cacheLevel,
        publishRelease,
        previewWithHttps,
        workspaceFeatureFlags,
        dynamicCPULimits,
    }));

    /**
     * Build
     */
    werft.phase("build", "build running");
    // Build using the dev-http-cache gitpod-dev to make 'yarn install' more stable
    const buildEnv = {
        "HTTP_PROXY": "http://dev-http-cache:3129",
        "HTTPS_PROXY": "http://dev-http-cache:3129",
    };
    exec(`leeway vet --ignore-warnings`);
    exec(`leeway build --werft=true -c ${cacheLevel} ${dontTest ? '--dont-test':''} -Dversion=${version} -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev dev:all`, buildEnv);
    exec(`leeway build --werft=true -c ${cacheLevel} ${dontTest ? '--dont-test':''} -Dversion=${version} -DremoveSources=false -DimageRepoBase=eu.gcr.io/gitpod-core-dev/build`, buildEnv);
    if (withInstaller) {
        exec(`leeway build --werft=true -c ${cacheLevel} ${dontTest ? '--dont-test':''} -Dversion=${version} -DimageRepoBase=eu.gcr.io/gitpod-core-dev/build install:all`, buildEnv);
    }
    if (publishRelease) {
        exec(`gcloud auth activate-service-account --key-file "/mnt/secrets/gcp-sa-release/service-account.json"`);
        exec(`leeway build --werft=true -Dversion=${version} -DremoveSources=false -DimageRepoBase=eu.gcr.io/gitpod-io/self-hosted`, buildEnv);
        publishHelmChart("eu.gcr.io/gitpod-io/self-hosted");
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
    }
    // gitTag(`build/${version}`);

    // if (masterBuild) {
        /**
         * Deploy master
         * 
         * [cw] we don't have a core-staging environment (yet)
         */
        // exec(`git config --global user.name "${context.Owner}"`);
        // exec(`werft run --follow-with-prefix=deploy --remote-job-path .werft/deploy-staging.yaml -a version=${version} github`);
        // return;
    // }

    if ("no-preview" in buildConfig) {
        werft.phase("deploy", "not deploying");
        console.log("no-preview is set");
    } else {
        await deployToDev(version, previewWithHttps, workspaceFeatureFlags, dynamicCPULimits);
    }
}


/**
 * Deploy dev
 */
async function deployToDev(version, previewWithHttps, workspaceFeatureFlags, dynamicCPULimits) {
    werft.phase("deploy", "deploying to dev");
    const destname = version.split(".")[0];
    const namespace = `staging-${destname}`;
    const domain = `${destname}.staging.gitpod-dev.com`;
    const url = `${!!previewWithHttps ? "https" : "http"}://${domain}`;
    const wsdaemonPort = `1${Math.floor(Math.random()*1000)}`;
    const registryProxyPort = `2${Math.floor(Math.random()*1000)}`;
    const registryNodePort = `${30000 + Math.floor(Math.random()*1000)}`;

    try {
        const objs = shell
            .exec(`kubectl get pod -l component=workspace --namespace ${namespace} --no-headers -o=custom-columns=:metadata.name`)
            .split("\n")
            .map(o => o.trim())
            .filter(o => o.length > 0);

        objs.forEach(o => {
            werft.log("prep", `deleting workspace ${o}`);
            exec(`kubectl delete pod --namespace ${namespace} ${o}`, {slice: 'prep'});
        });

        recreateNamespace(namespace, {slice: 'prep'});
        [
            "kubectl config current-context",
            `kubectl config set-context --current --namespace=${namespace}`
        ].forEach(cmd => exec(cmd, {slice: 'prep'}));
        werft.done('prep');
    } catch (err) {
        werft.fail('prep', err);
    }

    werft.log("secret", "copy secret into namespace")
    try {
        const auth = exec(`echo -n "_json_key:$(kubectl get secret gcp-sa-registry-auth --namespace=keys --export -o yaml \
                        | yq r - data['.dockerconfigjson'] \
                        | base64 -d)" | base64 -w 0`, {silent: true}).stdout.trim();
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
        exec(`kubectl get secret preview-envs-authproviders --namespace=keys --export -o yaml \
                | yq r - data.authProviders \
                | base64 -d -w 0 \
                > authProviders`, {silent: true}).stdout.trim();
        exec(`yq merge --inplace .werft/values.dev.yaml ./authProviders`)
        werft.done('authProviders');
    } catch (err) {
        werft.fail('authProviders', err);
    }

    let certificatePromise = undefined;
    if (previewWithHttps) {
        // TODO [geropl] Now that the certs reside in a separate namespaces, start the actual certificate issuing _before_ the namespace cleanup
        werft.log('certificate', "organizing a certificate for the preview environment...");
        certificatePromise = issueAndInstallCertficate(namespace, domain);
    }

    werft.log("predeploy cleanup", "removing old unnamespaced objects - this might take a while");
    try {
        exec(`/usr/local/bin/helm3 delete gitpod-${destname} || echo gitpod-${destname} was not installed yet`, {slice: 'predeploy cleanup'});
        exec(`/usr/local/bin/helm3 delete jaeger-${destname} || echo jaeger-${destname} was not installed yet`, {slice: 'predeploy cleanup'});

        let objs = [];
        ["ws-scheduler", "node-daemon", "cluster", "workspace", "jaeger", "jaeger-agent", "ws-sync", "ws-manager-node", "ws-daemon"].forEach(comp => 
            ["ClusterRole", "ClusterRoleBinding", "PodSecurityPolicy"].forEach(kind =>
                shell
                    .exec(`kubectl get ${kind} -l component=${comp} --no-headers -o=custom-columns=:metadata.name | grep ${namespace}-ns`)
                    .split("\n")
                    .map(o => o.trim())
                    .filter(o => o.length > 0)
                    .forEach(obj => objs.push({ 'kind': kind, 'obj': obj }))
            )
        )

        objs.forEach(o => {
            werft.log("predeploy cleanup", `deleting old ${o.kind} ${o.obj}`);
            exec(`kubectl delete ${o.kind} ${o.obj}`, {slice: 'predeploy cleanup'});
        });
        werft.done('predeploy cleanup');
    } catch (err) {
        werft.fail('predeploy cleanup', err);
    }

    werft.log("deploy", "extracting versions");
    try {
        // TODO [geropl] versions is not a core component yet
        // exec(`docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${version} cat /versions.yaml | tee versions.yaml`);
        werft.done('deploy');
    } catch (err) {
        werft.fail('deploy', err);
    }

    let flags = "";
    flags+=` --namespace ${namespace}`;
    flags+=` --set components.imageBuilder.hostDindData=/mnt/disks/ssd0/docker-${namespace}`;
    flags+=` --set version=${version}`;
    flags+=` --set hostname=${domain}`;
    flags+=` --set devBranch=${destname}`;
    flags+=` --set components.wsDaemon.servicePort=${wsdaemonPort}`;
    flags+=` --set components.wsDaemon.registryProxyPort=${registryProxyPort}`;
    flags+=` --set components.registryFacade.ports.registry.servicePort=${registryNodePort}`;
    flags+=` --set ingressMode=${context.Annotations.ingressMode || "hosts"}`;
    workspaceFeatureFlags.forEach((f, i) => {
        flags+=` --set components.server.defaultFeatureFlags[${i}]='${f}'`
    })
    if (dynamicCPULimits) {
        flags+=` -f ../.werft/values.variant.cpuLimits.yaml`;
    }
    // const pathToVersions = `${shell.pwd().toString()}/versions.yaml`;
    // if (fs.existsSync(pathToVersions)) {
    //     flags+=` -f ${pathToVersions}`;
    // } else {
    //     werft.log(`versions file not found at '${pathToVersions}', not using it.`);
    // }
    if (!certificatePromise) {
        // it's not possible to set certificatesSecret={} so we set secretName to empty string
        flags+=` --set certificatesSecret.secretName=""`;
    }
    
    try {
        shell.cd("chart");
        werft.log('helm', 'installing Gitpod');
        
        exec(`helm dependencies up`);
        exec(`/usr/local/bin/helm3 upgrade --install --timeout 10m -f ../.werft/values.dev.yaml ${flags} gitpod .`);

        werft.log('helm', 'installing Jaeger');
        exec(`/usr/local/bin/helm3 upgrade --install -f ../dev/charts/jaeger/values.yaml ${flags} jaeger ../dev/charts/jaeger`);
        werft.log('helm', 'installing Sweeper');
        exec(`/usr/local/bin/helm3 upgrade --install --set image.version=${version} --set command="werft run github -a namespace=${namespace} --remote-job-path .werft/wipe-devstaging.yaml github.com/gitpod-io/gitpod:master" sweeper ../dev/charts/sweeper`);

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
            werft.fail('certificate', err);
        }
    }
}

async function issueAndInstallCertficate(namespace, domain) {
    // Always use 'terraform apply' to make sure the certificate is present and up-to-date
    await exec(`set -x \
        && cd .werft/certs \
        && terraform init \
        && export GOOGLE_APPLICATION_CREDENTIALS="${GCLOUD_SERVICE_ACCOUNT_PATH}" \
        && terraform apply -auto-approve \
            -var 'namespace=${namespace}' \
            -var 'dns_zone_domain=gitpod-dev.com' \
            -var 'domain=${domain}' \
            -var 'public_ip=34.76.116.244' \
            -var 'subdomains=["", "*.", "*.ws-dev."]'`, {slice: 'certificate', async: true});

    werft.log('certificate', `waiting until certificate certs/${namespace} is ready...`)
    let notReadyYet = true;
    while (notReadyYet) {
        werft.log('certificate', `polling state of certs/${namespace}...`)
        const result = exec(`kubectl -n certs get certificate ${namespace} -o jsonpath="{.status.conditions[?(@.type == 'Ready')].status}"`, { silent: true, dontCheckRc: true });
        if (result.code === 0 && result.stdout === "True") {
            notReadyYet = false;
            break;
        }

        sleep(5000);
    }

    werft.log('certificate', `copying certificate from "certs/${namespace}" to "${namespace}/proxy-config-certificates"`);
    // certmanager is configured to create a secret in the namespace "certs" with the name "${namespace}".
    exec(`kubectl get secret ${namespace} --namespace=certs --export -o yaml \
        | sed 's/${namespace}/proxy-config-certificates/g' \
        | kubectl apply --namespace=${namespace} -f -`);
}

/**
 * Publish Charts
 */
async function publishHelmChart(imageRepoBase) {
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
        exec(cmd, {slice: 'publish-charts'});
    });
}

module.exports = {
    parseVersion,
    build,
    issueAndInstallCertficate,
    deployToDev
}