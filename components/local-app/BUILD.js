const generatePackage = function (goos, goarch, binaryName, mainFile) {
    let name = binaryName + "-" + goos + "-" + goarch;
    let dontTest = !(goos === "linux" && goarch === "amd64");
    if (goos === "windows") {
        binaryName += ".exe";
    }
    let pkg = {
        name,
        type: "go",
        srcs: ["go.mod", "go.sum", "**/*.go"],
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
                "go",
                "build",
                "-trimpath",
                "-ldflags",
                "-buildid= -w -s -X 'github.com/gitpod-io/local-app/pkg/common.Version=commit-${__git_commit}'",
                "-o",
                binaryName,
                mainFile,
            ],
        },
        binaryName,
    };
    return pkg;
};

const packages = [];
for (binaryName of ["local-app", "gitpod-cli"]) {
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
