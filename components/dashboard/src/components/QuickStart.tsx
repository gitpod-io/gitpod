/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useEffect, useState } from "react";
import { useAuthProviderDescriptions } from "../data/auth-providers/auth-provider-descriptions-query";
import { parseError, redirectToAuthorize, redirectToOIDC } from "../provider-utils";
import { useNeedsGitAuthorization } from "./AuthorizeGit";
import { useCurrentUser } from "../user-context";
import { useHistory } from "react-router";
import { AppLoading } from "../app/AppLoading";
import { Link } from "react-router-dom";

const errorFromSearch = (): string => {
    const searchParams = new URLSearchParams(window.location.search);
    const message = searchParams.get("message");
    if (message?.startsWith("error:")) {
        const parsed = parseError(message);
        return typeof parsed === "string" ? parsed : `${parsed.error}: ${parsed.description}`;
    }

    return "";
};

const QuickStart: FC = () => {
    const [error, setError] = useState(errorFromSearch());
    const { data: authProviders, isLoading: authProvidersLoading } = useAuthProviderDescriptions();
    const needsScmAuth = useNeedsGitAuthorization();
    const user = useCurrentUser();
    const history = useHistory();

    useEffect(() => {
        if (authProvidersLoading || !authProviders) {
            return;
        }

        if (!user) {
            void redirectToOIDC({
                orgSlug: "",
            });
        } else if (needsScmAuth) {
            const contextUrl = new URL(window.location.hash.slice(1));
            const relevantAuthProvider = authProviders.find((provider) => provider.host === contextUrl.host);

            if (!relevantAuthProvider) {
                setError("No relevant auth provider found");
                return;
            }

            void redirectToAuthorize({
                host: relevantAuthProvider.host,
                overrideScopes: true,
            });
        } else {
            history.push(`/new/${window.location.search}${window.location.hash}`);
        }
    }, [authProviders, history, authProvidersLoading, needsScmAuth, user]);

    if (error) {
        return (
            <>
                Login failed: {error}.{" "}
                <Link className="gp-link" to={`/new/${window.location.search}${window.location.hash}`}>
                    Try again.
                </Link>
            </>
        );
    }

    return <AppLoading />;
};

export default QuickStart;
