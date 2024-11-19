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
import { storageAvailable } from "../utils";

const parseErrorFromSearch = (search: string): string => {
    const searchParams = new URLSearchParams(search);
    const message = searchParams.get("message");
    if (message?.startsWith("error:")) {
        const parsed = parseError(message);
        return typeof parsed === "string" ? parsed : `${parsed.error}: ${parsed.description}`;
    }

    return "";
};

const generateLocalStorageItemName = async (hash: string) => {
    const id = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hash));
    return `quickstart-${Array.from(new Uint8Array(id))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 10)}` as const;
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

            // The browser will reject cookies larger than 4096 bytes, so we store the hash in local storage if it's too long and restore it later.
            if (hashValue.length > 2048) {
                const isLocalStorageAvailable = storageAvailable("localStorage");
                if (isLocalStorageAvailable) {
                    const localStorageItemName = await generateLocalStorageItemName(hashValue);

                    console.log(`Hash value too long, storing in local storage as ${localStorageItemName}`);
                    localStorage.setItem(localStorageItemName, hashValue);
                    window.location.hash = `#${localStorageItemName}`;
                    return;
                }

                setError("Context URL value is too long.");
                return;
            }

            let contextUrl: URL;
            try {
                const value = hashValue.startsWith("quickstart-") ? localStorage.getItem(hashValue) : hashValue;
                if (!value) {
                    setError("Invalid hash value");
                    return;
                }

                // We have to account for the case where environment variables are provided through the hash, so we search it for the URL.
                const toParse = value.match(/^https?:/) ? value : value.slice(value.indexOf("/") + 1);
                contextUrl = new URL(toParse);
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

            if (hashValue.startsWith("quickstart-")) {
                const storedHash = localStorage.getItem(hashValue);
                if (!storedHash) {
                    setError("Invalid hash value");
                    return;
                }

                localStorage.removeItem(hashValue);
                history.push(`/new/?${searchParams}#${storedHash}`);
                return;
            }

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
