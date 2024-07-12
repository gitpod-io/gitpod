const generatePackage = function (goos, goarch, binaryName, mainFile) {
    let name = binaryName + "-" + goos + "-" + goarch;
    let dontTest = !(goos === "linux" && goarch === "amd64");
    if (goos === "windows") {
        binaryName += ".exe";
    }
    let pkg = {
        name,
        type: "go",
        srcs: ["go.mod", "go.sum", "**/*.go", "version.txt"],
        deps: [
            "components/supervisor-api/go:lib",
            "components/gitpod-protocol/go:lib",
            "components/local-app-api/go:lib",
            "components/public-api/go:lib",
        ],
        env: ["GOOS=" + goos, "GOARCH=" + goarch, "CGO_ENABLED=0"],
        config: {
            packaging: "app",
            dontTest: dontTest,
            buildCommand: [
                "sh",
                "-c",
                // We need to set GOARCH explicitly here because the `defaultVariant` in `WORKSPACE.yaml` overrides it for the workspace
                `GOARCH=${goarch} go build -trimpath -ldflags "-X github.com/gitpod-io/local-app/pkg/constants.GitCommit=\${__git_commit} -X github.com/gitpod-io/local-app/pkg/constants.BuildTime=\$(date +%s)" -o ${binaryName} ${mainFile}`,
            ],
        },
        binaryName,
    };
    return pkg;
};

const packages = [];
for (binaryName of ["gitpod-local-companion", "gitpod-cli"]) {
    for (goos of ["linux", "darwin", "windows"]) {
        for (goarch of ["amd64", "arm64"]) {
            packages.push(generatePackage(goos, goarch, binaryName, "main/" + binaryName + "/main.go"));
        }
    }
}

let appCmds = packages.map((p) => {
    let binName = p.name;
    if (p.name.includes("windows")) {
        binName += ".exe";
    }
    return ["cp", "components-local-app--" + p.name + "/" + p.binaryName, "bin/" + binName];
});
appCmds.unshift(["mkdir", "bin"]);
appCmds.push(["sh", "-c", "rm -rf components-*"]);

packages.push({
    name: "app",
    type: "generic",
    deps: packages.map((d) => ":" + d.name),
    config: {
        commands: appCmds,
    },
});
