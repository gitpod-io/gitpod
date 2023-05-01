/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useContext, useReducer, useState } from "react";
import { Button } from "../components/Button";
import { Heading1, Subheading } from "../components/typography/headings";
import { SetupLayout } from "./SetupLayout";
import check from "../images/check.svg";
import Tooltip from "../components/Tooltip";
import { SSOConfigForm, isValid, ssoConfigReducer, useSaveSSOConfig } from "./SSOConfigForm";
import Alert from "../components/Alert";
import { useToast } from "../components/toasts/Toasts";
import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { openOIDCStartWindow } from "../provider-utils";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { LinkButton } from "../components/LinkButton";

type Props = {
    config?: OIDCClientConfig;
    onComplete: () => void;
};
export const SSOSetupStep: FC<Props> = ({ config, onComplete }) => {
    const org = useCurrentOrg();
    const { setUser } = useContext(UserContext);
    const [ssoLoginError, setSSOLoginError] = useState("");
    const { toast } = useToast();

    const [ssoConfig, dispatch] = useReducer(ssoConfigReducer, {
        id: config?.id ?? "",
        issuer: config?.oidcConfig?.issuer ?? "",
        clientId: config?.oauth2Config?.clientId ?? "",
        clientSecret: config?.oauth2Config?.clientSecret ?? "",
    });
    const configIsValid = isValid(ssoConfig);

    const { save, isLoading, isError, error } = useSaveSSOConfig();

    const updateUser = useCallback(async () => {
        await getGitpodService().reconnect();
        const [user] = await Promise.all([getGitpodService().server.getLoggedInUser()]);
        setUser(user);
        // markLoggedIn();
    }, [setUser]);

    const handleVerify = useCallback(async () => {
        try {
            const newConfig = await save(ssoConfig);
            console.log("newConfig", newConfig);
            toast("Your SSO configuration was saved");

            // TODO: launch login flow to verify the config
            await openOIDCStartWindow({
                // @ts-ignore
                configId: newConfig.id,
                onSuccess: async () => {
                    await updateUser();
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
    }, [onComplete, save, ssoConfig, toast, updateUser]);

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
                    {/* TODO: Find what link we want to use here */}
                    Enable single sign-on for your organization using the OpenID Connect (OIDC) standard.{" "}
                    <a href="https://gitpod.io" target="_blank" rel="noreferrer noopener">
                        Learn more
                    </a>
                </Subheading>
            </div>
            {isError && <Alert type="danger">{error?.message}</Alert>}

            <SSOConfigForm config={ssoConfig} onChange={dispatch} />

            <div className="mt-6">
                <Button size="block" onClick={handleVerify} disabled={!configIsValid} loading={isLoading}>
                    Verify SSO Configuration
                </Button>
            </div>

            <div className="mt-6">
                <LinkButton onClick={onComplete}>surprise...</LinkButton>
            </div>
        </SetupLayout>
    );
};
