const semver = require('semver');
if (!semver.valid(process.argv[2])) {
    process.exit(1)
}