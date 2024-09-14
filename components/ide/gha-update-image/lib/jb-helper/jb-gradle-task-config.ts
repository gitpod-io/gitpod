import path from "path";
import { AllProductCodes, AllProductIDs, TargetInfo } from "./jb-helper";
import { pathToProjectRoot } from "../common";
import { parseArgs } from "util";

export type TaskInfo = TargetInfo & { id: number; taskName: string };

export const latestBackendPluginGradleTarget: TaskInfo = {
    id: 1,
    taskName: "Latest Backend Plugin",
    productId: "intellij",
    productCode: "IIU",
    productType: "eap,rc,release",
    usePlatformVersionType: "build",
    gradlePropertiesPath: path.resolve(
        pathToProjectRoot,
        "components/ide/jetbrains/backend-plugin/gradle-latest.properties",
    ),
    gradlePropertiesTemplate: `# See https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html
# for insight into build numbers and IntelliJ Platform versions.
# revert pluginSinceBuild if it's unnecessary
pluginSinceBuild={{pluginSinceBuild}}
pluginUntilBuild={{pluginUntilBuild}}
# Plugin Verifier integration -> https://github.com/JetBrains/gradle-intellij-plugin#plugin-verifier-dsl
# See https://jb.gg/intellij-platform-builds-list for available build versions.
pluginVerifierIdeVersions={{pluginVerifierIdeVersions}}
# Version from "com.jetbrains.intellij.idea" which can be found at https://www.jetbrains.com/intellij-repository/snapshots
platformVersion={{platformVersion}}
`,
};

export const latestGatewayPluginGradleTarget: TaskInfo = {
    id: 2,
    taskName: "Latest Frontend Plugin",
    productId: "gateway",
    productCode: "GW",
    productType: "eap,rc,release",
    usePlatformVersionType: "version",
    gradlePropertiesPath: path.resolve(
        pathToProjectRoot,
        "components/ide/jetbrains/gateway-plugin/gradle-latest.properties",
    ),
    gradlePropertiesTemplate: `# See https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html
# for insight into build numbers and IntelliJ Platform versions.
# revert pluginSinceBuild if it's unnecessary
pluginSinceBuild={{pluginSinceBuild}}
pluginUntilBuild={{pluginUntilBuild}}
# Plugin Verifier integration -> https://github.com/JetBrains/gradle-intellij-plugin#plugin-verifier-dsl
# See https://jb.gg/intellij-platform-builds-list for available build versions.
pluginVerifierIdeVersions={{pluginVerifierIdeVersions}}
# Version from "com.jetbrains.gateway" which can be found at https://www.jetbrains.com/intellij-repository/snapshots
platformVersion={{platformVersion}}
`,
};

export const stableGatewayPluginGradleTarget: TaskInfo = {
    id: 3,
    taskName: "Stable Frontend Plugin",
    productId: "gateway",
    productCode: "GW",
    productType: "release",
    usePlatformVersionType: "version",
    gradlePropertiesPath: path.resolve(
        pathToProjectRoot,
        "components/ide/jetbrains/gateway-plugin/gradle-stable.properties",
    ),
    gradlePropertiesTemplate: `# See https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html
# for insight into build numbers and IntelliJ Platform versions.
# revert pluginSinceBuild if it's unnecessary
pluginSinceBuild={{pluginSinceBuild}}
pluginUntilBuild={{pluginUntilBuild}}
# Plugin Verifier integration -> https://github.com/JetBrains/gradle-intellij-plugin#plugin-verifier-dsl
# See https://jb.gg/intellij-platform-builds-list for available build versions.
pluginVerifierIdeVersions={{pluginVerifierIdeVersions}}
# Version from "com.jetbrains.gateway" which can be found at https://www.jetbrains.com/updates/updates.xml
platformVersion={{platformVersion}}
`,
};

export const AllTasks = [
    latestBackendPluginGradleTarget,
    latestGatewayPluginGradleTarget,
    stableGatewayPluginGradleTarget,
];

export const getTaskFromArgs = (requireProductCode: boolean) => {
    const { values } = parseArgs({
        args: Bun.argv,
        options: {
            task: {
                type: "string",
            },
            productCode: {
                type: "string",
            },
        },
        allowPositionals: true,
    });

    const taskID = Number.parseInt(values.task ?? "NaN");

    const target = AllTasks.find((e) => e.id === taskID);
    if (!target) {
        throw new Error(
            `Invalid task id: ${taskID}, update cmd with \`--task="<id>"\`, available tasks: \n\t- ${AllTasks.map(
                (e) => `(${e.id}) ${e.taskName}`,
            ).join("\n\t- ")}`,
        );
    }
    if (requireProductCode && !values.productCode) {
        throw new Error(`\`--productCode\` is required, available codes: ${AllProductCodes.join(", ")}`);
    }
    if (values.productCode) {
        const index = AllProductCodes.indexOf(values.productCode as any);
        if (index === -1) {
            throw new Error(
                `Invalid \`--productCode\`: ${values.productCode}, available codes: ${AllProductCodes.join(", ")}`,
            );
        }
        target.productCode = values.productCode as any;
        target.productId = AllProductIDs[index];
    }
    return target;
};
