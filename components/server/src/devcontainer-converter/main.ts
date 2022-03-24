import yaml from "js-yaml";
import fs from "fs";
import { DevContainer } from "./types";
import { GitpodConfig } from "./types-gitpod";

export const toDevContainer = async () => {
    let containerFile: DevContainer = { remoteUser: "gitpod" };

    // Get document, or throw exception on error
    try {
        //@ts-ignore
        const doc: GitpodConfig = yaml.load(fs.readFileSync("/workspace/gitpod/.gitpod.yml", "utf8"));
        //containerFile.extensions = doc.vscode?.extensions;

        /* Docker image */
        if (typeof doc.image === "string") {
            // @ts-ignore
            containerFile.build = {};
            console.log(containerFile);
            // @ts-ignore
            containerFile?.build.dockerfile = doc.image;
        } else if (typeof doc.image == "object") {
            // @ts-ignore
            containerFile.build = {};
            // @ts-ignore
            containerFile?.build.dockerfile = doc.image.file;
        }

        if (doc.tasks) {
            for (const task of doc.tasks) {
            }
        }

        console.log(JSON.stringify(containerFile));
    } catch (e) {
        console.log(e);
    }
};

export const toGitpod = (containerFile: DevContainer) => {
    //@ts-ignore
    let gitpodConfig: GitpodConfig = { tasks: [], image: {} };

    if (containerFile.postStartCommand) {
        const before =
            typeof containerFile.postCreateCommand === "string"
                ? containerFile.postCreateCommand
                : containerFile.postCreateCommand?.join("&&");
        const command =
            typeof containerFile.postStartCommand === "string"
                ? containerFile.postStartCommand
                : containerFile.postStartCommand?.join("&&");

        gitpodConfig.tasks?.push({ command, before });
    }

    //@ts-ignore
    if (containerFile.dockerFile || containerFile.build.dockerfile) {
        //@ts-ignore
        gitpodConfig.image.file = `.devcontainer/${containerFile.dockerFile || containerFile.build.dockerfile}`;
    }

    //@ts-ignore
    if (containerFile?.build?.context) {
        //@ts-ignore
        gitpodConfig.image.context = `.devcontainer/${containerFile.build.context}`;
    }

    if (containerFile.appPort) {
        switch (typeof containerFile.appPort) {
            case "number":
            case "string":
                gitpodConfig.ports = [{ port: containerFile.appPort }];
                break;
            case "object":
                // @ts-ignore
                gitpodConfig.ports = containerFile.appPort.map((port) => {
                    port;
                });
        }
    }

    if (containerFile.extensions) {
        gitpodConfig.vscode = {};
        gitpodConfig.vscode.extensions = containerFile.extensions;
    }

    return gitpodConfig;
};

// For testing:

console.log(
    JSON.stringify(
        toGitpod({
            name: "xterm.js",
            dockerFile: "Dockerfile",
            appPort: 3000,
            extensions: ["dbaeumer.vscode-eslint", "editorconfig.editorconfig", "hbenl.vscode-mocha-test-adapter"],
        }),
    ),
);
