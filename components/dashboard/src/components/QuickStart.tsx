/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useEffect, useState } from "react";
import { useAuthProviderDescriptions } from "../data/auth-providers/auth-provider-descriptions-query";
import { parseError, redirectToAuthorize, redirectToOIDC } from "../provider-utils";
import { useCurrentUser } from "../user-context";
import { useHistory } from "react-router";
import { AppLoading } from "../app/AppLoading";
import { Link } from "react-router-dom";

const parseErrorFromSearch = (search: string): string => {
    const searchParams = new URLSearchParams(search);
    const message = searchParams.get("message");
    if (message?.startsWith("error:")) {
        const parsed = parseError(message);
        return typeof parsed === "string" ? parsed : `${parsed.error}: ${parsed.description}`;
    }

    return "";
};

const QuickStart: FC = () => {
    const [error, setError] = useState(parseErrorFromSearch(window.location.search));
    const { data: authProviders, isLoading: authProvidersLoading } = useAuthProviderDescriptions();
    const user = useCurrentUser();
    const history = useHistory();

    useEffect(() => {
        if (authProvidersLoading || error) {
            return;
        }

        const hash = window.location.hash.slice(1);
        let contextUrl: URL;
        try {
            contextUrl = new URL(hash);
        } catch {
            setError("Invalid context URL");
            return;
        }
        const relevantAuthProvider = authProviders?.find((provider) => provider.host === contextUrl.host);

        if (!user) {
            if (relevantAuthProvider) {
                void redirectToAuthorize({
                    host: relevantAuthProvider.host,
                    overrideScopes: true,
                });

                return;
            }
            void redirectToOIDC({
                orgSlug: "",
            });

            return;
        }

        const needsScmAuth =
            !authProviders?.some((ap) => user.identities.some((i) => ap.id === i.authProviderId)) ?? false;
        if (needsScmAuth) {
            void redirectToAuthorize({
                host: contextUrl.host,
                overrideScopes: true,
            });

            return;
        }

        const searchParams = new URLSearchParams(window.location.search);
        searchParams.delete("message");

        history.push(`/new/?${searchParams}${window.location.hash}`);
    }, [authProviders, history, authProvidersLoading, user, error]);

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
