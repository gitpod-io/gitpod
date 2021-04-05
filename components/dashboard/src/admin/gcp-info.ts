/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceAndInstance } from "@gitpod/gitpod-protocol";

export function getAdminLinks(workspace: WorkspaceAndInstance): { name: string, title: string, url: string }[] {
    const gcpInfo = deriveGcpInfo(workspace.ideUrl, workspace.region);
    if (gcpInfo == undefined) {
        return [];
    }
    const { gcp, baseDomain } = gcpInfo;

    const context: UrlTemplateContext = {
        ...gcp,
        baseDomain,
        workspaceId: workspace.workspaceId,
        instanceId: workspace.instanceId,
        nodeName: workspace.status.nodeName,
        podName: workspace.status.podName,
        nodeIp: workspace.status.nodeIp,
    };
    const result = [];
    for (const link of ADMIN_LINKS) {
        const url = render(link.urlTemplate, context);
        result.push({
            name: link.name,
            title: render(link.title, context),
            url
        });
    }
    return result;
}

const ADMIN_LINKS: Link[] = [
    {
        name: "GKE Pod",
        title: "${podName}",
        urlTemplate: "https://console.cloud.google.com/kubernetes/pod/${region}/${clusterName}/${namespace}/${podName}/details?project=${projectName}"
    },
    {
        name: "GKE Node",
        title: "${nodeName}",
        urlTemplate: "https://console.cloud.google.com/kubernetes/node/${region}/${clusterName}/${nodeName}/summary?project=${projectName}"
    },
    {
        name: "Workspace Pod Logs",
        title: "See Logs",
        urlTemplate: "https://console.cloud.google.com/logs/query;query=resource.type%3D%22k8s_container%22%0Aresource.labels.project_id%3D%22${projectName}%22%0Aresource.labels.location%3D%22${region}%22%0Aresource.labels.cluster_name%3D%22${clusterName}%22%0Aresource.labels.namespace_name%3D%22${namespace}%22%0Aresource.labels.pod_name%3D%22${podName}%22?project=${projectName}"
    },
    {
        name: "Grafana Workspace",
        title: "Pod Metrics",
        urlTemplate: "https://monitoring.${baseDomain}/d/admin-workspace/admin-workspace?var-workspace=${podName}"
    },
    {
        name: "Grafana Node",
        title: "Node Metrics",
        urlTemplate: "https://monitoring.${baseDomain}/d/admin-node/admin-node?var-node=${nodeName}"
    },
];

function deriveGcpInfo(ideUrlStr: string, region: string): { gcp: GcpInfo, baseDomain: string } | undefined {
    const ideUrl = new URL(ideUrlStr);
    const hostnameParts = ideUrl.hostname.split(".")
    const baseDomain = hostnameParts.slice(hostnameParts.length - 2).join(".");
    const namespace = hostnameParts[hostnameParts.length - 4];

    const gcp = getGcpInfo(baseDomain, region, namespace);
    if (!gcp) {
        return undefined;
    }
    return {
        gcp,
        baseDomain,
    }
}

function getGcpInfo(baseDomain: string, regionShort: string, namespace?: string): GcpInfo | undefined {
    if (baseDomain === "gitpod.io") {
        if (regionShort === "eu03") {
            return {
                clusterName: "prod--gitpod-io--europe-west1--03",
                namespace: 'default',
                region: "europe-west1",
                projectName: "gitpod-191109",
            };
        }
        if (regionShort === "us03") {
            return {
                clusterName: "prod--gitpod-io--us-west1--03",
                namespace: 'default',
                region: "us-west1",
                projectName: "gitpod-191109",
            };
        }
    }
    if (baseDomain === "gitpod-staging.com") {
        if (regionShort === "eu02") {
            return {
                clusterName: "staging--gitpod-io--eu-west1--02",
                namespace: 'default',
                region: "europe-west1",
                projectName: "gitpod-staging",
            };
        }
        if (regionShort === "us02") {
            return {
                clusterName: "staging--gitpod-io--us-west1--02",
                namespace: 'default',
                region: "us-west1",
                projectName: "gitpod-staging",
            };
        }
    }
    if (baseDomain === "gitpod-dev.com") {
        return {
            clusterName: "dev",
            namespace: 'staging-' + namespace,
            region: "europe-west1-b",
            projectName: "gitpod-core-dev",
        };
    }
    return undefined;
}

interface GcpInfo {
    readonly clusterName: string;
    readonly region: string;
    readonly projectName: string;
    readonly namespace: string;
}

export interface Link {
    readonly name: string;
    // Supports all variables from UrlTemplateContext
    readonly title: string;
    // Supports all variables from UrlTemplateContext
    readonly urlTemplate: string;
}
export interface UrlTemplateContext extends GcpInfo {
    readonly baseDomain: string;
    readonly workspaceId: string;
    readonly instanceId: string;
    readonly podName?: string;
    readonly nodeName?: string;
    readonly nodeIp?: string;
}

function render(template: string, context: UrlTemplateContext): string {
    const VAR_REGEXP = /\$\{(.*?)\}/g;

    return template.replace(VAR_REGEXP, (match: string, varName: keyof UrlTemplateContext) => {
        const varValue = context[varName];
        return varValue !== undefined ? varValue : match;
    });
}