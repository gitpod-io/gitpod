// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

const ideConfigs = [
    {
        name: "intellij",
        productCode: "IIU",
    },
    {
        name: "goland",
        productCode: "GO",
    },
    {
        name: "pycharm",
        productCode: "PCP",
    },
    {
        name: "phpstorm",
        productCode: "PS",
    },
    {
        name: "rubymine",
        productCode: "RM",
    },
    {
        name: "webstorm",
        productCode: "WS",
    },
];

const packages = [];
const generateIDEBuildPackage = function (ideConfig, qualifier) {
    let name = ideConfig.name + (qualifier === "stable" ? "" : "-" + qualifier);
    let helmName = ideConfig.name + (qualifier === "stable" ? "" : "Latest");
    let pkg = {
        name,
        type: "docker",
        srcs: ["startup.sh", `supervisor-ide-config_${ideConfig.name}.json`],
        deps: ["components/ide/jetbrains/image/status:app", `:download-${name}`, "components/ide/jetbrains/cli:app"],
        config: {
            dockerfile: "leeway.Dockerfile",
            metadata: {
                "helm-component": `workspace.desktopIdeImages.${helmName}`,
            },
            buildArgs: {
                JETBRAINS_DOWNLOAD_QUALIFIER: name,
                SUPERVISOR_IDE_CONFIG: `supervisor-ide-config_${ideConfig.name}.json`,
                JETBRAINS_BACKEND_QUALIFIER: qualifier,
            },
            image: [],
        },
    };
    if (qualifier === "stable") {
        pkg.config.image.push(`${args.imageRepoBase}/ide/${ideConfig.name}` + ":commit-${__git_commit}");
    } else {
        if (args.version === "latest") {
            pkg.config.image.push(`${args.imageRepoBase}/ide/${ideConfig.name}:${args.version}`);
        } else {
            pkg.config.image.push(`${args.imageRepoBase}/ide/${ideConfig.name}` + ":commit-${__git_commit}-latest");
        }
    }
    return pkg;
};
const generateIDEDownloadPackage = function (ideConfig, qualifier) {
    let name = "download-" + ideConfig.name + (qualifier === "stable" ? "" : "-" + qualifier);
    let pkg = {
        name,
        type: "generic",
        srcs: ["download.sh"],
        env: [],
        config: {
            commands: [["./download.sh"]],
        },
    };
    if (qualifier === "stable") {
        pkg.env.push(`JETBRAINS_BACKEND_URL=${args[`${ideConfig.name}DownloadUrl`]}`);
    } else {
        let url = `https://download.jetbrains.com/product?type=release,rc,eap&distribution=linux&code=${ideConfig.productCode}`;
        if (args["buildNumber"]) {
            url = `${url}&build=${args["buildNumber"]}`;
        }
        pkg.env.push(`JETBRAINS_BACKEND_URL=${url}`);
    }
    return pkg;
};

for (let ideConfig of ideConfigs) {
    packages.push(generateIDEDownloadPackage(ideConfig, "stable"));
    packages.push(generateIDEDownloadPackage(ideConfig, "latest"));
    packages.push(generateIDEBuildPackage(ideConfig, "stable"));
    packages.push(generateIDEBuildPackage(ideConfig, "latest"));
}

packages.push({
    name: "docker",
    type: "generic",
    deps: packages.map((d) => ":" + d.name),
});
