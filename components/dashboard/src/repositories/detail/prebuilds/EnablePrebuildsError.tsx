/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import type { RepositoryUnauthorizedError } from "@gitpod/public-api/lib/gitpod/v1/error_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { openAuthorizeWindow } from "../../../provider-utils";
import { useToast } from "../../../components/toasts/Toasts";
import { Button } from "@podkit/buttons/Button";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { AlertTriangleIcon } from "lucide-react";

type Props = {
    error: Error;
    onReconnect: () => void;
};
export const EnablePrebuildsError: FC<Props> = ({ error, onReconnect }) => {
    // Handle RepositoryUnauthorizedError
    // We need to authorize with the provider to acquire the correct scopes to install webhooks
    if (error instanceof ApplicationError && error.code === ErrorCodes.NOT_AUTHENTICATED) {
        return (
            <RepositoryUnauthorizedErrorMessage
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
        <ConfigurationSettingsField className="text-pk-content-danger">
            <div className="flex flex-row gap-2 mb-4">
                <span className="w-6">
                    <AlertTriangleIcon />
                </span>
                <span>
                    Unable to enable prebuilds. Please try again later. If the problem persists, please contact support.
                </span>
            </div>
            {message && <pre className="text-sm text-pk-content-secondary">{`> ${message}`}</pre>}
        </ConfigurationSettingsField>
    );
};

type RepositoryUnauthorizedErrorMessageProps = {
    error: RepositoryUnauthorizedError;
    onReconnect: () => void;
};
const RepositoryUnauthorizedErrorMessage: FC<RepositoryUnauthorizedErrorMessageProps> = ({ error, onReconnect }) => {
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

    const definitelyNeedsReconnect = !error.providerIsConnected || error.isMissingScopes;

    return (
        <ConfigurationSettingsField className="text-pk-content-danger">
            <div className="flex flex-row gap-2">
                <span className="w-6">
                    <AlertTriangleIcon />
                </span>
                {definitelyNeedsReconnect ? (
                    <span>
                        It looks like your need to reconnect with your git provider (<strong>{error.host}</strong>).
                        Please reconnect and try again.
                    </span>
                ) : (
                    <span>
                        Unable to enable prebuilds. This could be because you don’t have admin/write permissions for
                        this repo or it could be an invalid token. Please try to reconnect. If the problem persists, you
                        can contact support.
                    </span>
                )}
            </div>

            <Button className="mt-4" onClick={authorizeWithProvider}>
                {error.providerIsConnected ? "Reconnect" : "Connect"}
            </Button>
        </ConfigurationSettingsField>
    );
};
