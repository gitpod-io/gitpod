/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useState } from "react";
import Alert from "../components/Alert";
import { Button } from "../components/Button";
import { TextInputField } from "../components/forms/TextInputField";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { openOIDCStartWindow } from "../provider-utils";

type Props = {
    onSuccess: () => void;
};
export const SSOLoginForm: FC<Props> = ({ onSuccess }) => {
    const [orgSlug, setOrgSlug] = useState("");
    const [error, setError] = useState("");
    const [showSSO, setShowSSO] = useState<boolean>(false);

    useEffect(() => {
        try {
            const content = window.localStorage.getItem("gitpod-ui-experiments");
            const object = content && JSON.parse(content);
            if (object["ssoLogin"] === true) {
                setShowSSO(true);
            }
        } catch {
            // ignore as non-critical
        }
    }, []);

    const openLoginWithSSO = useCallback(
        async (e) => {
            e.preventDefault();

            if (!orgSlug.trim()) {
                return;
            }

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
    if (!showSSO) {
        return null;
    }

    return (
        <form onSubmit={openLoginWithSSO}>
            <div className="mt-10 space-y-2">
                <TextInputField
                    label="Organization Slug"
                    placeholder="my-team"
                    value={orgSlug}
                    onChange={setOrgSlug}
                    error={slugError.message}
                    onBlur={slugError.onBlur}
                />
                <Button className="w-full" type="secondary" disabled={!orgSlug.trim() || !slugError.isValid}>
                    Continue with SSO
                </Button>
                {error && <Alert type="info">{error}</Alert>}
            </div>
        </form>
    );
};
