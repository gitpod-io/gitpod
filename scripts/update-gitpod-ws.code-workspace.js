const fs = require("fs");
const JSON5 = require("json5");
const exec = require("child_process").execSync;

// File to update
const file = "gitpod-ws.code-workspace";

// Generate the updated folders array
const updateFolders = () => {
    const paths = exec("leeway collect components").toString().trim().split("\n");
    const folders = [];

    for (const path of paths) {
        if (fs.existsSync(path + "/package.json") || fs.existsSync(path + "/go.mod")) {
            folders.push({ path, name: path });
        }
    }

    console.log(`Updating ${file} with ${folders.length}`);

    // Read the contents of the file
    const contents = fs.readFileSync(file, "utf-8");
    // Parse the contents
    const data = JSON5.parse(contents);
    data.folders = folders;
    fs.writeFileSync(file, JSON5.stringify(data, null, 2));
};

updateFolders();
