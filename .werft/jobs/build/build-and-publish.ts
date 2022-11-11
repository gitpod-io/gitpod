import * as semver from "semver";
import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { GCLOUD_SERVICE_ACCOUNT_PATH } from "./const";
import { JobConfig } from "./job-config";

const phases = {
    PUBLISH_KOTS: "publish kots",
};

const REPLICATED_DIR = "./install/kots";
const REPLICATED_YAML_DIR = `${REPLICATED_DIR}/manifests`;
const INSTALLER_JOB_IMAGE = "spec.template.spec.containers[0].image";

export async function buildAndPublish(werft: Werft, jobConfig: JobConfig) {
    const {
        publishRelease,
        dontTest,
        version,
        localAppVersion,
        publishToNpm,
        coverageOutput,
    } = jobConfig;

    const releaseBranch = jobConfig.repository.ref;

    // We set it to false as default and only set it true if the build succeeds.
    werft.rootSpan.setAttributes({ "preview.gitpod_built_successfully": false });

    werft.phase("build", "build running");
    const imageRepo = publishRelease ? "gcr.io/gitpod-io/self-hosted" : "eu.gcr.io/gitpod-core-dev/build";

    exec(
        `LICENCE_HEADER_CHECK_ONLY=true leeway run components:update-license-header || { echo "[build|FAIL] There are some license headers missing. Please run 'leeway run components:update-license-header'."; exit 1; }`,
    );

    exec(
        `leeway build --docker-build-options network=host --werft=true -c remote ${
            dontTest ? "--dont-test" : ""
        } --coverage-output-path=${coverageOutput} --save /tmp/dev.tar.gz -Dversion=${version} -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev dev:all`,
    );

    if (publishRelease) {
        exec(`gcloud auth activate-service-account --key-file "/mnt/secrets/gcp-sa-release/service-account.json"`);
    }

    const buildArguments = Object.entries({
        version: version,
        removeSources: "false",
        imageRepoBase: imageRepo,
        localAppVersion: localAppVersion,
        SEGMENT_IO_TOKEN: process.env.SEGMENT_IO_TOKEN,
        REPLICATED_API_TOKEN: process.env.REPLICATED_API_TOKEN,
        REPLICATED_APP: process.env.REPLICATED_APP,
        npmPublishTrigger: publishToNpm ? Date.now().toString() : "false",
    }).map(([key, value]) => `-D${key}=${value}`).join(" ");

    const buildFlags = [
        "--docker-build-options network=host",
        "--werft=true",
        "-c remote",
        dontTest ? "--dont-test" : "",
        `--coverage-output-path=${coverageOutput}`,
    ].filter((value) => value).join(" ");

    await exec(`leeway build ${buildFlags} ${buildArguments}`, { async: true });

    if (jobConfig.withLocalPreview) {
        await exec(`leeway build install/preview:docker ${buildFlags} ${buildArguments}`, { async: true });
    }

    if (publishRelease) {
        try {
            werft.phase("publish", "checking version semver compliance...");
            if (!semver.valid(version)) {
                // make this an explicit error as early as possible. Is required by helm Charts.yaml/version
                throw new Error(
                    `'${version}' is not semver compliant and thus cannot be used for Self-Hosted releases!`,
                );
            }

            werft.phase("publish", "publishing Helm chart...");
            publishHelmChart(werft, "gcr.io/gitpod-io/self-hosted", version);

            werft.phase("publish", `preparing GitHub release files...`);
            const releaseFilesTmpDir = exec("mktemp -d", { silent: true }).stdout.trim();
            const releaseTarName = "release.tar.gz";
            exec(
                `leeway build --docker-build-options network=host --werft=true chart:release-tars -Dversion=${version} -DimageRepoBase=${imageRepo} --save ${releaseFilesTmpDir}/${releaseTarName}`,
            );
            exec(`cd ${releaseFilesTmpDir} && tar xzf ${releaseTarName} && rm -f ${releaseTarName}`);

            werft.phase("publish", `publishing GitHub release ${version}...`);
            const prereleaseFlag = semver.prerelease(version) !== null ? "-prerelease" : "";
            const tag = `v${version}`;
            const description = `Gitpod Self-Hosted ${version}<br/><br/>Docs: https://www.gitpod.io/docs/self-hosted/latest/self-hosted/`;
            exec(
                `github-release ${prereleaseFlag} gitpod-io/gitpod ${tag} ${releaseBranch} '${description}' "${releaseFilesTmpDir}/*"`,
            );

            werft.done("publish");
        } catch (err) {
            werft.fail("publish", err);
        } finally {
            exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
        }
    }

    if (jobConfig.publishToKots) {
        publishKots(werft, jobConfig);
    }

    werft.rootSpan.setAttributes({ "preview.gitpod_built_successfully": true });
}

/**
 * Publish Charts
 */
async function publishHelmChart(werft: Werft, imageRepoBase: string, version: string) {
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
        "gsutil -m rsync -r helm-repo/ gs://charts-gitpod-io-public/",
    ].forEach((cmd) => {
        exec(cmd, { slice: "publish-charts" });
    });
    werft.done("publish-charts");
}

function publishKots(werft: Werft, jobConfig: JobConfig) {
    werft.phase(phases.PUBLISH_KOTS, "Publish release to KOTS");
    exec(
        `docker run --entrypoint sh --rm eu.gcr.io/gitpod-core-dev/build/installer:${jobConfig.version} -c "cat /app/installer" > /tmp/installer`,
    );
    exec(`chmod +x /tmp/installer`);

    const imageAndTag = exec(`yq r ${REPLICATED_YAML_DIR}/gitpod-installer-job.yaml ${INSTALLER_JOB_IMAGE}`);
    const [image] = imageAndTag.split(":");

    // Set the tag to the current version
    exec(
        `yq w -i ${REPLICATED_YAML_DIR}/gitpod-installer-job.yaml ${INSTALLER_JOB_IMAGE} ${image}:${jobConfig.version}`,
        { slice: phases.PUBLISH_KOTS },
    );
    exec(
        `yq w -i ${REPLICATED_YAML_DIR}/gitpod-installation-status.yaml ${INSTALLER_JOB_IMAGE} ${image}:${jobConfig.version}`,
        { slice: phases.PUBLISH_KOTS },
    );

    // Generate the preflights, logo and pull any Helm charts
    exec(`make generate_preflight_checks logo helm -C ${REPLICATED_DIR}`, { slice: phases.PUBLISH_KOTS });

    // Update the additionalImages in the kots-app.yaml
    exec(`/tmp/installer mirror kots --file ${REPLICATED_YAML_DIR}/kots-app.yaml`, { slice: phases.PUBLISH_KOTS });

    const replicatedChannel = jobConfig.mainBuild ? "Unstable" : jobConfig.repository.branch;

    exec(
        `replicated release create \
        --lint \
        --ensure-channel \
        --yaml-dir ${REPLICATED_YAML_DIR} \
        --version ${jobConfig.version} \
        --release-notes "# ${jobConfig.version}\n\nSee [Werft job](https://werft.gitpod-dev.com/job/gitpod-build-${jobConfig.version}/logs) for notes" \
        --promote ${replicatedChannel}`,
        { slice: phases.PUBLISH_KOTS },
    );

    werft.done(phases.PUBLISH_KOTS);
}
