/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
import { useContext, useEffect, useState, useMemo, useCallback, FC } from "react";
import { UserContext } from "./user-context";
import { getGitpodService } from "./service/service";
import { iconForAuthProvider, openAuthorizeWindow, simplifyProviderName } from "./provider-utils";
import gitpod from "./images/gitpod.svg";
import gitpodDark from "./images/gitpod-dark.svg";
import gitpodIcon from "./icons/gitpod.svg";
import exclamation from "./images/exclamation.svg";
import { getURLHash } from "./utils";
import ErrorMessage from "./components/ErrorMessage";
import { Heading1, Heading2, Subheading } from "./components/typography/headings";
import { SSOLoginForm } from "./login/SSOLoginForm";
import { useAuthProviders } from "./data/auth-providers/auth-provider-query";
import { SetupPending } from "./login/SetupPending";
import { useNeedsSetup } from "./dedicated-setup/use-needs-setup";

export function markLoggedIn() {
    document.cookie = GitpodCookie.generateCookie(window.location.hostname);
}

export function hasLoggedInBefore() {
    return GitpodCookie.isPresent(document.cookie);
}

type LoginProps = {
    onLoggedIn?: () => void;
};
export const Login: FC<LoginProps> = ({ onLoggedIn }) => {
    const { setUser } = useContext(UserContext);

    const urlHash = useMemo(() => getURLHash(), []);

    const authProviders = useAuthProviders();
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [hostFromContext, setHostFromContext] = useState<string | undefined>();
    const [repoPathname, setRepoPathname] = useState<string | undefined>();

    // This flag lets us know if the current installation still needs setup
    const { needsSetup, isLoading: needsSetupCheckLoading } = useNeedsSetup();

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

    let providerFromContext: AuthProviderInfo | undefined;
    if (hostFromContext && authProviders.data) {
        providerFromContext = authProviders.data.find((provider) => provider.host === hostFromContext);
    }

    const updateUser = useCallback(async () => {
        await getGitpodService().reconnect();
        const user = await getGitpodService().server.getLoggedInUser();
        setUser(user);
        markLoggedIn();
    }, [setUser]);

    const authorizeSuccessful = useCallback(async () => {
        updateUser().catch(console.error);

        onLoggedIn && onLoggedIn();

        const returnToPath = new URLSearchParams(window.location.search).get("returnToPath");
        if (returnToPath) {
            const isAbsoluteURL = /^https?:\/\//i.test(returnToPath);
            if (!isAbsoluteURL) {
                window.location.replace(returnToPath);
            }
        }
    }, [onLoggedIn, updateUser]);

    const openLogin = useCallback(
        async (host: string) => {
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
        },
        [authorizeSuccessful],
    );

    return (
        <div id="login-container" className="z-50 flex w-screen h-screen">
            <div id="login-section" className={"flex-grow flex w-full"}>
                <div id="login-section-column" className={"flex-grow max-w-2xl flex flex-col h-100 mx-auto"}>
                    {needsSetupCheckLoading ? (
                        // empty filler container to keep the layout stable
                        <div className="flex-grow" />
                    ) : needsSetup ? (
                        <SetupPending alwaysShowHeader />
                    ) : (
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
                                        <Heading1>Log in to Gitpod</Heading1>
                                    )}
                                </div>

                                <div className="w-56 mx-auto flex flex-col space-y-3 items-center">
                                    {providerFromContext ? (
                                        <button
                                            key={"button" + providerFromContext.host}
                                            className="btn-login flex-none w-56 h-10 p-0 inline-flex rounded-xl"
                                            onClick={() => openLogin(providerFromContext!.host)}
                                        >
                                            {iconForAuthProvider(providerFromContext.authProviderType)}
                                            <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">
                                                Continue with {simplifyProviderName(providerFromContext.host)}
                                            </span>
                                        </button>
                                    ) : (
                                        authProviders.data?.map((ap) => (
                                            <button
                                                key={"button" + ap.host}
                                                className="btn-login flex-none w-56 h-10 p-0 inline-flex rounded-xl"
                                                onClick={() => openLogin(ap.host)}
                                            >
                                                {iconForAuthProvider(ap.authProviderType)}
                                                <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">
                                                    Continue with {simplifyProviderName(ap.host)}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                    <SSOLoginForm
                                        onSuccess={authorizeSuccessful}
                                        singleOrgMode={!!authProviders.data && authProviders.data.length === 0}
                                    />
                                </div>
                                {errorMessage && <ErrorMessage imgSrc={exclamation} message={errorMessage} />}
                            </div>
                        </div>
                    )}
                    {/* If we have the login view showing, show this as well */}
                    {!needsSetup && !needsSetupCheckLoading && (
                        <div className="flex-none mx-auto text-center px-4 pb-4">
                            <span className="text-gray-400 dark:text-gray-500 text-sm">
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
                    )}
                </div>
            </div>
        </div>
    );
};
