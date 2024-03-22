/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useEffect, useState } from "react";
import { useAuthProviderDescriptions } from "../data/auth-providers/auth-provider-descriptions-query";
import { useFeatureFlag } from "../data/featureflag-query";
import { redirectToAuthorize, redirectToOIDC } from "../provider-utils";
import { useNeedsGitAuthorization } from "./AuthorizeGit";
import { useCurrentUser } from "../user-context";
import { useHistory } from "react-router";

const messageFromSearch = (): string => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("message") ?? "";
};

const Auth = () => {
    const { data: authProviders, isLoading } = useAuthProviderDescriptions();
    const needsScmAuth = useNeedsGitAuthorization();
    const user = useCurrentUser();
    const history = useHistory();

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!user) {
            void redirectToOIDC({
                orgSlug: "",
            });
        } else if (needsScmAuth) {
            if (authProviders && !(authProviders.length === 0)) {
                const provider = authProviders.at(0)!;
                void redirectToAuthorize({
                    host: provider.host,
                    overrideScopes: true,
                });
            }
        } else {
            history.push(`/new/${window.location.search}${window.location.hash}`);
        }
    }, [authProviders, history, isLoading, needsScmAuth, user]);

    return <div></div>;
};

const QuickStart: FC = () => {
    const oidcServiceEnabled = useFeatureFlag("oidcServiceEnabled");
    const authProviders = useAuthProviderDescriptions();
    const [error, setError] = useState("");
    const [message] = useState(messageFromSearch());

    useEffect(() => {
        if (!oidcServiceEnabled) {
            setError("OIDC Service is not enabled");
            return;
        }
    }, [oidcServiceEnabled]);

    if (message.startsWith("error:")) {
        setError(message);
    }

    return (
        <div>
            <h1>Quick Start</h1>
            <pre>{JSON.stringify(authProviders, null, 2)}</pre>
            Error: <pre>{error}</pre>
            {oidcServiceEnabled && <Auth />}
        </div>
    );
};

export default QuickStart;
