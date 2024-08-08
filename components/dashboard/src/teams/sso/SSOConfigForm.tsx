/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { InputWithCopy } from "../../components/InputWithCopy";
import { InputField } from "../../components/forms/InputField";
import { TextInputField } from "../../components/forms/TextInputField";
import { gitpodHostUrl } from "../../service/service";
import { useOnBlurError } from "../../hooks/use-onblur-error";
import isURL from "validator/lib/isURL";
import { useCurrentOrg } from "../../data/organizations/orgs-query";
import { useUpsertOIDCClientMutation } from "../../data/oidc-clients/upsert-oidc-client-mutation";
import { Subheading } from "../../components/typography/headings";
import { CheckboxInputField } from "../../components/forms/CheckboxInputField";

type Props = {
    config: SSOConfig;
    readOnly?: boolean;
    onChange: (config: Partial<SSOConfig>) => void;
};

export const SSOConfigForm: FC<Props> = ({ config, readOnly = false, onChange }) => {
    const redirectUrl = gitpodHostUrl.with({ pathname: `/iam/oidc/callback` }).toString();

    const issuerError = useOnBlurError(`Please enter a valid URL.`, isValidIssuer(config.issuer));
    const clientIdError = useOnBlurError("Client ID is missing.", isValidClientID(config.clientId));
    const clientSecretError = useOnBlurError("Client Secret is missing.", isValidClientSecret(config.clientSecret));

    return (
        <>
            <Subheading>
                <strong>1.</strong> Add the following <strong>redirect URI</strong> to your identity provider's
                configuration.
            </Subheading>

            <InputField>
                <InputWithCopy value={redirectUrl} tip="Copy the redirect URI to clipboard" />
            </InputField>

            <Subheading className="mt-8">
                <strong>2.</strong> Find the information below from your identity provider.
            </Subheading>

            <TextInputField
                label="Issuer URL"
                value={config.issuer}
                placeholder={"e.g. https://accounts.google.com"}
                error={issuerError.message}
                disabled={readOnly}
                onBlur={issuerError.onBlur}
                onChange={(val) => onChange({ issuer: val })}
            />

            <TextInputField
                label="Client ID"
                value={config.clientId}
                error={clientIdError.message}
                disabled={readOnly}
                onBlur={clientIdError.onBlur}
                onChange={(val) => onChange({ clientId: val })}
            />

            <TextInputField
                label="Client Secret"
                type="password"
                value={config.clientSecret}
                error={clientSecretError.message}
                disabled={readOnly}
                onBlur={clientSecretError.onBlur}
                onChange={(val) => onChange({ clientSecret: val })}
            />

            <CheckboxInputField
                label="Use PKCE"
                checked={config.usePKCE}
                disabled={readOnly}
                onChange={(val) => onChange({ usePKCE: val })}
            />

            <Subheading className="mt-8">
                <strong>3.</strong> Restrict available accounts in your Identity Providers.
                <a
                    href="https://www.gitpod.io/docs/enterprise/setup-gitpod/configure-sso#restrict-available-accounts-in-your-identity-providers"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="gp-link"
                >
                    Learn more
                </a>
                .
            </Subheading>

            <InputField label="CEL Expression (optional)">
                <textarea
                    style={{ height: "160px" }}
                    className="w-full resize-none"
                    value={config.celExpression}
                    onChange={(val) => onChange({ celExpression: val.target.value })}
                />
            </InputField>
        </>
    );
};

export type SSOConfig = {
    id?: string;
    issuer: string;
    clientId: string;
    clientSecret: string;
    celExpression?: string;
    usePKCE: boolean;
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
            if (upsertClientConfig.isLoading) {
                throw new Error("Already saving");
            }
            if (!org) {
                throw new Error("No current org selected");
            }

            if (!isValid(ssoConfig)) {
                throw new Error("Invalid SSO config");
            }

            const trimmedIssuer = ssoConfig.issuer.trim();
            const trimmedClientId = ssoConfig.clientId.trim();
            const trimmedClientSecret = ssoConfig.clientSecret.trim();
            const trimmedCelExpression = ssoConfig.celExpression?.trim();

            return upsertClientConfig.mutateAsync({
                config: !ssoConfig.id
                    ? {
                          organizationId: org.id,
                          oauth2Config: {
                              clientId: trimmedClientId,
                              clientSecret: trimmedClientSecret,
                              celExpression: trimmedCelExpression,
                              usePkce: ssoConfig.usePKCE,
                          },
                          oidcConfig: {
                              issuer: trimmedIssuer,
                          },
                      }
                    : {
                          id: ssoConfig.id,
                          organizationId: org.id,
                          oauth2Config: {
                              clientId: trimmedClientId,
                              // TODO: determine how we should handle when user doesn't change their secret
                              clientSecret: trimmedClientSecret.toLowerCase() === "redacted" ? "" : trimmedClientSecret,
                              celExpression: trimmedCelExpression,
                              usePkce: ssoConfig.usePKCE,
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
