/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Alert from "../components/Alert";
import { Button } from "../components/Button";
import { TextInputField } from "../components/forms/TextInputField";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { openOIDCStartWindow } from "../provider-utils";
import { useFeatureFlag } from "../data/featureflag-query";
import { useLocation } from "react-router";
import { useCheckDedicatedSetup } from "../dedicated-setup/use-check-dedicated-setup";
import { Heading2, Subheading } from "../components/typography/headings";

type Props = {
    singleOrgMode?: boolean;
    onSuccess: () => void;
};

function getOrgSlugFromPath(path: string) {
    return path.split("/")[2];
}

export const SSOLoginForm: FC<Props> = ({ singleOrgMode, onSuccess }) => {
    const location = useLocation();
    const [orgSlug, setOrgSlug] = useState(
        getOrgSlugFromPath(location.pathname) || window.localStorage.getItem("sso-org-slug") || "",
    );
    const [error, setError] = useState("");
    const oidcServiceEnabled = useFeatureFlag("oidcServiceEnabled");
    // This flag lets us know if the current installation still needs setup
    const { showOnboarding: setupPending } = useCheckDedicatedSetup();

    const openLoginWithSSO = useCallback(
        async (e) => {
            e.preventDefault();
            window.localStorage.setItem("sso-org-slug", orgSlug.trim());

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
            <div className="mt-10 space-y-2">
                {singleOrgMode ? (
                    setupPending ? (
                        <>
                            <Heading2>Setup is pending</Heading2>
                            <Subheading>
                                This instance of Gitpod is not quite ready. An administrator has a few additional steps
                                to complete.
                            </Subheading>
                        </>
                    ) : (
                        <Button className="w-full" type="secondary" disabled={!orgSlug.trim() || !slugError.isValid}>
                            Continue
                        </Button>
                    )
                ) : (
                    <>
                        <TextInputField
                            label="Organization Slug"
                            placeholder="my-company"
                            value={orgSlug}
                            onChange={setOrgSlug}
                            error={slugError.message}
                            onBlur={slugError.onBlur}
                        />
                        <Button className="w-full" type="secondary">
                            Continue
                        </Button>
                    </>
                )}
                {error && <Alert type="info">{error}</Alert>}
            </div>
        </form>
    );
};
