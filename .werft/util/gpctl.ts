import * as shell from 'shelljs';
import { ExecOptions } from './shell';

export function buildGpctlBinary() {
    shell.exec(`cd /workspace/dev/gpctl && go build && cd -`);
}

export function printClustersList(shellOpts: ExecOptions): string {
    const result = shell.exec(`/workspace/dev/gpctl/gpctl clusters list`, { ...shellOpts, async: false }).trim();
    return result;
}

export function uncordonCluster(name: string, shellOpts: ExecOptions): string {
    const result = shell
        .exec(`/workspace/dev/gpctl/gpctl clusters uncordon --name=${name}`, { ...shellOpts, async: false })
        .trim();
    return result;
}

export function registerCluster(name: string, url: string, shellOpts: ExecOptions): string {
    const cmd = `/workspace/dev/gpctl/gpctl clusters register \
	--name ${name} \
	--hint-cordoned \
	--hint-govern \
	--tls-path ./wsman-tls \
	--url ${url}`;
    const result = shell.exec(cmd, { ...shellOpts, async: false }).trim();
    return result;
}

export function getClusterTLS(shellOpts: ExecOptions): string {
    const result = shell
        .exec(`/workspace/dev/gpctl/gpctl clusters get-tls-config`, { ...shellOpts, async: false })
        .trim();
    return result;
}
