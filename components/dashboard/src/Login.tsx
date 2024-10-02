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
import { AuthProviderDescription } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { Button, ButtonProps } from "@podkit/buttons/Button";
import { cn } from "@podkit/lib/cn";
import { userClient } from "./service/public-api";
import { ProductLogo } from "./components/ProductLogo";
import { useIsDataOps } from "./data/featureflag-query";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { IconGitpodEngraved } from "./icons/GitpodEngraved";
import { IconEarlyAccess } from "./icons/IconEarlyAccess";
import { useTheme } from "./theme-context";
import { LoadingState } from "@podkit/loading/LoadingState";

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

    const enterprise = !!authProviders.data && authProviders.data.length === 0;

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
            className={cn("z-50 flex flex-col-reverse lg:flex-row w-full min-h-screen", {
                "bg-[#FDF1E7] dark:bg-[#23211e]": !enterprise,
            })}
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
        <>
            <LeftPanel />
            <div
                id="login-section"
                // for some reason, min-h-dvh does not work, so we need tailwind's arbitrary values
                className="w-full min-h-[100dvh] lg:w-4/5 flex flex-col justify-center items-center bg-[#FDF1E7] dark:bg-[#23211e] p-2"
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
                            <p className="text-sm text-[#64645F] mt-6 mb-6 lg:mb-0 lg:mt-8 max-w-sm text-center font-semibold">
                                Gitpod Classic will be sunset by April 1, 2025 and superseded by Gitpod Flex
                            </p>
                        </div>
                    }
                    <TermsOfServiceAndPrivacyPolicy />
                </div>
            </div>
        </>
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

    const authProviders = useAuthProviderDescriptions();
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

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
        <div className="rounded-xl px-10 py-10 mx-auto w-full max-w-md">
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
                ) : (
                    <Heading1>Log in to Gitpod</Heading1>
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
                <SSOLoginForm
                    onSuccess={authorizeSuccessful}
                    singleOrgMode={!!authProviders.data && authProviders.data.length === 0}
                />
            </div>
            {errorMessage && <ErrorMessage imgSrc={exclamation} message={errorMessage} />}
        </div>
    );
};

const LeftPanel = () => {
    const { isDark } = useTheme();

    return (
        <div className="w-full lg:w-1/3 lg:max-w-lg flex flex-col justify-between p-4 lg:p-10 lg:pb-2 min-h-screen">
            <div>
                <div className="p-[1px] bg-gradient-to-b from-white to-[#ECE7E5] dark:from-gray-700 dark:to-gray-600 rounded-2xl justify-center items-center mb-8">
                    <div className="bg-[#F9F9F9B2] dark:bg-gray-800 w-full p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <h2 className="bg-white dark:bg-gray-700 inline-flex text-xs font-semibold mb-4 border-[0.5px] shadow border-divider dark:border-gray-600 px-2 py-1 rounded-lg">
                            <span className="bg-gradient-to-l from-[#FFAE33] to-[#FF8A00] text-transparent bg-clip-text">
                                Did you know?
                            </span>
                        </h2>
                        <p className="text-pk-content-secondary dark:text-gray-300 mt-1">
                            We launched a new version of Gitpod in early access.
                        </p>
                    </div>
                </div>
                <div className="justify-center md:justify-start mb-6 md:mb-8">
                    <ProductLogo className="h-8 mb-4" />
                    <h2 className="text-2xl font-medium mb-2 dark:text-white inline-flex items-center gap-x-2">
                        Gitpod Flex
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                        Automated, standardized
                        <br /> development environments.
                    </p>
                </div>

                <ul className="space-y-4">
                    {[
                        {
                            title: "Self-host in under 3 minutes",
                            description:
                                "All your source code, data, and intellectual property stays in your private network.",
                        },
                        {
                            title: "Local environments to replace Docker Desktop",
                            description:
                                "Built-in Linux virtualization to run Dev Container without Docker Desktop on macOS",
                        },
                        {
                            title: "Automate common development workflows",
                            description:
                                "Seed databases, provision infra, runbooks as one-click actions, configure code assistants, etc. ",
                        },
                        {
                            title: "Dev Container support",
                            description:
                                "Eliminate the need to manually install tools, dependencies and editor extensions.",
                        },
                    ].map((feature, index) => (
                        <li key={index} className="flex items-start">
                            <GreenCheckIcon />
                            <div>
                                <span className="text-sm font-medium text-pk-content-primary">{feature.title}</span>
                                <p className="text-sm text-pk-content-secondary mt-0.5">{feature.description}</p>
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="flex w-full justify-center items-center mt-8 mb-2">
                    <LinkButton
                        variant="secondary"
                        className="text-pk-content-primary bg-pk-surface-primary dark:bg-gray-700 dark:text-white w-full shadow font-medium"
                        href="https://app.gitpod.io/login"
                        isExternalUrl={true}
                    >
                        Explore
                    </LinkButton>
                </div>
            </div>
            <div className="justify-center items-center max-w-fit mx-auto flex flex-col pt-4">
                <IconGitpodEngraved variant={isDark ? "dark" : "light"} className="shadow-engraving block h-6 w-6" />
                <span className="py-1" />
                <IconEarlyAccess className="dark:fill-pk-surface-01/30" variant={isDark ? "dark" : "light"} />
            </div>
        </div>
    );
};

const GreenCheckIcon = () => {
    return (
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mr-3 mt-1">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M11 20.5C16.2467 20.5 20.5 16.2467 20.5 11C20.5 5.75329 16.2467 1.5 11 1.5C5.75329 1.5 1.5 5.75329 1.5 11C1.5 16.2467 5.75329 20.5 11 20.5Z"
                    fill="#17C165"
                    stroke="#D5F6DB"
                    strokeWidth="3"
                />
                <path d="M7 11.5L10 14L15 8" stroke="white" strokeWidth="2" strokeLinejoin="round" />
            </svg>
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
