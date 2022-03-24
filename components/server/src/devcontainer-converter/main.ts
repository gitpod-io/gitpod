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
    let gitpodConfig: GitpodConfig = { tasks: [] };

    if (containerFile.postStartCommand) {
        if (typeof containerFile.postStartCommand === "string") {
            gitpodConfig.tasks?.push({ command: containerFile.postStartCommand });
        } else {
            gitpodConfig.tasks?.push({ command: containerFile.postStartCommand.join("&&") });
        }
    }

    //@ts-ignore
    if (containerFile.dockerFile || containerFile.build.dockerfile) {
        //@ts-ignore
        gitpodConfig.image = `.devcontainer/${containerFile.dockerFile || containerFile.build.dockerfile}`;
    }

    return gitpodConfig;
};

// For testing:
/*
console.log(JSON.stringify(toGitpod({
    "build": {
        "dockerfile": ".devcontainer.Dockerfile",
        "context": ".."
    },
    "postStartCommand": "npm run start"
})));
*/
