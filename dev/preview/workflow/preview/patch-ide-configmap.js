// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

const fs = require("fs");
let json = JSON.parse(fs.readFileSync(process.argv[2]).toString());

function replaceImage(image) {
    return image.replace("gitpod-dev-artifact", "gitpod-core-dev");
}

for (let ide in json.ideOptions.options) {
    if (
        ["clion", "goland", "intellij", "phpstorm", "pycharm", "rider", "rubymine", "webstorm", "rustrover"].includes(
            ide,
        )
    ) {
        json.ideOptions.options[ide].versions = json.ideOptions.options[ide].versions?.map((version) => {
            version.image = replaceImage(version.image);
            version.imageLayers = version.imageLayers.map(replaceImage);
            return version;
        });
    }
    if (["code", "code1_85"].includes(ide)) {
        json.ideOptions.options[ide].image = replaceImage(json.ideOptions.options[ide].image);
        json.ideOptions.options[ide].imageLayers = json.ideOptions.options[ide].imageLayers.map(replaceImage);
        json.ideOptions.options[ide].versions = json.ideOptions.options[ide].versions?.map((version) => {
            version.image = replaceImage(version.image);
            version.imageLayers = version.imageLayers.map(replaceImage);
            return version;
        });
    }
    if (["intellij-previous"].includes(ide)) {
        json.ideOptions.options[ide].image = replaceImage(json.ideOptions.options[ide].image);
        json.ideOptions.options[ide].imageLayers = json.ideOptions.options[ide].imageLayers.map((i) => replaceImage(i));
    }
}

fs.writeFileSync(process.argv[2], JSON.stringify(json));
