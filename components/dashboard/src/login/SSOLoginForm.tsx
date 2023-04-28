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

type Props = {
    singleOrgMode?: boolean;
    onSuccess: () => void;
};
export const SSOLoginForm: FC<Props> = ({ singleOrgMode, onSuccess }) => {
    const [orgSlug, setOrgSlug] = useState("");
    const [error, setError] = useState("");
    const oidcServiceEnabled = !!useFeatureFlag("oidcServiceEnabled").data;

    const openLoginWithSSO = useCallback(
        async (e) => {
            e.preventDefault();

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
                {!singleOrgMode && (
                    <TextInputField
                        label="Organization Slug"
                        placeholder="my-company"
                        value={orgSlug}
                        onChange={setOrgSlug}
                        error={slugError.message}
                        onBlur={slugError.onBlur}
                    />
                )}
                <Button
                    className="w-full"
                    type="secondary"
                    disabled={!singleOrgMode && (!orgSlug.trim() || !slugError.isValid)}
                >
                    Continue {singleOrgMode ? "" : "with SSO"}
                </Button>
                {error && <Alert type="info">{error}</Alert>}
            </div>
        </form>
    );
};
