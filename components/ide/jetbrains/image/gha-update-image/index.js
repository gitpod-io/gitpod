const path = require("path");
const yaml = require("yaml");
const fs = require("fs");

const IDEs = [
    {
        productName: "IntelliJ IDEA",
        productId: "intellij",
        productCode: "IIU",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-io/spring-petclinic",
    },
    {
        productName: "GoLand",
        productId: "goland",
        productCode: "GO",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-io/template-golang-cli",
    },
    {
        productName: "PyCharm",
        productId: "pycharm",
        productCode: "PCP",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-io/template-python-django",
    },
    {
        productName: "PhpStorm",
        productId: "phpstorm",
        productCode: "PS",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-io/template-php-laravel-mysql",
    },
    {
        productName: "RubyMine",
        productId: "rubymine",
        productCode: "RM",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-io/template-jetbrains-rubymine",
    },
    {
        productName: "WebStorm",
        productId: "webstorm",
        productCode: "WS",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-io/template-jetbrains-webstorm",
    },
];

const axios = require("axios");
(async () => {
    const workspaceYamlFilePath = path.resolve(__dirname, "../../../../../", "WORKSPACE.yaml");

    let rawWorkspaceYaml;

    try {
        rawWorkspaceYaml = fs.readFileSync(workspaceYamlFilePath, "utf8");
    } catch {
        throw new Error(`Failed to read ${workspaceYamlFilePath}.`);
    }

    const workspaceYaml = yaml.parse(rawWorkspaceYaml);

    const majorVersions = new Set();

    for (const IDE of IDEs) {
        const url = `https://data.services.jetbrains.com/products?code=${IDE.productCode}&release.type=${
            IDE.productType
        }&fields=distributions%2Clink%2Cname%2Creleases&_=${Date.now()}"`;

        const resp = await axios(url);
        console.log(`${IDE.productName} v${resp.data[0].releases[0].majorVersion}`);
        majorVersions.add(resp.data[0].releases[0].majorVersion);

        const oldDownloadUrl = workspaceYaml.defaultArgs[`${IDE.productId}DownloadUrl`];
        rawWorkspaceYaml = rawWorkspaceYaml.replace(oldDownloadUrl, resp.data[0].releases[0].downloads.linux.link);
    }

    if (majorVersions.size === 1) {
        console.log("All IDEs are in the same major version.");
    }

    console.log(rawWorkspaceYaml);

    fs.writeFileSync(workspaceYamlFilePath, rawWorkspaceYaml);
})();
