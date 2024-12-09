/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Alert from "../components/Alert";
import { Button } from "@podkit/buttons/Button";
import { TextInputField } from "../components/forms/TextInputField";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { openOIDCStartWindow } from "../provider-utils";
import { useFeatureFlag } from "../data/featureflag-query";
import { useLocation } from "react-router";
import { useOnboardingState } from "../dedicated-setup/use-needs-setup";
import { getOrgSlugFromQuery } from "../data/organizations/orgs-query";
import { storageAvailable } from "../utils";

type Props = {
    onSuccess: () => void;
};

function getOrgSlugFromPath(path: string) {
    // '/login/acme' => ['', 'login', 'acme']
    const pathSegments = path.split("/");
    if (pathSegments[1] !== "login") {
        return;
    }
    return pathSegments[2];
}

export const SSOLoginForm: FC<Props> = ({ onSuccess }) => {
    const location = useLocation();
    const { data: onboardingState } = useOnboardingState();
    const singleOrgMode = (onboardingState?.organizationCountTotal || 0) < 2;

    const [orgSlug, setOrgSlug] = useState(
        getOrgSlugFromPath(location.pathname) || getOrgSlugFromQuery(location.search) || readSSOOrgSlug() || "",
    );
    const [error, setError] = useState("");

    const oidcServiceEnabled = useFeatureFlag("oidcServiceEnabled");

    const openLoginWithSSO = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            persistSSOOrgSlug(orgSlug.trim());

            try {
                await openOIDCStartWindow({
                    orgSlug,
                    onSuccess: onSuccess,
                    onError: (payload) => {
                        let errorMessage: string;
                        if (typeof payload === "string") {
                            errorMessage = payload;
                        } else {
                            errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                        }
                        setError(errorMessage);
                    },
                });
            } catch (error) {
                console.log(error);
            }
        },
        [onSuccess, orgSlug],
    );

    const slugError = useOnBlurError(
        "Organization slug must not be longer than 63 characters.",
        orgSlug.trim().length <= 63,
    );

    // Don't render anything if not enabled
    if (!oidcServiceEnabled) {
        return null;
    }

    return (
        <form onSubmit={openLoginWithSSO}>
            <div className="mt-10 space-y-2 w-56">
                {!singleOrgMode && (
                    <TextInputField
                        label="Organization"
                        placeholder="my-organization"
                        value={orgSlug}
                        onChange={setOrgSlug}
                        error={slugError.message}
                        onBlur={slugError.onBlur}
                    />
                )}
                <Button
                    type="submit"
                    className="w-full"
                    variant="secondary"
                    disabled={!singleOrgMode && (!orgSlug.trim() || !slugError.isValid)}
                >
                    Continue {singleOrgMode ? "" : "with SSO"}
                </Button>
                {error && <Alert type="info">{error}</Alert>}
            </div>
        </form>
    );
};

function readSSOOrgSlug(): string | undefined {
    const isLocalStorageAvailable = storageAvailable("localStorage");
    if (isLocalStorageAvailable) {
        return window.localStorage.getItem("sso-org-slug") || undefined;
    }
    return undefined;
}

function persistSSOOrgSlug(slug: string) {
    const isLocalStorageAvailable = storageAvailable("localStorage");
    if (isLocalStorageAvailable) {
        window.localStorage.setItem("sso-org-slug", slug.trim());
    }
}
