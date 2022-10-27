const path = require("path");
const yaml = require("yaml");
const fs = require("fs");
const axios = require("axios");

const JB_PRODUCTS_DATA_URL = "https://data.services.jetbrains.com/products";
const JB_ARTIFACTS_JSON_URL = "https://www.jetbrains.com/intellij-repository/snapshots/index.json";

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
    const backendPluginGradleLatestFilePath = path.resolve(__dirname, "../../backend-plugin", "gradle-latest.properties");
    
    let rawWorkspaceYaml;
    let backendPluginGradleLatest;

    try {
        rawWorkspaceYaml = fs.readFileSync(workspaceYamlFilePath, "utf8");
        backendPluginGradleLatest = fs.readFileSync(backendPluginGradleLatestFilePath, "utf8");
    } catch (err) {
        console.log(`Failed to read ${workspaceYamlFilePath}`);
        throw err;
    }

    console.log(backendPluginGradleLatest);
    

    const workspaceYaml = yaml.parse(rawWorkspaceYaml);

    const requests = [];
    for (const IDE of IDEs) {
        const params = new URLSearchParams({
            code: IDE.productCode,
            "release.type": IDE.productType,
            fields: ["distributions", "link", "name", "releases"].join(","),
            _: Date.now(),
        });

        const url = [JB_PRODUCTS_DATA_URL, "?", params].join("");
        requests.push(axios(url));
    }

    const responses = await Promise.all(requests);

    const uniqueMajorVersions = new Set();

    responses.forEach((resp, index) => {
        const lastRelease = resp.data[0].releases[0];
        uniqueMajorVersions.add(lastRelease.majorVersion);
        const oldDownloadUrl = workspaceYaml.defaultArgs[`${IDEs[index].productId}DownloadUrl`];
        rawWorkspaceYaml = rawWorkspaceYaml.replace(oldDownloadUrl, lastRelease.downloads.linux.link);
    });

    const majorVersions = [...uniqueMajorVersions];

    if (majorVersions.length !== 1) {
        console.log(`Multiple major versions found, skipping update: ${majorVersions.join(", ")}`);
        return;
    }

    const majorVersion = majorVersions[0];

    console.log(`All IDEs are in the same major version: ${majorVersion}`);

    let artifacts;

    try {
        const response = await axios.get(JB_ARTIFACTS_JSON_URL);
        artifacts = response.data.artifacts;
    } catch (err) {
        console.log(`Failed to download list of artifacts from ${JB_ARTIFACTS_JSON_URL}`);
        throw err;
    }

    const ideaArtifact = artifacts.find(
        (artifact) =>
            artifact.groupId === "com.jetbrains.intellij.idea" && artifact.version.endsWith("-EAP-CANDIDATE-SNAPSHOT"),
    );

    console.log(ideaArtifact);

    fs.writeFileSync(workspaceYamlFilePath, rawWorkspaceYaml);
})();
