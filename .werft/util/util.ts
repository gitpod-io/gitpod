import { ExecOptions } from "./shell";

export async function sleep(millis: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, millis);
  });
}

export function validateIPaddress(ipaddress) {
  if (
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
      ipaddress
    )
  ) {
    return true;
  }
  return false;
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
