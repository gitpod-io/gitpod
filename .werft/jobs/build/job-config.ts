import { config } from 'process';
import { exec } from '../../util/shell';
import { Werft } from '../../util/werft';

export interface JobConfig {
    analytics: string;
    buildConfig: any;
    cleanSlateDeployment: boolean;
    coverageOutput: string;
    dontTest: boolean;
    dynamicCPULimits: boolean;
    installEELicense: boolean;
    localAppVersion: string;
    mainBuild: boolean;
    noPreview: boolean;
    publishRelease: boolean;
    publishToJBMarketplace: string;
    publishToNpm: string;
    retag: string;
    storage: string;
    version: string;
    withContrib: boolean;
    withHelm: boolean;
    withIntegrationTests: boolean;
    withObservability: boolean;
    withPayment: boolean;
    withVM: boolean;
    workspaceFeatureFlags: string[];
    previewEnvironment: PreviewEnvironmentConfig;
    repository: Repository;
    observability: Observability;
}

export interface PreviewEnvironmentConfig {
    destname: string;
    namespace: string;
}

export interface Repository {
    owner: string;
    repo: string;
    ref: string;
    branch: string;
}

export interface Observability {
    // The branch of gitpod-io/observability to use
    branch: string;
}

export function jobConfig(werft: Werft, context: any): JobConfig {
    const version = parseVersion(context);
    const repo = `${context.Repository.host}/${context.Repository.owner}/${context.Repository.repo}`;
    const mainBuild = repo === 'github.com/gitpod-io/gitpod' && context.Repository.ref.includes('refs/heads/main');

    let buildConfig = context.Annotations || {};
    const dontTest = 'no-test' in buildConfig;
    const publishRelease = 'publish-release' in buildConfig;
    const workspaceFeatureFlags: string[] = ((): string[] => {
        const raw: string = buildConfig['ws-feature-flags'] || '';
        if (!raw) {
            return [];
        }
        return raw.split(',').map((e) => e.trim());
    })();

    const coverageOutput = exec('mktemp -d', { silent: true }).stdout.trim();

    // Main build should only contain the annotations below:
    // ['with-contrib', 'publish-to-npm', 'publish-to-jb-marketplace', 'clean-slate-deployment']
    const dynamicCPULimits = 'dynamic-cpu-limits' in buildConfig && !mainBuild;
    const withContrib = 'with-contrib' in buildConfig || mainBuild;
    const noPreview = ('no-preview' in buildConfig && buildConfig['no-preview'] !== 'false') || publishRelease;
    const storage = buildConfig['storage'] || '';
    const withIntegrationTests = 'with-integration-tests' in buildConfig && !mainBuild;
    const publishToNpm = 'publish-to-npm' in buildConfig || mainBuild;
    const publishToJBMarketplace = 'publish-to-jb-marketplace' in buildConfig || mainBuild;
    const analytics = buildConfig['analytics'];
    const localAppVersion = mainBuild || 'with-localapp-version' in buildConfig ? version : 'unknown';
    const retag = 'with-retag' in buildConfig ? '' : '--dont-retag';
    const cleanSlateDeployment = mainBuild || 'with-clean-slate-deployment' in buildConfig;
    const installEELicense = !('without-ee-license' in buildConfig) || mainBuild;
    const withPayment = 'with-payment' in buildConfig && !mainBuild;
    const withObservability = 'with-observability' in buildConfig && !mainBuild;
    const withHelm = 'with-helm' in buildConfig && !mainBuild;
    const withVM = 'with-vm' in buildConfig && !mainBuild;

    const previewDestName = version.split('.')[0];
    const previewEnvironmentNamespace = withVM ? `default` : `staging-${previewDestName}`;
    const previewEnvironment = {
        destname: previewDestName,
        namespace: previewEnvironmentNamespace,
    };

    const repository: Repository = {
        owner: context.Repository.owner,
        repo: context.Repository.repo,
        ref: context.Repository.ref,
        branch: context.Repository.ref,
    };

    const refsPrefix = 'refs/heads/';
    if (repository.branch.startsWith(refsPrefix)) {
        repository.branch = repository.branch.substring(refsPrefix.length);
    }

    const observability: Observability = {
        branch: context.Annotations.withObservabilityBranch || 'main',
    };

    const jobConfig = {
        analytics,
        buildConfig,
        cleanSlateDeployment,
        coverageOutput,
        dontTest,
        dynamicCPULimits,
        installEELicense,
        localAppVersion,
        mainBuild,
        noPreview,
        observability,
        previewEnvironment,
        publishRelease,
        publishToJBMarketplace,
        publishToNpm,
        repository,
        retag,
        storage,
        version,
        withContrib,
        withHelm,
        withIntegrationTests,
        withObservability,
        withPayment,
        withVM,
        workspaceFeatureFlags,
    };

    werft.log('job config', JSON.stringify(jobConfig));
    werft.rootSpan.setAttributes(
        Object.fromEntries(
            Object.entries(jobConfig).map((kv) => {
                const [key, value] = kv;
                return [`werft.job.config.${key}`, value];
            }),
        ),
    );
    werft.rootSpan.setAttribute('werft.job.config.branch', context.Repository.ref);
    return jobConfig;
}

function parseVersion(context: any) {
    let buildConfig = context.Annotations || {};
    const explicitVersion = buildConfig.version;
    if (explicitVersion) {
        return explicitVersion;
    }
    let version = context.Name;
    const PREFIX_TO_STRIP = 'gitpod-build-';
    if (version.substr(0, PREFIX_TO_STRIP.length) === PREFIX_TO_STRIP) {
        version = version.substr(PREFIX_TO_STRIP.length);
    }
    return version;
}
