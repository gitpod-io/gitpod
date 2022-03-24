/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// import yaml from "js-yaml";
// import fs from "fs";
import { DevContainer } from "./types";
import { GitpodConfig } from "./types-gitpod";

// export const toDevContainer = async () => {
//     let containerFile: DevContainer = { remoteUser: "gitpod" };

//     // Get document, or throw exception on error
//     try {
//         //@ts-ignore
//         const doc: GitpodConfig = yaml.load(fs.readFileSync("/workspace/gitpod/.gitpod.yml", "utf8"));
//         //containerFile.extensions = doc.vscode?.extensions;

//         /* Docker image */
//         if (typeof doc.image === "string") {
//             // @ts-ignore
//             containerFile.build = {};
//             console.log(containerFile);
//             // @ts-ignore
//             containerFile?.build.dockerfile = doc.image;
//         } else if (typeof doc.image == "object") {
//             // @ts-ignore
//             containerFile.build = {};
//             // @ts-ignore
//             containerFile?.build.dockerfile = doc.image.file;
//         }

//         if (doc.tasks) {
//             for (const task of doc.tasks) {
//             }
//         }

//         console.log(JSON.stringify(containerFile));
//     } catch (e) {
//         console.log(e);
//     }
// };

export const toGitpod = (containerFile: DevContainer) => {
    //@ts-ignore
    let gitpodConfig: GitpodConfig = { tasks: [], image: {} };

    if (containerFile.postStartCommand || containerFile.postCreateCommand) {
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
    if (containerFile.image) {
        //@ts-ignore
        gitpodConfig.image = containerFile.image;
        //@ts-ignore
    } else if (containerFile.dockerFile || containerFile.build?.dockerfile) {
        //@ts-ignore
        gitpodConfig.image.file = `.devcontainer/${containerFile.dockerFile || containerFile.build.dockerfile}`;
    }

    //@ts-ignore
    if (containerFile?.build?.context) {
        //@ts-ignore
        gitpodConfig.image.context = `.devcontainer/${containerFile.build.context}`;
    }

    const ports = containerFile.forwardPorts || containerFile.appPort;

    if (ports) {
        switch (typeof ports) {
            case "number":
            case "string":
                gitpodConfig.ports = [{ port: ports }];
                break;
            case "object":
                // @ts-ignore
                gitpodConfig.ports = ports.map((port) => {
                    const onOpen = containerFile.portsAttributes && containerFile.portsAttributes[port].onAutoForward;
                    let gpOnOpen;
                    switch (onOpen) {
                        case "ignore":
                        case "notify":
                            gpOnOpen = onOpen;
                            break;
                        case "silent":
                            gpOnOpen = "ignore";
                            break;
                        case "openBrowser":
                        case "openBrowserOnce":
                            gpOnOpen = "open-browser";
                            break;
                        case "openPreview":
                            gpOnOpen = "open-preview";
                    }

                    if (gpOnOpen) {
                        return { onOpen: gpOnOpen, port };
                    }

                    return { port };
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
            image: "mcr.microsoft.com/vscode/devcontainers/base:ubuntu-20.04",
            settings: {
                "[typescript]": {
                    "editor.defaultFormatter": "esbenp.prettier-vscode",
                    "editor.formatOnSave": true,
                },
                "[json]": {
                    "editor.defaultFormatter": "esbenp.prettier-vscode",
                    "editor.formatOnSave": true,
                },
                "[jsonc]": {
                    "editor.defaultFormatter": "esbenp.prettier-vscode",
                    "editor.formatOnSave": true,
                },
            },
            extensions: [
                "dbaeumer.vscode-eslint",
                "orta.vscode-jest",
                "esbenp.prettier-vscode",
                "streetsidesoftware.code-spell-checker",
            ],
            forwardPorts: [3000],
            containerUser: "vscode",
            postCreateCommand: "yarn install",
            waitFor: "postCreateCommand", // otherwise automated jest tests fail
            features: {
                node: {
                    version: "14",
                },
                "github-cli": "latest",
            },
        }),
    ),
);
