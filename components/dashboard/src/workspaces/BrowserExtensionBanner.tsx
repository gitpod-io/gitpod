/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useMemo, useState } from "react";
import UAParser from "ua-parser-js";
import { useUserLoader } from "../hooks/use-user-loader";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { AuthProviderDescription, AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { useAuthProviderDescriptions } from "../data/auth-providers/auth-provider-descriptions-query";

type BrowserOption = {
    aliases?: string[];
    url: string;
};
type UnifiedAuthProvider = "Bitbucket" | "GitLab" | "GitHub";

const installationOptions: Record<string, BrowserOption> = {
    firefox: {
        url: "https://addons.mozilla.org/en-US/firefox/addon/gitpod/",
    },
    chrome: {
        aliases: ["edge", "brave", "chromium", "vivaldi", "opera"],
        url: "https://chrome.google.com/webstore/detail/gitpod-always-ready-to-co/dodmmooeoklaejobgleioelladacbeki",
    },
};

const isIdentity = (identity?: AuthProviderDescription): identity is AuthProviderDescription => !!identity;
const unifyProviderType = (type: AuthProviderType): UnifiedAuthProvider | undefined => {
    switch (type) {
        case AuthProviderType.BITBUCKET:
        case AuthProviderType.BITBUCKET_SERVER:
            return "Bitbucket";
        case AuthProviderType.GITHUB:
            return "GitHub";
        case AuthProviderType.GITLAB:
            return "GitLab";
        default:
            return undefined;
    }
};

const isAuthProviderType = (type?: UnifiedAuthProvider): type is UnifiedAuthProvider => !!type;
const getDeduplicatedScmProviders = (user: User, descriptions: AuthProviderDescription[]): UnifiedAuthProvider[] => {
    const userIdentities = user.identities.map((identity) => identity.authProviderId);
    const userProviders = userIdentities
        .map((id) => descriptions?.find((provider) => provider.id === id))
        .filter(isIdentity)
        .map((provider) => provider.type);

    return userProviders.map((type) => unifyProviderType(type)).filter(isAuthProviderType);
};

const displayScmProviders = (providers: UnifiedAuthProvider[]): string => {
    const formatter = new Intl.ListFormat("en", { style: "long", type: "disjunction" });

    return formatter.format(providers);
};

export function BrowserExtensionBanner() {
    const { user } = useUserLoader();
    const { data: authProviderDescriptions } = useAuthProviderDescriptions();

    const scmProviderString = useMemo(() => {
        if (!user || !authProviderDescriptions) return;

        const usedProviders = getDeduplicatedScmProviders(user, authProviderDescriptions);
        return displayScmProviders(usedProviders);
    }, [user, authProviderDescriptions]);

    const parser = useMemo(() => new UAParser(), []);
    const browserName = useMemo(() => parser.getBrowser().name?.toLowerCase(), [parser]);

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const installedOrDismissed =
            sessionStorage.getItem("browser-extension-installed") ||
            localStorage.getItem("browser-extension-banner-dismissed");

        setIsVisible(!installedOrDismissed);
    }, []);

    // Todo: Implement the x button
    // const handleClose = () => {
    //     localStorage.setItem("browser-extension-banner-dismissed", "true");
    //     setIsVisible(false);
    // };

    if (!isVisible) {
        return null;
    }

    if (!browserName) {
        return null;
    }

    if (!scmProviderString) {
        return null;
    }

    let browserOption: BrowserOption | undefined = installationOptions[browserName];
    if (!browserOption) {
        browserOption = Object.values(installationOptions).find(
            (opt) => opt.aliases && opt.aliases.includes(browserName),
        );
        if (!browserOption) {
            return null;
        }
    }

    return (
        <section className="flex justify-center w-full mt-20 mx-4">
            <div className="sm:flex justify-between border-2 rounded-xl hidden max-w-xl mt-4">
                <div className="flex flex-col gap-1 py-4 px-2 justify-center">
                    <span className="text-lg font-semibold">Open from {scmProviderString}</span>
                    <span>
                        <a href={browserOption.url} className="gp-link">
                            Install the Gitpod extension
                        </a>{" "}
                        to launch workspaces from Github.
                    </span>
                </div>
                <img alt="A button that says Gitpod" className="rounded-r-xl" src="https://picsum.photos/151/88" />
            </div>
        </section>
    );
}
