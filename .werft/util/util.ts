import { ExecOptions } from "./shell";

export async function sleep(millis: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}

export function env(k8sConfigPath: string, _parent?: ExecOptions): ExecOptions {
    const parent = _parent || {};
    if (!parent.env) {
        parent.env = {
            ...process.env,
        };
    }
    return {
        ...parent,
        env: {
            ...parent.env,
            KUBECONFIG: k8sConfigPath,
        },
    };
}
