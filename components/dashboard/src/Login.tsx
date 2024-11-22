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
import GitpodClassicCard from "./images/gitpod-classic-card.png";
import { LoadingState } from "@podkit/loading/LoadingState";
import { isGitpodIo } from "./utils";

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
        <div className="flex flex-col md:flex-row w-full">
            <div
                id="login-section"
                // for some reason, min-h-dvh does not work, so we need tailwind's arbitrary values
                className="w-full min-h-[100dvh] lg:w-2/3 flex flex-col justify-center items-center bg-[#FDF1E7] dark:bg-[#23211e] p-2"
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
                <SSOLoginForm
                    onSuccess={authorizeSuccessful}
                    singleOrgMode={!!authProviders.data && authProviders.data.length === 0}
                />
            </div>
            {errorMessage && <ErrorMessage imgSrc={exclamation} message={errorMessage} />}
        </div>
    );
};

const RightProductDescriptionPanel = () => {
    return (
        <div className="w-full lg:w-1/3 flex flex-col md:justify-center p-4 lg:p-10 lg:pb-2 md:min-h-screen">
            <div>
                <div className="justify-center md:justify-start mb-6 md:mb-8">
                    <h2 className="text-2xl font-medium mb-2 dark:text-white inline-flex items-center gap-x-2">
                        Gitpod Classic
                    </h2>
                    <p className="text-pk-content-secondary mb-2">
                        Automated, standardized development environments hosted by us in Gitpod’s infrastructure. Users
                        who joined before October 1, 2024 on non-Enterprise plans are considered Gitpod Classic users.
                    </p>
                    <div className="border border-pk-border-base rounded-xl p-4 bg-pk-surface-secondary mt-5">
                        <p className="text-gray-800 dark:text-gray-100">
                            <b>Please note:</b> Gitpod Classic will discontinued in April 2025 and replaced by{" "}
                            <a
                                className="gp-link font-semibold"
                                href="https://app.gitpod.io/login"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Gitpod Flex
                            </a>
                            .
                        </p>
                    </div>
                </div>
                <img src={GitpodClassicCard} alt="Gitpod Classic" className="w-full" />
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
