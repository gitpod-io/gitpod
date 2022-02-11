(() => {
    const fs = require('fs');
    const path = require('path');
    // const roots = ['client']; // XXX: patch the `lib` instead?

    const replacements = [
        { from: './image-builder-api/imgbuilder_pb.js', to: '@gitpod/image-builder/lib' },
        { from: './image-builder-api/imgbuilder_pb', to: '@gitpod/image-builder/lib' },
    ]

    for (const sub of replacements) {
        console.info(`🔧  >>> Patching code. Switching from '${sub.from}' to '${sub.to}'...`);
        const cliProtocolPath = path.resolve(".");
        for (const fileName of fs.readdirSync(cliProtocolPath)) {
            if (fileName.indexOf("patch-grpc-js") !== -1) {
                continue;
            }

            const filePath = path.resolve(cliProtocolPath, fileName);
            if (fs.lstatSync(filePath).isDirectory()) {
                continue;
            }

            let content = fs.readFileSync(filePath, { encoding: 'utf8' });
            if (content.indexOf(sub.from) !== -1) {
                console.info(`Updated '${sub.from}' to '${sub.to}' in ${filePath}.`);
                fs.writeFileSync(filePath, content.replace(sub.from, sub.to));
            }
        }
    }
    console.info('👌  <<< Done. The code has been patched.');
})();