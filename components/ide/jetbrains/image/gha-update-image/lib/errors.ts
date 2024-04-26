export class MultipleMajorVersionsError extends Error {
    constructor(majorVersions: string[]) {
        super(`Multiple major versions found, skipping update: ${majorVersions.join(", ")}`);
    }
}

export class MultipleBuildVersionsError extends Error {
    constructor(majorBuildVersions: string[]) {
        super(`Multiple build versions (major) found, skipping update: ${majorBuildVersions.join(", ")}`);
    }
}
