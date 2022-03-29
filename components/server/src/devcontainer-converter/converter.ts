/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// import yaml from "js-yaml";
// import fs from "fs";
import { DevContainer } from "./types";
import { GitpodConfig } from "./types-gitpod";
import { stringify } from "yaml";

export const toDevContainer = (doc: GitpodConfig): DevContainer => {
    let containerFile: DevContainer = { remoteUser: "gitpod" };

    containerFile.extensions = doc.vscode?.extensions;

    /* Docker image */
    if (typeof doc.image === "string") {
        // @ts-ignore
        containerFile.image = doc.image;
    } else if (typeof doc.image == "object") {
        // @ts-ignore
        containerFile.build = {};
        // @ts-ignore
        containerFile?.build.dockerfile = `../${doc.image.file}`;
    }

    if (doc.tasks) {
        // for (const task of doc.tasks) {
        //     console.log(task)
        // }
    }

    return containerFile;
};

export const toGitpod = (containerFile: DevContainer, cleanYaml?: boolean): string => {
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
    } else {
        delete gitpodConfig["tasks"];
    }

    //@ts-ignore
    if (containerFile.image) {
        //@ts-ignore
        gitpodConfig.image = containerFile.image;
        //@ts-ignore
    } else if (containerFile.dockerFile || containerFile.build?.dockerfile) {
        //@ts-ignore
        gitpodConfig.image.file = `.devcontainer/${containerFile.dockerFile || containerFile.build.dockerfile}`;
    } else {
        delete gitpodConfig["image"];
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

    return cleanYaml ? stringify(gitpodConfig) : JSON.stringify(gitpodConfig);
};

// For testing:

// console.log(
//     toGitpod({
//         "name": "Rust",
//         "build": {
//             "dockerfile": "Dockerfile"
//         },
//         "runArgs": ["--cap-add=SYS_PTRACE", "--security-opt", "seccomp=unconfined"],

//         "settings": {
//             "lldb.executable": "/usr/bin/lldb",
//             // VS Code don't watch files under ./target
//             "files.watcherExclude": {
//                 "**/target/**": true
//             }
//         },

//         "extensions": [
//             "matklad.rust-analyzer",
//             "bungcip.better-toml",
//             "vadimcn.vscode-lldb",
//             "mutantdino.resourcemonitor"
//         ],

//         "postCreateCommand": "git submodule update --init",

//         "remoteUser": "vscode"
//     }, true),

// );
