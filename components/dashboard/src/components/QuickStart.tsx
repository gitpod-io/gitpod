/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useEffect, useState } from "react";
import { parseError, redirectToAuthorize, redirectToOIDC } from "../provider-utils";
import { useHistory, useLocation } from "react-router";
import { AppLoading } from "../app/AppLoading";
import { Link } from "react-router-dom";
import { authProviderClient, userClient } from "../service/public-api";

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
    const history = useHistory();
    const { hash } = useLocation();

    useEffect(() => {
        if (error) {
            return;
        }

        const fetchData = async () => {
            const user = (await userClient.getAuthenticatedUser({}).catch(() => undefined))?.user;
            const authProviderDescriptions = await authProviderClient
                .listAuthProviderDescriptions({})
                .catch(() => undefined)
                .then((r) => r?.descriptions);

            const hashValue = hash.slice(1);
            let contextUrl: URL;
            try {
                contextUrl = new URL(hashValue);
            } catch {
                setError("Invalid context URL");
                return;
            }
            const relevantAuthProvider = authProviderDescriptions?.find(
                (provider) => provider.host === contextUrl.host,
            );
            if (!user) {
                if (relevantAuthProvider) {
                    void redirectToAuthorize({
                        login: true,
                        host: relevantAuthProvider.host,
                        overrideScopes: true,
                    });

                    return;
                }
                void redirectToOIDC({});

                return;
            }

            if (authProviderDescriptions?.length === 0) {
                setError("No Git integrations setup");
                return;
            }

            const needsScmAuth =
                !authProviderDescriptions?.some((ap) => user.identities.some((i) => ap.id === i.authProviderId)) ??
                false;
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

            return;
        };

        fetchData();
    }, [history, hash, error]);

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
