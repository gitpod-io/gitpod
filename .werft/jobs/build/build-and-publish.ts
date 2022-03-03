import * as semver from 'semver';
import { exec } from '../../util/shell';
import { Werft } from '../../util/werft';
import { GCLOUD_SERVICE_ACCOUNT_PATH } from './const';
import { JobConfig } from './job-config';

export async function buildAndPublish(werft: Werft, jobConfig: JobConfig) {
    const {
        publishRelease,
        dontTest,
        withContrib,
        retag,
        version,
        localAppVersion,
        publishToJBMarketplace,
        publishToNpm,
        coverageOutput,
    } = jobConfig;

    const releaseBranch = jobConfig.repository.ref;

    werft.phase('build', 'build running');
    const imageRepo = publishRelease ? 'gcr.io/gitpod-io/self-hosted' : 'eu.gcr.io/gitpod-core-dev/build';

    exec(
        `LICENCE_HEADER_CHECK_ONLY=true leeway run components:update-license-header || { echo "[build|FAIL] There are some license headers missing. Please run 'leeway run components:update-license-header'."; exit 1; }`,
    );
    exec(`leeway vet --ignore-warnings`);
    exec(
        `leeway build --docker-build-options network=host --werft=true -c remote ${
            dontTest ? '--dont-test' : ''
        } --dont-retag --coverage-output-path=${coverageOutput} --save /tmp/dev.tar.gz -Dversion=${version} -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev dev:all`,
    );

    if (publishRelease) {
        exec(`gcloud auth activate-service-account --key-file "/mnt/secrets/gcp-sa-release/service-account.json"`);
    }
    if (withContrib || publishRelease) {
        exec(
            `leeway build --docker-build-options network=host --werft=true -c remote ${
                dontTest ? '--dont-test' : ''
            } -Dversion=${version} -DimageRepoBase=${imageRepo} contrib:all`,
        );
    }
    exec(
        `leeway build --docker-build-options network=host --werft=true -c remote ${
            dontTest ? '--dont-test' : ''
        } ${retag} --coverage-output-path=${coverageOutput} -Dversion=${version} -DremoveSources=false -DimageRepoBase=${imageRepo} -DlocalAppVersion=${localAppVersion} -DSEGMENT_IO_TOKEN=${
            process.env.SEGMENT_IO_TOKEN
        } -DnpmPublishTrigger=${publishToNpm ? Date.now() : 'false'} -DjbMarketplacePublishTrigger=${
            publishToJBMarketplace ? Date.now() : 'false'
        }`,
    );
    if (publishRelease) {
        try {
            werft.phase('publish', 'checking version semver compliance...');
            if (!semver.valid(version)) {
                // make this an explicit error as early as possible. Is required by helm Charts.yaml/version
                throw new Error(
                    `'${version}' is not semver compliant and thus cannot be used for Self-Hosted releases!`,
                );
            }

            werft.phase('publish', 'publishing Helm chart...');
            publishHelmChart(werft, 'gcr.io/gitpod-io/self-hosted', version);

            werft.phase('publish', `preparing GitHub release files...`);
            const releaseFilesTmpDir = exec('mktemp -d', { silent: true }).stdout.trim();
            const releaseTarName = 'release.tar.gz';
            exec(
                `leeway build --docker-build-options network=host --werft=true chart:release-tars -Dversion=${version} -DimageRepoBase=${imageRepo} --save ${releaseFilesTmpDir}/${releaseTarName}`,
            );
            exec(`cd ${releaseFilesTmpDir} && tar xzf ${releaseTarName} && rm -f ${releaseTarName}`);

            werft.phase('publish', `publishing GitHub release ${version}...`);
            const prereleaseFlag = semver.prerelease(version) !== null ? '-prerelease' : '';
            const tag = `v${version}`;
            const description = `Gitpod Self-Hosted ${version}<br/><br/>Docs: https://www.gitpod.io/docs/self-hosted/latest/self-hosted/`;
            exec(
                `github-release ${prereleaseFlag} gitpod-io/gitpod ${tag} ${releaseBranch} '${description}' "${releaseFilesTmpDir}/*"`,
            );

            werft.done('publish');
        } catch (err) {
            werft.fail('publish', err);
        } finally {
            exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
        }
    }
}

/**
 * Publish Charts
 */
async function publishHelmChart(werft: Werft, imageRepoBase: string, version: string) {
    werft.phase('publish-charts', 'Publish charts');
    [
        'gcloud config set project gitpod-io',
        `leeway build --docker-build-options network=host -Dversion=${version} -DimageRepoBase=${imageRepoBase} --save helm-repo.tar.gz chart:helm`,
        'tar xzfv helm-repo.tar.gz',
        'mkdir helm-repo',
        'cp gitpod*tgz helm-repo/',
        'gsutil cp gs://charts-gitpod-io-public/index.yaml old-index.yaml',
        'cp gitpod*.tgz helm-repo/',
        'helm3 repo index --merge old-index.yaml helm-repo',
        'gsutil -m rsync -r helm-repo/ gs://charts-gitpod-io-public/',
    ].forEach((cmd) => {
        exec(cmd, { slice: 'publish-charts' });
    });
    werft.done('publish-charts');
}
