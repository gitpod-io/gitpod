const path = require("path");
const yaml = require("yaml");
const fs = require("fs");
const axios = require("axios");

const IDEs = [
    {
        productName: "IntelliJ IDEA Ultimate",
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
        productName: "PyCharm Professional Edition",
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

    const requestPromises = [];

    for (const IDE of IDEs) {
        const url = `https://data.services.jetbrains.com/products?code=${IDE.productCode}&release.type=${
            IDE.productType
        }&fields=distributions%2Clink%2Cname%2Creleases&_=${Date.now()}"`;
        requestPromises.push(axios(url));
    }

    const responses = await Promise.all(requestPromises);

    responses.forEach((resp, index) => {
        const lastRelease = resp.data[0].releases[0];
        majorVersions.add(lastRelease.majorVersion);
        const oldDownloadUrl = workspaceYaml.defaultArgs[`${IDEs[index].productId}DownloadUrl`];
        rawWorkspaceYaml = rawWorkspaceYaml.replace(oldDownloadUrl, lastRelease.downloads.linux.link);
    });

    if (majorVersions.size === 1) {
        const majorVersion = Array.from(majorVersions).pop();
        console.log(`All IDEs are in the same major version: ${majorVersion}`);
        // TODO: Check if there's any update on the IntelliJ SDK for ${majorVersion} and update components/ide/jetbrains/backend-plugin/gradle-stable.properties
    }

    fs.writeFileSync(workspaceYamlFilePath, rawWorkspaceYaml);
})();
