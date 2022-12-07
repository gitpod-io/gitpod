// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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
];

["stable", "latest"].forEach((qualifier) => {
    ideConfigs.forEach((ideConfig) => {
        const name = ideConfig.name + (qualifier === "stable" ? "" : "-" + qualifier);
        const template = {
            entrypoint: `/ide-desktop/${name}/status`,
            entrypointArgs: ["{DESKTOPIDEPORT}", ideConfig.name, `Open in ${ideConfig.displayName}`],
            readinessProbe: {
                type: "http",
                http: {
                    path: "/status",
                },
            },
        };
        fs.writeFileSync(`supervisor-ide-config_${name}.json`, JSON.stringify(template, null, 2), "utf-8");
    });
});
