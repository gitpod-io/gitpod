import {exec} from "../../util/shell";
import {Werft} from "../../util/werft";
import {previewNameFromBranchName} from "../../util/preview";

type IdeIntegrationTests = "ide" | "jetbrains" | "ssh" | "vscode";
type WithIntegrationTests = "skip" | "all" | "workspace" | "webapp" | IdeIntegrationTests

export type Analytics = "skip" | "segment";

export interface JobConfig {
    analytics: Analytics;
    buildConfig: any;
    cleanSlateDeployment: boolean;
    cluster: string;
    coverageOutput: string;
    dontTest: boolean;
    fromVersion: string;
    installEELicense: boolean;
    localAppVersion: string;
    mainBuild: boolean;
    withPreview: boolean;
    publishRelease: boolean;
    publishToJBMarketplace: boolean;
    publishToNpm: string;
    publishToKots: boolean;
    retag: string;
    replicatedChannel: string;
    storage: string;
    version: string;
    withContrib: boolean;
    withIntegrationTests: WithIntegrationTests;
    withUpgradeTests: boolean;
    withSelfHostedPreview: boolean;
    withObservability: boolean;
    withLocalPreview: boolean;
    withSlowDatabase: boolean;
    workspaceFeatureFlags: string[];
    previewEnvironment: PreviewEnvironmentConfig;
    repository: Repository;
    replicatedVersion: string;
    observability: Observability;
    withLargeVM: boolean;
    certIssuer: string;
    recreatePreview: boolean;
    recreateVm: boolean;
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
    const sliceId = "Parsing job configuration";
    werft.phase("Job configuration");
    werft.log(sliceId, "Parsing the job configuration");
    const version = parseVersion(context);
    const repo = `${context.Repository.host}/${context.Repository.owner}/${context.Repository.repo}`;
    const mainBuild = repo === "github.com/gitpod-io/gitpod" && context.Repository.ref.includes("refs/heads/main");

    let buildConfig = context.Annotations || {};
    const dontTest = "no-test" in buildConfig;
    const publishRelease = "publish-release" in buildConfig;
    const workspaceFeatureFlags: string[] = ((): string[] => {
        const raw: string = buildConfig["ws-feature-flags"] || "";
        if (!raw) {
            return [];
        }
        return raw.split(",").map((e) => e.trim());
    })();

    const coverageOutput = exec("mktemp -d", {silent: true}).stdout.trim();

    // Main build should only contain the annotations below:
    // ['with-contrib', 'publish-to-npm', 'publish-to-jb-marketplace', 'with-clean-slate-deployment']
    const withContrib = "with-contrib" in buildConfig || mainBuild;
    const storage = buildConfig["storage"] || "";
    const withUpgradeTests = "with-upgrade-tests" in buildConfig && !mainBuild;
    const fromVersion = withUpgradeTests ? buildConfig["from-version"] : "";
    const replicatedChannel = buildConfig["channel"];
    const cluster = buildConfig["cluster"];
    const withSelfHostedPreview = "with-sh-preview" in buildConfig;
    const replicatedVersion = withSelfHostedPreview ? buildConfig["version"] : "";
    const publishToNpm = "publish-to-npm" in buildConfig || mainBuild;
    const publishToJBMarketplace = "publish-to-jb-marketplace" in buildConfig || mainBuild;
    const publishToKots = "publish-to-kots" in buildConfig || withSelfHostedPreview || mainBuild;

    const localAppVersion = mainBuild || "with-localapp-version" in buildConfig ? version : "unknown";
    const retag = "with-retag" in buildConfig ? "" : "--dont-retag";
    const cleanSlateDeployment = mainBuild || "with-clean-slate-deployment" in buildConfig;
    const installEELicense = !("without-ee-license" in buildConfig) || mainBuild;
    const withObservability = "with-observability" in buildConfig && !mainBuild;
    const withLargeVM = "with-large-vm" in buildConfig && !mainBuild;
    const withLocalPreview = "with-local-preview" in buildConfig || mainBuild
    const recreatePreview = "recreate-preview" in buildConfig
    const recreateVm = mainBuild || "recreate-vm" in buildConfig;
    const withSlowDatabase = "with-slow-database" in buildConfig && !mainBuild;

    const analytics = parseAnalytics(werft, sliceId, buildConfig["analytics"])
    const withIntegrationTests = parseWithIntegrationTests(werft, sliceId, buildConfig["with-integration-tests"]);
    const withPreview = decideWithPreview({werft, sliceID: sliceId, buildConfig, mainBuild, withIntegrationTests})

    switch (buildConfig["cert-issuer"]) {
        case "letsencrypt":
            buildConfig["cert-issuer"] = "letsencrypt-issuer-gitpod-core-dev"
            break
        case "zerossl":
        default:
            buildConfig["cert-issuer"] = "zerossl-issuer-gitpod-core-dev"
    }
    const certIssuer = buildConfig["cert-issuer"];

    const repository: Repository = {
        owner: context.Repository.owner,
        repo: context.Repository.repo,
        ref: context.Repository.ref,
        branch: context.Repository.ref,
    };
    const refsPrefix = "refs/heads/";
    if (repository.branch.startsWith(refsPrefix)) {
        repository.branch = repository.branch.substring(refsPrefix.length);
    }

    const previewName = previewNameFromBranchName(repository.branch);
    const previewEnvironmentNamespace = `default`;
    const previewEnvironment = {
        destname: previewName,
        namespace: previewEnvironmentNamespace,
    };

    const observability: Observability = {
        branch: context.Annotations.withObservabilityBranch || "main",
    };

    const jobConfig = {
        analytics,
        buildConfig,
        cleanSlateDeployment,
        cluster,
        coverageOutput,
        dontTest,
        fromVersion,
        installEELicense,
        localAppVersion,
        mainBuild,
        withPreview,
        observability,
        previewEnvironment,
        publishRelease,
        publishToJBMarketplace,
        publishToNpm,
        publishToKots,
        replicatedChannel,
        replicatedVersion,
        repository,
        retag,
        storage,
        version,
        withContrib,
        withIntegrationTests,
        withObservability,
        withUpgradeTests,
        withSelfHostedPreview,
        withLocalPreview,
        workspaceFeatureFlags,
        withLargeVM,
        certIssuer,
        recreatePreview,
        recreateVm,
        withSlowDatabase,
    };

    werft.logOutput(sliceId, JSON.stringify(jobConfig, null, 2));
    werft.log(sliceId, "Expand to see the parsed configuration");
    const globalAttributes = Object.fromEntries(
        Object.entries(jobConfig).map((kv) => {
            const [key, value] = kv;
            return [`werft.job.config.${key}`, value];
        }),
    );
    globalAttributes["werft.job.config.branch"] = context.Repository.ref;
    werft.addAttributes(globalAttributes);
    werft.done(sliceId);

    return jobConfig;
}

function parseVersion(context: any) {
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
    return version;
}

function decideWithPreview(options: { werft: Werft, sliceID: string, buildConfig: any, mainBuild: boolean, withIntegrationTests: WithIntegrationTests }) {
    const {werft, sliceID, buildConfig, mainBuild, withIntegrationTests} = options
    if (mainBuild) {
        werft.log(sliceID, "with-preview is disabled for main builds")
        return false
    }
    if ("with-preview" in buildConfig) {
        werft.log(sliceID, "with-preview is enabled as it was passed as a Werft annotation")
        return true
    }
    if (withIntegrationTests != "skip") {
        werft.log(sliceID, "with-preview is enabled as the with-integration-tests Werft annotation was used")
        return true
    }

    return false
}

export function parseAnalytics(werft: Werft, sliceId: string, value: string): Analytics {
    switch (value) {
        case "segment":
            return "segment"
    }

    werft.log(sliceId, "Analytics is not enabled")
    return "skip";
}


export function parseWithIntegrationTests(werft: Werft, sliceID: string, value?: string): WithIntegrationTests {
    switch (value) {
        case null:
        case undefined:
            werft.log(sliceID, "with-integration-tests was not set - will use 'skip'");
            return "skip";
        case "skip":
        case "all":
        case "webapp":
        case "ide":
        case "jetbrains":
        case "vscode":
        case "ssh":
        case "workspace":
        case "webapp":
            return value;
        case "":
            werft.log(sliceID, "with-integration-tests was set but no value was provided - falling back to 'all'");
            return "all";
        default:
            werft.log(sliceID, `Unknown value for with-integration-tests: '${value}' - falling back to 'all'`);
            return "all";
    }
}
