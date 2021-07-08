import * as shell from 'shelljs';

function buildRequiredFlags(pathToKubeConfig: string): string {
    if (pathToKubeConfig != "") {
        return ` --kubeconfig=${pathToKubeConfig}`
    }
    return ""
}

export function buildGpctlBinary() {
    shell.exec(`cd /workspace/dev/gpctl && go build && cd -`)
}

export function printClustersList(pathToKubeConfig: string): string {
    let cmd = `/workspace/dev/gpctl/gpctl clusters list` + buildRequiredFlags(pathToKubeConfig)
    const result = shell.exec(cmd).trim()
    return result
}

export function uncordonCluster(pathToKubeConfig: string, name: string): string {
    let cmd = `/workspace/dev/gpctl/gpctl clusters uncordon --name=${name}` + buildRequiredFlags(pathToKubeConfig)
    const result = shell.exec(cmd).trim()
    return result
}

export function registerCluster(pathToKubeConfig: string, name: string, url: string): string {
    let cmd = `/workspace/dev/gpctl/gpctl clusters register \
	--name ${name} \
	--hint-cordoned \
	--hint-govern \
	--tls-path ./wsman-tls \
	--url ${url}` + buildRequiredFlags(pathToKubeConfig)

    const result = shell.exec(cmd).trim()
    return result
}

export function getClusterTLS(pathToKubeConfig: string): string {
    let cmd = `/workspace/dev/gpctl/gpctl clusters get-tls-config` + buildRequiredFlags(pathToKubeConfig)
    const result = shell.exec(cmd).trim()
    return result
}

