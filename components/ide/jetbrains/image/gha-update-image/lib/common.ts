import path from "path";

const pathToProjectRoot = path.resolve(__dirname, "../../../../../../");

export const pathToWorkspaceYaml = path.resolve(pathToProjectRoot, "WORKSPACE.yaml");

export const pathToConfigmap = path.resolve(
    pathToProjectRoot,
    "install/installer/pkg/components/ide-service/ide-configmap.json",
);

export const pathTobackendPluginGradleStable = path.resolve(
    pathToProjectRoot,
    "components/ide/jetbrains/backend-plugin",
    "gradle-stable.properties",
);
