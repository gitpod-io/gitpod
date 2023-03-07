/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
import { useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "./user-context";
import { getGitpodService } from "./service/service";
import { iconForAuthProvider, openAuthorizeWindow, simplifyProviderName, getSafeURLRedirect } from "./provider-utils";
import gitpod from "./images/gitpod.svg";
import gitpodDark from "./images/gitpod-dark.svg";
import gitpodIcon from "./icons/gitpod.svg";
import automate from "./images/welcome/automate.svg";
import code from "./images/welcome/code.svg";
import collaborate from "./images/welcome/collaborate.svg";
import customize from "./images/welcome/customize.svg";
import fresh from "./images/welcome/fresh.svg";
import prebuild from "./images/welcome/prebuild.svg";
import exclamation from "./images/exclamation.svg";
import { getURLHash } from "./utils";
import ErrorMessage from "./components/ErrorMessage";
import { Heading1, Heading2, Subheading } from "./components/typography/headings";

function Item(props: { icon: string; iconSize?: string; text: string }) {
    const iconSize = props.iconSize || 28;
    return (
        <div className="flex-col items-center w-1/3 px-3">
            <img src={props.icon} alt={props.text} className={`w-${iconSize} m-auto h-24`} />
            <div className="text-gray-400 text-sm w-36 h-20 text-center">{props.text}</div>
        </div>
    );
}

export function markLoggedIn() {
    document.cookie = GitpodCookie.generateCookie(window.location.hostname);
}

export function hasLoggedInBefore() {
    return GitpodCookie.isPresent(document.cookie);
}

export function hasVisitedMarketingWebsiteBefore() {
    return document.cookie.match("gitpod-marketing-website-visited=true");
}

export function Login() {
    const { setUser } = useContext(UserContext);

    const urlHash = useMemo(() => getURLHash(), []);

    const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [providerFromContext, setProviderFromContext] = useState<AuthProviderInfo>();
    const [hostFromContext, setHostFromContext] = useState<string | undefined>();
    const [repoPathname, setRepoPathname] = useState<string | undefined>();

    const showWelcome = !hasLoggedInBefore() && !hasVisitedMarketingWebsiteBefore() && !urlHash.startsWith("https://");

    useEffect(() => {
        try {
            if (urlHash.length > 0) {
                const url = new URL(urlHash);
                setHostFromContext(url.host);
                setRepoPathname(url.pathname);
            }
        } catch (error) {
            // Hash is not a valid URL
        }
    }, [urlHash]);

    useEffect(() => {
        (async () => {
            setAuthProviders(await getGitpodService().server.getAuthProviders());
        })();
    }, []);

    useEffect(() => {
        if (hostFromContext && authProviders) {
            const providerFromContext = authProviders.find((provider) => provider.host === hostFromContext);
            setProviderFromContext(providerFromContext);
        }
    }, [hostFromContext, authProviders]);

    const authorizeSuccessful = async (payload?: string) => {
        updateUser().catch(console.error);

        // Check for a valid returnTo in payload
        const safeReturnTo = getSafeURLRedirect(payload);
        if (safeReturnTo) {
            // ... and if it is, redirect to it
            window.location.replace(safeReturnTo);
        }
    };

    const updateUser = async () => {
        await getGitpodService().reconnect();
        const [user] = await Promise.all([getGitpodService().server.getLoggedInUser()]);
        setUser(user);
        markLoggedIn();
    };

    const openLogin = async (host: string) => {
        setErrorMessage(undefined);

        try {
            await openAuthorizeWindow({
                login: true,
                host,
                onSuccess: authorizeSuccessful,
                onError: (payload) => {
                    let errorMessage: string;
                    if (typeof payload === "string") {
                        errorMessage = payload;
                    } else {
                        errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                        if (payload.error === "email_taken") {
                            errorMessage = `Email address already used in another account. Please log in with ${
                                (payload as any).host
                            }.`;
                        }
                    }
                    setErrorMessage(errorMessage);
                },
            });
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div id="login-container" className="z-50 flex w-screen h-screen">
            {showWelcome ? (
                <div id="feature-section" className="flex-grow bg-gray-100 dark:bg-gray-800 w-1/2 hidden lg:block">
                    <div id="feature-section-column" className="flex max-w-xl h-full mx-auto pt-6">
                        <div className="flex flex-col px-8 my-auto ml-auto">
                            <div className="mb-12">
                                <img src={gitpod} className="h-8 block dark:hidden" alt="Gitpod light theme logo" />
                                <img src={gitpodDark} className="h-8 hidden dark:block" alt="Gitpod dark theme logo" />
                            </div>
                            <div className="mb-10">
                                <Heading1 className="text-5xl mb-3">Welcome to Gitpod</Heading1>
                                <Subheading className="text-gray-400 text-lg">
                                    Spin up fresh cloud development environments for each task, fully automated, in
                                    seconds.
                                </Subheading>
                            </div>
                            <div className="flex mb-10">
                                <Item icon={code} iconSize="16" text="Always Ready&#x2011;To&#x2011;Code" />
                                <Item icon={customize} text="Personalize your Workspace" />
                                <Item icon={automate} text="Automate Your Development Setup" />
                            </div>
                            <div className="flex">
                                <Item icon={prebuild} text="Continuously Prebuild Your Project" />
                                <Item icon={collaborate} text="Collaborate With Your Team" />
                                <Item icon={fresh} text="Fresh Workspace For Each New Task" />
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
            <div id="login-section" className={"flex-grow flex w-full" + (showWelcome ? " lg:w-1/2" : "")}>
                <div
                    id="login-section-column"
                    className={"flex-grow max-w-2xl flex flex-col h-100 mx-auto" + (showWelcome ? " lg:my-0" : "")}
                >
                    <div className="flex-grow h-100 flex flex-row items-center justify-center">
                        <div className="rounded-xl px-10 py-10 mx-auto">
                            <div className="mx-auto pb-8">
                                <img
                                    src={providerFromContext ? gitpod : gitpodIcon}
                                    className="h-14 mx-auto block dark:hidden"
                                    alt="Gitpod's logo"
                                />
                                <img
                                    src={providerFromContext ? gitpodDark : gitpodIcon}
                                    className="h-14 hidden mx-auto dark:block"
                                    alt="Gitpod dark theme logo"
                                />
                            </div>

                            <div className="mx-auto text-center pb-8 space-y-2">
                                {providerFromContext ? (
                                    <>
                                        <Heading2>Open a cloud development environment</Heading2>
                                        <Subheading>for the repository {repoPathname?.slice(1)}</Subheading>
                                    </>
                                ) : (
                                    <>
                                        <Heading1>Log in{showWelcome ? "" : " to Gitpod"}</Heading1>
                                        <Subheading className="uppercase text-sm text-gray-400">
                                            ALWAYS READY-TO-CODE
                                        </Subheading>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-col space-y-3 items-center">
                                {providerFromContext ? (
                                    <button
                                        key={"button" + providerFromContext.host}
                                        className="btn-login flex-none w-56 h-10 p-0 inline-flex"
                                        onClick={() => openLogin(providerFromContext.host)}
                                    >
                                        {iconForAuthProvider(providerFromContext.authProviderType)}
                                        <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">
                                            Continue with {simplifyProviderName(providerFromContext.host)}
                                        </span>
                                    </button>
                                ) : (
                                    authProviders.map((ap) => (
                                        <button
                                            key={"button" + ap.host}
                                            className="btn-login flex-none w-56 h-10 p-0 inline-flex"
                                            onClick={() => openLogin(ap.host)}
                                        >
                                            {iconForAuthProvider(ap.authProviderType)}
                                            <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">
                                                Continue with {simplifyProviderName(ap.host)}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                            {errorMessage && <ErrorMessage imgSrc={exclamation} message={errorMessage} />}
                        </div>
                    </div>
                    <div className="flex-none mx-auto h-20 text-center">
                        <span className="text-gray-400">
                            By signing in, you agree to our{" "}
                            <a
                                className="gp-link hover:text-gray-600"
                                target="gitpod-terms"
                                href="https://www.gitpod.io/terms/"
                            >
                                terms of service
                            </a>{" "}
                            and{" "}
                            <a
                                className="gp-link hover:text-gray-600"
                                target="gitpod-privacy"
                                href="https://www.gitpod.io/privacy/"
                            >
                                privacy policy
                            </a>
                            .
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
