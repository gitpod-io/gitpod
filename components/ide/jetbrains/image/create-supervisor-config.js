// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// @ts-check
const fs = require("fs");

const ideConfigs = [
    {
        name: "intellij",
        displayName: "IntelliJ IDEA",
    },
    {
        name: "goland",
        displayName: "GoLand",
    },
    {
        name: "pycharm",
        displayName: "PyCharm",
    },
    {
        name: "phpstorm",
        displayName: "PhpStorm",
    },
    {
        name: "rubymine",
        displayName: "RubyMine",
    },
    {
        name: "webstorm",
        displayName: "WebStorm",
    },
    {
        name: "rider",
        displayName: "Rider",
    },
    {
        name: "clion",
        displayName: "CLion",
    },
    {
        name: "rustrover",
        displayName: "RustRover",
    },
];

["stable", "latest"].forEach((qualifier) => {
    ideConfigs.forEach((ideConfig) => {
        const name = ideConfig.name + (qualifier === "stable" ? "" : "-" + qualifier);
        const template = {
            name: ideConfig.name,
            displayName: ideConfig.displayName,
            version: qualifier,
            entrypoint: `/ide-desktop/jb-launcher`,
            entrypointArgs: ["{DESKTOPIDEPORT}", ideConfig.name, `Open in ${ideConfig.displayName}`],
            readinessProbe: {
                type: "http",
                http: {
                    path: "/status",
                },
            },
            env: {
                JETBRAINS_BACKEND_QUALIFIER: qualifier,
                PATH: `/ide-desktop/${name}/bin:$PATH`,
                EDITOR: `/ide-desktop/${name}/bin/idea-cli open`,
                VISUAL: "$EDITOR",
                GP_OPEN_EDITOR: "$EDITOR",
                GIT_EDITOR: "$EDITOR --wait",
                GP_PREVIEW_BROWSER: `/ide-desktop/${name}/bin/idea-cli preview`,
                GP_EXTERNAL_BROWSER: `/ide-desktop/${name}/bin/idea-cli preview`,
            },
            prebuild: {
                args: ["warmup", ideConfig.name],
                env: {
                    JETBRAINS_BACKEND_QUALIFIER: qualifier,
                },
            },
        };
        fs.writeFileSync(`supervisor-ide-config_${name}.json`, JSON.stringify(template, null, 2), "utf-8");
    });
});
