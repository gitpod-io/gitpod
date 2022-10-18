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
    } catch (e) {
        console.log(e);
    }

    const workspaceYaml = yaml.parse(rawWorkspaceYaml);

    const majorVersions = {};

    for (const IDE of IDEs) {
        const url = `https://data.services.jetbrains.com/products?code=${IDE.productCode}&release.type=${
            IDE.productType
        }&fields=distributions%2Clink%2Cname%2Creleases&_=${Date.now()}"`;

        const resp = await axios(url);
        majorVersions[resp.data[0].releases[0].majorVersion] = true;

        console.log(IDE.productName, resp.data[0].releases[0].majorVersion);

        const oldDonwloadUrl = workspaceYaml.defaultArgs[`${IDE.productId}DownloadUrl`];
        rawWorkspaceYaml = rawWorkspaceYaml.replace(oldDonwloadUrl, resp.data[0].releases[0].downloads.linux.link);
    }

    console.log(rawWorkspaceYaml);

    fs.writeFileSync(workspaceYamlFilePath, rawWorkspaceYaml);
})();
