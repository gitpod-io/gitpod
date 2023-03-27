/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { FC, useCallback, useState } from "react";
import Alert from "../components/Alert";
import { Button } from "../components/Button";
import { TextInputField } from "../components/forms/TextInputField";
import { getGitpodService } from "../service/service";

export const SSOLoginForm: FC = () => {
    const [orgSlug, setOrgSlug] = useState("");
    const [error, setError] = useState("");

    // TODO: remove this
    const [loginUrl, setLoginUrl] = useState("");

    const exchangeSlug = useMutation({
        mutationFn: async ({ slug }: { slug: string }) => {
            // make api call to get provider id by slug
            // return provider id
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // return await getGitpodService().server.getSSOLoginID(slug);
            return { id: "sample-id" };
        },
    });

    const handleSSOLogin = useCallback(
        async (e) => {
            e.preventDefault();

            // make api call to get provider id by slug
            const resp = await exchangeSlug.mutateAsync({ slug: orgSlug });
            const loginId = resp?.id;

            // No SSO configured for provided slug
            if (!loginId) {
                setError("It looks like SSO has not been configured for that organization.");
            }

            // create sso login url with provider id
            const loginUrl = `/oidc/start/?id=${loginId}`;
            setLoginUrl(loginUrl);

            // openAuthorize window for sso w/ login url
        },
        [exchangeSlug, orgSlug],
    );

    // TODO: Wrap with feature flag check
    return (
        <form onSubmit={handleSSOLogin}>
            <div className="mt-10 space-y-2">
                <TextInputField label="Organization Slug" value={orgSlug} onChange={setOrgSlug} />
                <Button className="w-full" type="secondary" disabled={!orgSlug} loading={exchangeSlug.isLoading}>
                    Continue with SSO
                </Button>
                {loginUrl && <p>{loginUrl}</p>}
                {error && <Alert type="info">{error}</Alert>}
            </div>
        </form>
    );
};
