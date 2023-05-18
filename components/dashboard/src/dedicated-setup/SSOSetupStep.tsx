/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useReducer, useState } from "react";
import { Button } from "../components/Button";
import { Heading1, Subheading } from "../components/typography/headings";
import { SetupLayout } from "./SetupLayout";
import check from "../images/check.svg";
import Tooltip from "../components/Tooltip";
import { SSOConfigForm, isValid, ssoConfigReducer, useSaveSSOConfig } from "../teams/sso/SSOConfigForm";
import Alert from "../components/Alert";
import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { openOIDCStartWindow } from "../provider-utils";

type Props = {
    config?: OIDCClientConfig;
    onComplete: () => void;
};
export const SSOSetupStep: FC<Props> = ({ config, onComplete }) => {
    const [ssoLoginError, setSSOLoginError] = useState("");

    const [ssoConfig, dispatch] = useReducer(ssoConfigReducer, {
        id: config?.id ?? "",
        issuer: config?.oidcConfig?.issuer ?? "",
        clientId: config?.oauth2Config?.clientId ?? "",
        clientSecret: config?.oauth2Config?.clientSecret ?? "",
    });
    const configIsValid = isValid(ssoConfig);

    const { save, isLoading, isError, error } = useSaveSSOConfig();

    const handleVerify = useCallback(
        async (e) => {
            e.preventDefault();

            if (isLoading) {
                return;
            }

            try {
                let configId = ssoConfig.id;

                const response = await save(ssoConfig);

                // Create returns the new config, update does not
                if ("config" in response && response.config) {
                    configId = response.config.id;

                    // Update our local state with the new config ID in case we created a new one
                    // This ensures we update the correct config if we save again vs. create a new one
                    dispatch({
                        id: configId,
                    });
                }

                await openOIDCStartWindow({
                    activate: true,
                    configId: configId,
                    onSuccess: async () => {
                        onComplete();
                    },
                    onError: (payload) => {
                        let errorMessage: string;
                        if (typeof payload === "string") {
                            errorMessage = payload;
                        } else {
                            errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                        }
                        setSSOLoginError(errorMessage);
                    },
                });
            } catch (e) {
                console.error(e);
            }
        },
        [isLoading, onComplete, save, ssoConfig],
    );

    return (
        <SetupLayout showOrg>
            <div className="flex flex-row space-x-2 mb-4">
                <Tooltip content="Naming your Organization">
                    <div className="w-5 h-5 bg-green-600 rounded-full flex justify-center items-center text-color-white">
                        <img src={check} width={15} height={15} alt="checkmark" />
                    </div>
                </Tooltip>
                <div className="w-5 h-5 bg-gray-400 rounded-full" />
            </div>

            <div className="mb-10">
                <Heading1>Configure single sign-on</Heading1>
                <Subheading>
                    Enable single sign-on for your organization using the OpenID Connect (OIDC) standard.{" "}
                    <a
                        href="https://gitpod.io/docs/dedicated/sso-setup-8f7696e0"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="gp-link"
                    >
                        Learn more
                    </a>
                </Subheading>
            </div>
            {isError && <Alert type="danger">{error?.message}</Alert>}

            {ssoLoginError && <Alert type="danger">{ssoLoginError}</Alert>}

            <form onSubmit={handleVerify}>
                <SSOConfigForm config={ssoConfig} onChange={dispatch} />

                <div className="mt-6">
                    <Button size="block" disabled={!configIsValid} loading={isLoading}>
                        Verify SSO Configuration
                    </Button>
                </div>
            </form>
        </SetupLayout>
    );
};
