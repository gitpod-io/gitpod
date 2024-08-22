// bun run force-update-jb.ts --ide=intellij --version=2024.2.0.2
import { parseArgs } from "util";
import { pathToWorkspaceYaml, readWorkspaceYaml } from "./lib/common";
import { appendPinVersionsIntoIDEConfigMap } from "./lib/jb-pin-version";

const { values } = parseArgs({
    args: Bun.argv,
    options: {
        ide: {
            type: "string",
        },
        version: {
            type: "string",
        },
    },
    strict: true,
    allowPositionals: true,
});

if (!values.ide || !values.version) {
    throw new Error("ide and version are required.");
}

const workspaceYaml = await readWorkspaceYaml();

const oldDownloadurl = workspaceYaml.parsedObj.defaultArgs[`${values.ide}DownloadUrl`];

if (!oldDownloadurl) {
    throw new Error("ide is not supported");
}

const newWorkspaceYaml = workspaceYaml.rawText.replace(
    oldDownloadurl,
    oldDownloadurl.replace(/-(.*?).tar.gz/, `-${values.version}.tar.gz`),
);
await Bun.write(pathToWorkspaceYaml, newWorkspaceYaml);

await appendPinVersionsIntoIDEConfigMap([values.ide]);
