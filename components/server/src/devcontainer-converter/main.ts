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
            for (const task in doc.tasks) {
                console.log(task);
            }
        }

        console.log(JSON.stringify(containerFile));
    } catch (e) {
        console.log(e);
    }
};

toDevContainer();
