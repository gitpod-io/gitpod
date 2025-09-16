/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
import { useContext, useEffect, useState, useMemo, useCallback, FC } from "react";
import { UserContext } from "./user-context";
import { getGitpodService } from "./service/service";
import { iconForAuthProvider, openAuthorizeWindow, simplifyProviderName } from "./provider-utils";
import exclamation from "./images/exclamation.svg";
import { getURLHash, isTrustedUrlOrPath } from "./utils";
import ErrorMessage from "./components/ErrorMessage";
import { Heading1, Heading2, Subheading } from "./components/typography/headings";
import { SSOLoginForm } from "./login/SSOLoginForm";
import { useAuthProviderDescriptions } from "./data/auth-providers/auth-provider-descriptions-query";
import { SetupPending } from "./login/SetupPending";
import { useNeedsSetup } from "./dedicated-setup/use-needs-setup";
import { useInstallationConfiguration } from "./data/installation/installation-config-query";
import { AuthProviderDescription } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { Button, ButtonProps } from "@podkit/buttons/Button";
import { cn } from "@podkit/lib/cn";
import { userClient } from "./service/public-api";
import { ProductLogo } from "./components/ProductLogo";
import { useIsDataOps } from "./data/featureflag-query";
import { LoadingState } from "@podkit/loading/LoadingState";
import { isGitpodIo } from "./utils";
import onaWordmark from "./images/ona-wordmark.svg";
import onaApplication from "./images/ona-application.webp";

export function markLoggedIn() {
    document.cookie = GitpodCookie.generateCookie(window.location.hostname);
}

export function hasLoggedInBefore() {
    return GitpodCookie.isPresent(document.cookie);
}

const SEGMENT_SEPARATOR = "/";
const getContextUrlFromHash = (input: string): URL | undefined => {
    if (typeof URL.canParse !== "function") {
        return undefined;
    }
    if (URL.canParse(input)) {
        return new URL(input);
    }

    const chunks = input.split(SEGMENT_SEPARATOR);
    for (const chunk of chunks) {
        input = input.replace(`${chunk}${SEGMENT_SEPARATOR}`, "");
        if (URL.canParse(input)) {
            return new URL(input);
        }
    }

    return undefined;
};

type LoginProps = {
    onLoggedIn?: () => void;
};
export const Login: FC<LoginProps> = ({ onLoggedIn }) => {
    const urlHash = useMemo(() => getURLHash(), []);
    const authProviders = useAuthProviderDescriptions();
    const [hostFromContext, setHostFromContext] = useState<string | undefined>();
    const [repoPathname, setRepoPathname] = useState<string | undefined>();

    const { data: installationConfig } = useInstallationConfiguration();
    const enterprise = !!installationConfig?.isDedicatedInstallation;

    useEffect(() => {
        try {
            if (urlHash.length > 0) {
                const url = new URL(urlHash);
                setHostFromContext(url.host);
                setRepoPathname(url.pathname);
            }
        } catch (error) {
            // hash is not a valid URL, try to extract the context URL when there are parts like env vars or other prefixes
            const contextUrl = getContextUrlFromHash(urlHash);
            if (contextUrl) {
                setHostFromContext(contextUrl.host);
                setRepoPathname(contextUrl.pathname);
            }
        }
    }, [urlHash]);

    const providerFromContext =
        (hostFromContext && authProviders.data?.find((provider) => provider.host === hostFromContext)) || undefined;

    if (authProviders.isLoading) {
        return <LoadingState />;
    }

    return (
        <div
            id="login-container"
            className="z-50 flex flex-col-reverse lg:flex-row w-full min-h-screen"
            style={
                !enterprise
                    ? {
                          background:
                              "linear-gradient(390deg, #1F1329 0%, #333A75 20%, #556CA8 50%, #90A898 60%, #90A898 70%, #E2B15C 90%, #BEA462 100%)",
                      }
                    : undefined
            }
        >
            {enterprise ? (
                <EnterpriseLoginWrapper
                    onLoggedIn={onLoggedIn}
                    providerFromContext={providerFromContext}
                    repoPathname={repoPathname}
                />
            ) : (
                <PAYGLoginWrapper
                    onLoggedIn={onLoggedIn}
                    providerFromContext={providerFromContext}
                    repoPathname={repoPathname}
                />
            )}
        </div>
    );
};

// TODO: Do we really want a different style button for the login page, or could we use our normal secondary variant?
type LoginButtonProps = {
    onClick: ButtonProps["onClick"];
};
const LoginButton: FC<LoginButtonProps> = ({ children, onClick }) => {
    return (
        <Button
            // Using ghost here to avoid the default button styles
            variant="ghost"
            // TODO: Determine if we want this one-off style of button
            className={cn(
                "border-none bg-gray-100 hover:bg-gray-200 text-gray-500 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-600 hover:opacity-100",
                "flex-none w-56 h-10 p-0 inline-flex rounded-xl",
                "justify-normal",
            )}
            onClick={onClick}
        >
            {children}
        </Button>
    );
};

type LoginWrapperProps = LoginProps & {
    providerFromContext?: AuthProviderDescription;
    repoPathname?: string;
};

const PAYGLoginWrapper: FC<LoginWrapperProps> = ({ providerFromContext, repoPathname, onLoggedIn }) => {
    return (
        <div className="flex flex-col md:flex-row w-full">
            <div
                id="login-section"
                // for some reason, min-h-dvh does not work, so we need tailwind's arbitrary values
                className="w-full min-h-[100dvh] lg:w-full flex flex-col justify-center items-center p-2"
            >
                <div
                    id="login-section-column"
                    className="bg-white dark:bg-[#161616] flex-grow rounded-xl w-full flex flex-col h-100 mx-auto"
                >
                    {
                        <div className="flex-grow h-100 flex flex-col items-center justify-center">
                            <LoginContent
                                providerFromContext={providerFromContext}
                                onLoggedIn={onLoggedIn}
                                repoPathname={repoPathname}
                            />
                        </div>
                    }
                    <TermsOfServiceAndPrivacyPolicy />
                </div>
            </div>
            <RightProductDescriptionPanel />
        </div>
    );
};

const EnterpriseLoginWrapper: FC<LoginWrapperProps> = ({ providerFromContext, repoPathname, onLoggedIn }) => {
    // This flag lets us know if the current installation still needs setup
    const { needsSetup, isLoading: needsSetupCheckLoading } = useNeedsSetup();

    return (
        <div id="login-section" className="flex-grow flex w-full">
            <div id="login-section-column" className="flex-grow max-w-2xl flex flex-col h-100 mx-auto">
                {needsSetupCheckLoading ? (
                    <div className="flex-grow" />
                ) : needsSetup ? (
                    <SetupPending alwaysShowHeader />
                ) : (
                    <div className="flex-grow h-100 flex flex-row items-center justify-center">
                        <LoginContent
                            providerFromContext={providerFromContext}
                            onLoggedIn={onLoggedIn}
                            repoPathname={repoPathname}
                        />
                    </div>
                )}
                {!needsSetup && !needsSetupCheckLoading && <TermsOfServiceAndPrivacyPolicy />}
            </div>
        </div>
    );
};

const LoginContent = ({
    providerFromContext,
    repoPathname,
    onLoggedIn,
}: {
    providerFromContext?: AuthProviderDescription;
    repoPathname?: string;
    onLoggedIn?: () => void;
}) => {
    const { setUser } = useContext(UserContext);
    const isDataOps = useIsDataOps();
    const isGitpodIoUser = isGitpodIo();

    const authProviders = useAuthProviderDescriptions();
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const { data: installationConfig } = useInstallationConfiguration();
    const enterprise = !!installationConfig?.isDedicatedInstallation;

    const updateUser = useCallback(async () => {
        await getGitpodService().reconnect();
        const { user } = await userClient.getAuthenticatedUser({});
        if (user) {
            setUser(user);
            markLoggedIn();
        }
    }, [setUser]);

    const authorizeSuccessful = useCallback(async () => {
        updateUser().catch(console.error);

        onLoggedIn && onLoggedIn();

        const returnToPath = new URLSearchParams(window.location.search).get("returnToPath");
        if (returnToPath) {
            const isAbsoluteURL = /^https?:\/\//i.test(returnToPath);
            if (!isAbsoluteURL && isTrustedUrlOrPath(returnToPath)) {
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
        <div className="rounded-xl px-10 py-10 mx-auto w-full max-w-lg">
            <div className="mx-auto pb-8">
                <ProductLogo className="h-14 mx-auto block" />
            </div>

            <div className="mx-auto text-center pb-8 space-y-2">
                {isDataOps ? (
                    <Heading1>Log in to DataOps.live Develop</Heading1>
                ) : providerFromContext ? (
                    <>
                        <Heading2>Open a cloud development environment</Heading2>
                        <Subheading>for the repository {repoPathname?.slice(1)}</Subheading>
                    </>
                ) : !isGitpodIoUser ? (
                    <Heading1>Log in to Gitpod</Heading1>
                ) : (
                    <>
                        <Heading1>Log in to Gitpod Classic</Heading1>
                        <Subheading>Hosted by us</Subheading>
                    </>
                )}
            </div>

            <div className="w-56 mx-auto flex flex-col space-y-3 items-center">
                {providerFromContext ? (
                    <LoginButton
                        key={"button" + providerFromContext.host}
                        onClick={() => openLogin(providerFromContext!.host)}
                    >
                        {iconForAuthProvider(providerFromContext.type)}
                        <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">
                            Continue with {simplifyProviderName(providerFromContext.host)}
                        </span>
                    </LoginButton>
                ) : (
                    authProviders.data?.map((ap) => (
                        <LoginButton key={"button" + ap.host} onClick={() => openLogin(ap.host)}>
                            {iconForAuthProvider(ap.type)}
                            <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">
                                Continue with {simplifyProviderName(ap.host)}
                            </span>
                        </LoginButton>
                    ))
                )}
                <SSOLoginForm onSuccess={authorizeSuccessful} />
            </div>
            {errorMessage && <ErrorMessage imgSrc={exclamation} message={errorMessage} />}

            {/* Gitpod Classic sunset notice - only show for non-enterprise */}
            {!enterprise && (
                <div className="mt-6 text-center text-sm">
                    <p className="text-pk-content-primary">
                        Gitpod Classic sunsets Oct 15.{" "}
                        <a
                            href="https://app.gitpod.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gp-link hover:text-gray-600"
                        >
                            Start here for free
                        </a>{" "}
                        and get $100 credits.
                    </p>
                </div>
            )}
        </div>
    );
};

const RightProductDescriptionPanel = () => {
    return (
        <div className="w-full lg:max-w-lg 2xl:max-w-[600px] flex flex-col justify-center px-4 lg:px-4 md:min-h-screen my-auto">
            <div className="rounded-lg flex flex-col gap-6 text-white h-full py-4 lg:py-6 max-w-lg mx-auto w-full">
                <div className="relative bg-white/10 backdrop-blur-sm rounded-lg pt-4 px-4 -mt-2">
                    <div className="flex justify-center pt-4 mb-4">
                        <img src={onaWordmark} alt="ONA" className="w-36" draggable="false" />
                    </div>
                    <div className="relative overflow-hidden">
                        <img
                            src={onaApplication}
                            alt="Ona application preview"
                            className="w-full h-auto rounded-lg shadow-lg translate-y-8"
                            draggable="false"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-4 flex-1">
                    <h2 className="text-white text-xl font-bold leading-tight text-start max-w-md mx-auto">
                        Ona - parallel SWE agents in the cloud, sandboxed for high-autonomy. <br />
                        <br />{" "}
                        <a
                            href="https://app.ona.com"
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:no-underline"
                        >
                            Start for free
                        </a>{" "}
                        and get $100 credits. <br />
                        <br />
                        Gitpod Classic sunsets Oct 15 |{" "}
                        <a
                            href="https://ona.com/stories/gitpod-classic-payg-sunset"
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:no-underline"
                        >
                            Learn more
                        </a>
                    </h2>

                    <div className="space-y-3 mt-4">
                        <p className="text-white/70 text-base">
                            Delegate software tasks to Ona. It writes code, runs tests, and opens a pull request. Or
                            jump in to inspect output or pair program in your IDE.
                        </p>
                        <p className="text-white/70 text-base mt-2">
                            Ona runs inside your infrastructure (VPC), with full audit trails, zero data exposure, and
                            support for any LLM.
                        </p>
                    </div>

                    <div className="mt-4">
                        <a
                            href="https://app.ona.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-white/20 backdrop-blur-sm text-white font-medium py-2.5 px-4 rounded-lg hover:bg-white/30 transition-colors border border-white/20 inline-flex items-center justify-center gap-2 text-sm"
                        >
                            Try Ona <span className="font-bold">↗</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TermsOfServiceAndPrivacyPolicy = () => {
    return (
        <div className="flex-none mx-auto text-center px-4 pb-4">
            <span className="text-gray-400 dark:text-gray-500 text-sm">
                By signing in, you agree to our{" "}
                <a className="gp-link hover:text-gray-600" target="gitpod-terms" href="https://www.gitpod.io/terms/">
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
    );
};
