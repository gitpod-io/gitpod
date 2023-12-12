/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import type { RepositoryUnauthorizedError } from "@gitpod/public-api/lib/gitpod/v1/error_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { openAuthorizeWindow } from "../../../provider-utils";
import { useToast } from "../../../components/toasts/Toasts";
import { Button } from "@podkit/buttons/Button";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";

type Props = {
    error: Error;
    onReconnect: () => void;
};
export const EnablePrebuildsError: FC<Props> = ({ error, onReconnect }) => {
    // Handle RepositoryUnauthorizedError
    // We need to authorize with the provider to acquire the correct scopes to install webhooks
    if (error instanceof ApplicationError && error.code === ErrorCodes.NOT_AUTHENTICATED) {
        return (
            <RepositoryUnauthroizedErrorMessage
                error={error.data as RepositoryUnauthorizedError}
                onReconnect={onReconnect}
            />
        );
    }

    // Otherwise we just show a generic error message as we can't solve it via reconnecting w/ provider
    return <GenericErrorMessage message={error.message} />;
};

// Error cases
// 1. Un-specific error (we can't initiate a reconnect flow, it may not help either)

// Failed to install webhooks while enabling prebuilds
// 2. User hasn't connected w/ the git provider
// 3. User has connected w/ the git provider but we don't have the correct scopes
// 4. User has connected w/ git provider, we have the correct scopes, but we failed to install the webhooks
//   - This could be because the user doesn't have admin/write permissions on the repo or org
//   - This could be because our token is invalid / was revoked
//   - We can provide a link to the gitpod oauth app settings for them to have an admin approve it

type GenericErrorMessageProps = {
    message: string;
};
const GenericErrorMessage: FC<GenericErrorMessageProps> = ({ message }) => {
    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3>Failed to enable Prebuilds</Heading3>
            <Subheading>{message}</Subheading>
        </ConfigurationSettingsField>
    );
};

type RepositoryUnauthroizedErrorMessageProps = {
    error: RepositoryUnauthorizedError;
    onReconnect: () => void;
};
const RepositoryUnauthroizedErrorMessage: FC<RepositoryUnauthroizedErrorMessageProps> = ({ error, onReconnect }) => {
    const { toast } = useToast();

    const authorizeWithProvider = useCallback(async () => {
        await openAuthorizeWindow({
            host: error.host,
            scopes: error.requiredScopes,
            onSuccess: async () => {
                onReconnect();
            },
            onError: (payload) => {
                let errorMessage: string;
                if (typeof payload === "string") {
                    errorMessage = payload;
                } else {
                    errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                }

                // TODO: don't use toast, update error message inline
                toast(errorMessage || `Oh no, there was a problem with ${error.host}.`);
            },
        });
    }, [error.host, error.requiredScopes, onReconnect, toast]);

    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3>Failed to enable Prebuilds</Heading3>
            <Subheading>
                Looks like we need to authorize with <strong>{error.host}</strong> to enabled prebuilds.
            </Subheading>

            <Button className="mt-4" onClick={authorizeWithProvider}>
                {error.providerIsConnected ? "Reconnect" : "Connect"}
            </Button>
        </ConfigurationSettingsField>
    );
};
