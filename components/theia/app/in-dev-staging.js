/*

This script runs any command (assumably the theia IDE under development) in a subshell that has applied the env from the single workspace that is started
in dev-staging cluster of your kubctl context. Once the output says 'listening' (as in '... listening to localhost:4000')
the script will patch the proxy in your dev-staging installation so all workspace URLs will be redirected to the started Theia instance.

Happy coding! 🎉

*/

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function run(command) {
    console.log(command);
    const result = cp.spawnSync(command, {
        shell: true
    });
    if (result.error) {
        throw new Error(result.error.toString(), result.stderr && result.stderr.toString());
    }
    if (result.stderr && result.stderr.toString().trim() !== '') {
        console.error(result.stderr.toString());
    }
    return result.stdout.toString();
}

var files = []
function file(fileName) {
    files.push(fileName);
    return fileName;
}

function runInDevStaging(command, verbose) {
    const repo = 'https://github.com/gitpod-io/spring-petclinic';
    const folder = repo.split('/').slice(-1)[0];
    const currentBranch = run('git rev-parse --abbrev-ref HEAD').trim();
    const proxyName = run('kubectl get pod --selector=component=proxy --output=jsonpath={.items..metadata.name}').trim();
    if (proxyName === '') {
        console.error('No proxy found. Is the dev staging application deployed?');
        console.error('Deploy : https://werft.gitpod-dev.com/jobs');
        return;
    }
    const podName = run('kubectl get pods --selector=component=workspace --output=jsonpath={.items..metadata.name}');
    if (podName.indexOf(' ') !== -1) {
        console.error('Found multiple workspaces : ' + podName);
        console.error('Please make sure there is only one workspace running.');
        return;
    }
    if (podName.trim() === '') {
        console.error('No workspaces started in current cluster. Please start one:');
        console.error(`http://${currentBranch.toLowerCase().replace(/[^a-z]/g,'-')}.staging.gitpod-dev.com/#${repo}`);
        return;
    }

    console.log('Cloning repo ' + repo);
    run(`cd /workspace && git clone ${repo}.git`);

    const pod = JSON.parse(run(`kubectl get pod ${podName} -o json`));
    if (!pod || !pod.spec) {
        throw new Error(`No spec for ${podName} : tried 'kubectl get pod ${podName} -o json'`, pod);
    }

    const host = run(`gp url 4000`).trim();
    const proxyConf = run(`kubectl exec ${proxyName} -- cat /etc/nginx/vhost.server.conf`);
    const patchedConf = proxyConf.replace(
`    include lib.cors-server.conf;
    include lib.workspace-locations.conf;
    include lib.region-headers.conf;
    include lib.log-headers.conf;`,
`    # Patched for Development Mode
    location / {
        proxy_pass ${host}$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
`).replace(
`    include lib.workspace-port-locations.conf;
    include lib.region-headers.conf;
    include lib.log-headers.conf;`,
`    # Patched for Development Mode
    location / {
        proxy_pass ${host.replace('4000', '$port').trim()}$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }`);

    const proxyConfFile = file(proxyName+'-original.conf');
    const patchedProxyConfFile = file(proxyName+'-patched.conf');
    if (!fs.existsSync(proxyConfFile)) {
        fs.writeFileSync(proxyConfFile, proxyConf);
    }
    if (!fs.existsSync(patchedProxyConfFile)) {
        fs.writeFileSync(patchedProxyConfFile, patchedConf);
    }

    // create env for local subshell
    const env = {};
    for (const pair of pod.spec.containers[0].env) {
        env[pair.name] = pair.value;
    }

    const wsFile = path.resolve(os.homedir(), '.theia', 'recentworkspace.json');
    const recentWsExists = fs.existsSync(wsFile);
    if (recentWsExists) {
        fs.renameSync(wsFile, wsFile+'.bk');
    }

    // run command in env
    const result = cp.spawn(command, {
        shell: true,
        env: {
            ...process.env,
            ...env
        }
    });

    function patchProxy(localFile) {
        // update proxy conf
        console.log(`patching proxy with ${localFile}`);
        console.log(run(`kubectl exec -i ${proxyName} -- /bin/bash -c 'cat > /etc/nginx/vhost.server.conf' < ${localFile}`));
        console.log(run(`kubectl exec -i ${proxyName} -- /etc/init.d/nginx reload`));
    }

    function onClose() {
        patchProxy(proxyConfFile);
        if (recentWsExists) {
            fs.renameSync(wsFile+'.bk', wsFile);
        }
        files.forEach( f => {
            if (fs.existsSync(f)) {
                fs.unlinkSync(f);
            }
        });
    }

    result.stdout.on('data', data => {
        const strData = data.toString();
        console.log(strData);
        if (strData.indexOf('listening') !== -1) {
            patchProxy(patchedProxyConfFile);
            run(`gp preview ${pod.metadata.annotations["gitpod/url"]}/#/workspace/${folder}`);
        }
    });
    result.stderr.on('data', data => {
        console.error(data.toString());
    });

    result.on('close', () => onClose());
    process.on('SIGINT', () => {
        onClose();
        process.exit();
    });
}

const command = process.argv.slice(2).join(' ');
runInDevStaging(command);
