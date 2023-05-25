/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import bitbucket from "./images/bitbucket.svg";
import github from "./images/github.svg";
import gitlab from "./images/gitlab.svg";
import { gitpodHostUrl } from "./service/service";

function iconForAuthProvider(type: string) {
    switch (type) {
        case "GitHub":
            return <img className="fill-current dark:filter-invert w-5 h-5 ml-3 mr-3 my-auto" src={github} alt="" />;
        case "GitLab":
            return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={gitlab} alt="" />;
        case "Bitbucket":
            return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={bitbucket} alt="" />;
        case "BitbucketServer":
            return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={bitbucket} alt="" />;
        default:
            return <></>;
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
            let error: string | { error: string; description?: string } = atob(event.data.substring("error:".length));
            try {
                const payload = JSON.parse(error);
                if (typeof payload === "object" && payload.error) {
                    error = { ...payload };
                }
            } catch (error) {
                console.log(error);
            }

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

export { iconForAuthProvider, simplifyProviderName, openAuthorizeWindow, openOIDCStartWindow };
