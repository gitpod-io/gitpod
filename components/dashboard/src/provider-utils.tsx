/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import bitbucket from "./images/bitbucket.svg";
import github from "./images/github.svg";
import gitlab from "./images/gitlab.svg";
import azuredevops from "./images/azuredevops.svg";
import { gitpodHostUrl } from "./service/service";

function iconForAuthProvider(type: string | AuthProviderType) {
    switch (type) {
        case "GitHub":
        case AuthProviderType.GITHUB:
            return <img className="fill-current dark:filter-invert w-5 h-5 ml-3 mr-3 my-auto" src={github} alt="" />;
        case "GitLab":
        case AuthProviderType.GITLAB:
            return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={gitlab} alt="" />;
        case "Bitbucket":
        case AuthProviderType.BITBUCKET:
            return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={bitbucket} alt="" />;
        case "BitbucketServer":
        case AuthProviderType.BITBUCKET_SERVER:
            return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={bitbucket} alt="" />;
        case "AzureDevOps":
        case AuthProviderType.AZURE_DEVOPS:
            return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={azuredevops} alt="" />;
        default:
            return <></>;
    }
}

export function toAuthProviderLabel(type: AuthProviderType) {
    switch (type) {
        case AuthProviderType.GITHUB:
            return "GitHub";
        case AuthProviderType.GITLAB:
            return "GitLab";
        case AuthProviderType.BITBUCKET:
            return "Bitbucket Cloud";
        case AuthProviderType.BITBUCKET_SERVER:
            return "Bitbucket Server";
        case AuthProviderType.AZURE_DEVOPS:
            return "Azure DevOps";
        default:
            return "-";
    }
}

function simplifyProviderName(host: string) {
    switch (host) {
        case "github.com":
            return "GitHub";
        case "gitlab.com":
            return "GitLab";
        case "bitbucket.org":
            return "Bitbucket";
        case "dev.azure.com":
            return "Azure DevOps";
        default:
            return host;
    }
}

interface WindowMessageHandler {
    onSuccess?: (payload?: string) => void;
    onError?: (error: string | { error: string; description?: string }) => void;
}

interface OpenAuthorizeWindowParams extends WindowMessageHandler {
    login?: boolean;
    host: string;
    scopes?: string[];
    overrideScopes?: boolean;
    overrideReturn?: string;
}

async function openAuthorizeWindow(params: OpenAuthorizeWindowParams) {
    const { login, host, scopes, overrideScopes } = params;
    const successKey = getUniqueSuccessKey();
    let search = `message=${successKey}`;
    const returnTo = gitpodHostUrl.with({ pathname: "complete-auth", search: search }).toString();
    const requestedScopes = scopes || [];
    const url = login
        ? gitpodHostUrl
              .withApi({
                  pathname: "/login",
                  search: `host=${host}&returnTo=${encodeURIComponent(returnTo)}`,
              })
              .toString()
        : gitpodHostUrl
              .withApi({
                  pathname: "/authorize",
                  search: `returnTo=${encodeURIComponent(returnTo)}&host=${host}${
                      overrideScopes ? "&override=true" : ""
                  }&scopes=${requestedScopes.join(",")}`,
              })
              .toString();

    openModalWindow(url);

    attachMessageListener(successKey, params);
}

async function redirectToAuthorize(params: OpenAuthorizeWindowParams) {
    const { login, host, scopes, overrideScopes } = params;
    const successKey = getUniqueSuccessKey();
    const searchParamsReturn = new URLSearchParams({ message: successKey });
    for (const [key, value] of new URLSearchParams(window.location.search)) {
        if (key === "message") {
            continue;
        }
        searchParamsReturn.append(key, value);
    }
    const returnTo = gitpodHostUrl
        .with({ pathname: window.location.pathname, search: searchParamsReturn.toString(), hash: window.location.hash })
        .toString();
    const requestedScopes = scopes ?? [];
    const url = login
        ? gitpodHostUrl
              .withApi({
                  pathname: "/login",
                  search: `host=${host}&returnTo=${encodeURIComponent(returnTo)}`,
              })
              .toString()
        : gitpodHostUrl
              .withApi({
                  pathname: "/authorize",
                  search: `returnTo=${encodeURIComponent(returnTo)}&host=${host}${
                      overrideScopes ? "&override=true" : ""
                  }&scopes=${requestedScopes.join(",")}`,
              })
              .toString();

    window.location.href = url;
}

function openModalWindow(url: string) {
    const width = 800;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Optimistically assume that the new window was opened.
    window.open(
        url,
        "gitpod-auth-window",
        `width=${width},height=${height},top=${top},left=${left},status=yes,scrollbars=yes,resizable=yes`,
    );
}

function parseError(data: string) {
    let error: string | { error: string; description?: string } = atob(data.substring("error:".length));
    try {
        const payload = JSON.parse(error);
        if (typeof payload === "object" && payload.error) {
            error = { ...payload };
        }
    } catch (error) {
        console.log(error);
    }

    return error;
}

function attachMessageListener(successKey: string, { onSuccess, onError }: WindowMessageHandler) {
    const eventListener = (event: MessageEvent) => {
        if (event?.origin !== document.location.origin) {
            return;
        }

        const killAuthWindow = () => {
            window.removeEventListener("message", eventListener);

            if (event.source && "close" in event.source && event.source.close) {
                console.log(`Received Auth Window Result. Closing Window.`);
                event.source.close();
            }
        };

        if (typeof event.data === "string" && event.data.startsWith(successKey)) {
            killAuthWindow();
            onSuccess && onSuccess(event.data);
        }
        if (typeof event.data === "string" && event.data.startsWith("error:")) {
            const error = parseError(event.data);

            killAuthWindow();
            onError && onError(error);
        }
    };
    window.addEventListener("message", eventListener);
}

interface OpenOIDCStartWindowParams extends WindowMessageHandler {
    orgSlug?: string;
    configId?: string;
    activate?: boolean;
    verify?: boolean;
}

/**
 * @param orgSlug when empty, tries to log in the user using the SSO for a single-org setup
 */
async function redirectToOIDC({ orgSlug = "", configId, activate = false, verify = false }: OpenOIDCStartWindowParams) {
    const successKey = getUniqueSuccessKey();
    const searchParamsReturn = new URLSearchParams({ message: successKey });
    for (const [key, value] of new URLSearchParams(window.location.search)) {
        if (key === "message") {
            continue;
        }
        searchParamsReturn.append(key, value);
    }
    const returnTo = gitpodHostUrl
        .with({ pathname: window.location.pathname, search: searchParamsReturn.toString(), hash: window.location.hash })
        .toString();
    const searchParams = new URLSearchParams({ returnTo });
    if (orgSlug) {
        searchParams.append("orgSlug", orgSlug);
    }
    if (configId) {
        searchParams.append("id", configId);
    }
    if (activate) {
        searchParams.append("activate", "true");
    } else if (verify) {
        searchParams.append("verify", "true");
    }

    const url = gitpodHostUrl
        .with(() => ({
            pathname: `/iam/oidc/start`,
            search: searchParams.toString(),
        }))
        .toString();

    window.location.href = url;
}

async function openOIDCStartWindow(params: OpenOIDCStartWindowParams) {
    const { orgSlug, configId, activate = false, verify = false } = params;
    const successKey = getUniqueSuccessKey();
    let search = `message=${successKey}`;
    const returnTo = gitpodHostUrl.with({ pathname: "complete-auth", search }).toString();
    const searchParams = new URLSearchParams({ returnTo });
    if (orgSlug) {
        searchParams.append("orgSlug", orgSlug);
    }
    if (configId) {
        searchParams.append("id", configId);
    }
    if (activate) {
        searchParams.append("activate", "true");
    } else if (verify) {
        searchParams.append("verify", "true");
    }

    const url = gitpodHostUrl
        .with((url) => ({
            pathname: `/iam/oidc/start`,
            search: searchParams.toString(),
        }))
        .toString();

    openModalWindow(url);

    attachMessageListener(successKey, params);
}

// Used to ensure each callback is handled uniquely
let counter = 0;
const getUniqueSuccessKey = () => {
    return `success:${counter++}`;
};

export {
    iconForAuthProvider,
    simplifyProviderName,
    openAuthorizeWindow,
    openOIDCStartWindow,
    redirectToAuthorize,
    redirectToOIDC,
    parseError,
};
