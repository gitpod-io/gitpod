/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { InputWithCopy } from "../components/InputWithCopy";
import { InputField } from "../components/forms/InputField";
import { TextInputField } from "../components/forms/TextInputField";
import { gitpodHostUrl } from "../service/service";
import { useOnBlurError } from "../hooks/use-onblur-error";
import isURL from "validator/lib/isURL";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useUpsertOIDCClientMutation } from "../data/oidc-clients/upsert-oidc-client-mutation";

type Props = {
    config: SSOConfig;
    onChange: (config: Partial<SSOConfig>) => void;
};

export const SSOConfigForm: FC<Props> = ({ config, onChange }) => {
    const redirectUrl = gitpodHostUrl.with({ pathname: `/iam/oidc/callback` }).toString();

    const issuerError = useOnBlurError(`Please enter a valid URL.`, isValidIssuer(config.issuer));
    const clientIdError = useOnBlurError("Client ID is missing.", isValidClientID(config.clientId));
    const clientSecretError = useOnBlurError("Client Secret is missing.", isValidClientSecret(config.clientSecret));

    return (
        <>
            <TextInputField
                label="Issuer URL"
                value={config.issuer}
                placeholder={"https://accounts.google.com"}
                error={issuerError.message}
                onBlur={issuerError.onBlur}
                onChange={(val) => onChange({ issuer: val })}
            />

            <InputField label="Redirect URL">
                <InputWithCopy value={redirectUrl} tip="Copy the Redirect URL to clipboard" />
            </InputField>

            <TextInputField
                label="Client ID"
                value={config.clientId}
                error={clientIdError.message}
                onBlur={clientIdError.onBlur}
                onChange={(val) => onChange({ clientId: val })}
            />

            <TextInputField
                label="Client Secret"
                type="password"
                value={config.clientSecret}
                error={clientSecretError.message}
                onBlur={clientSecretError.onBlur}
                onChange={(val) => onChange({ clientSecret: val })}
            />
        </>
    );
};

export type SSOConfig = {
    id?: string;
    issuer: string;
    clientId: string;
    clientSecret: string;
};

export const ssoConfigReducer = (state: SSOConfig, action: Partial<SSOConfig>) => {
    return { ...state, ...action };
};

export const isValid = (state: SSOConfig) => {
    return isValidIssuer(state.issuer) && isValidClientID(state.clientId) && isValidClientSecret(state.clientSecret);
};

const isValidIssuer = (issuer: SSOConfig["issuer"]) => {
    return issuer.trim().length > 0 && isURL(issuer);
};

const isValidClientID = (clientID: SSOConfig["clientId"]) => {
    return clientID.trim().length > 0;
};

const isValidClientSecret = (clientSecret: SSOConfig["clientSecret"]) => {
    return clientSecret.trim().length > 0;
};

export const useSaveSSOConfig = () => {
    const { data: org } = useCurrentOrg();
    const upsertClientConfig = useUpsertOIDCClientMutation();

    const save = useCallback(
        async (ssoConfig: SSOConfig) => {
            if (!org) {
                throw new Error("No current org selected");
            }

            if (!isValid(ssoConfig)) {
                throw new Error("Invalid SSO config");
            }

            const trimmedIssuer = ssoConfig.issuer.trim();
            const trimmedClientId = ssoConfig.clientId.trim();
            const trimmedClientSecret = ssoConfig.clientSecret.trim();

            // TODO: remove this - hacking around that update doesn't work on the api atm
            if (ssoConfig.id) {
                return ssoConfig;
            }

            return upsertClientConfig.mutateAsync({
                config: !ssoConfig.id
                    ? {
                          organizationId: org.id,
                          oauth2Config: {
                              clientId: trimmedClientId,
                              clientSecret: trimmedClientSecret,
                          },
                          oidcConfig: {
                              issuer: trimmedIssuer,
                          },
                      }
                    : {
                          id: ssoConfig.id,
                          organizationId: org.id,
                          oauth2Config: {
                              clientId: trimmedClientSecret,
                              // TODO: determine how we should handle when user doesn't change their secret
                              clientSecret: ssoConfig.clientSecret === "redacted" ? "" : trimmedClientSecret,
                          },
                          oidcConfig: {
                              issuer: trimmedIssuer,
                          },
                      },
            });
        },
        [org, upsertClientConfig],
    );

    return {
        save,
        isLoading: upsertClientConfig.isLoading,
        isError: upsertClientConfig.isError,
        error: upsertClientConfig.error,
    };
};
