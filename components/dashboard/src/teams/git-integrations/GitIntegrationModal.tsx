/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button } from "@podkit/buttons/Button";
import { InputField } from "../../components/forms/InputField";
import { SelectInputField } from "../../components/forms/SelectInputField";
import { TextInputField } from "../../components/forms/TextInputField";
import { InputWithCopy } from "../../components/InputWithCopy";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { Subheading } from "../../components/typography/headings";
import { useInvalidateOrgAuthProvidersQuery } from "../../data/auth-providers/org-auth-providers-query";
import { useCurrentOrg } from "../../data/organizations/orgs-query";
import { useOnBlurError } from "../../hooks/use-onblur-error";
import { openAuthorizeWindow, toAuthProviderLabel } from "../../provider-utils";
import { gitpodHostUrl } from "../../service/service";
import { UserContext } from "../../user-context";
import { useToast } from "../../components/toasts/Toasts";
import { AuthProvider, AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { useCreateOrgAuthProviderMutation } from "../../data/auth-providers/create-org-auth-provider-mutation";
import { useUpdateOrgAuthProviderMutation } from "../../data/auth-providers/update-org-auth-provider-mutation";
import { authProviderClient, userClient } from "../../service/public-api";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import {
    isSupportAzureDevOpsIntegration,
    useAuthProviderOptionsQuery,
} from "../../data/auth-providers/auth-provider-options-query";

type Props = {
    provider?: AuthProvider;
    onClose: () => void;
};
export const GitIntegrationModal: FunctionComponent<Props> = (props) => {
    const { setUser } = useContext(UserContext);
    const { toast } = useToast();
    const team = useCurrentOrg().data;
    const [type, setType] = useState<AuthProviderType>(props.provider?.type ?? AuthProviderType.GITLAB);
    const [host, setHost] = useState<string>(props.provider?.host ?? "");
    const [clientId, setClientId] = useState<string>(props.provider?.oauth2Config?.clientId ?? "");
    const [clientSecret, setClientSecret] = useState<string>(props.provider?.oauth2Config?.clientSecret ?? "");
    const [authorizationUrl, setAuthorizationUrl] = useState(props.provider?.oauth2Config?.authorizationUrl ?? "");
    const [tokenUrl, setTokenUrl] = useState(props.provider?.oauth2Config?.tokenUrl ?? "");
    const availableProviderOptions = useAuthProviderOptionsQuery(true);
    const supportAzureDevOps = isSupportAzureDevOpsIntegration();

    const [savedProvider, setSavedProvider] = useState(props.provider);
    const isNew = !savedProvider;

    // This is a readonly value to copy and plug into external oauth config
    const redirectURL = callbackUrl();

    // "bitbucket.org" is set as host value whenever "Bitbucket" is selected
    useEffect(() => {
        if (isNew) {
            setHost(type === AuthProviderType.BITBUCKET ? "bitbucket.org" : "");
        }
    }, [isNew, type]);

    const [savingProvider, setSavingProvider] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    const createProvider = useCreateOrgAuthProviderMutation();
    const updateProvider = useUpdateOrgAuthProviderMutation();
    const invalidateOrgAuthProviders = useInvalidateOrgAuthProvidersQuery(team?.id ?? "");

    const {
        message: hostError,
        onBlur: hostOnBlurErrorTracking,
        isValid: hostValid,
    } = useOnBlurError(`Provider Host Name is missing.`, host.trim().length > 0);

    const {
        message: clientIdError,
        onBlur: clientIdOnBlur,
        isValid: clientIdValid,
    } = useOnBlurError(
        `${type === AuthProviderType.GITLAB ? "Application ID" : "Client ID"} is missing.`,
        clientId.trim().length > 0,
    );

    const {
        message: clientSecretError,
        onBlur: clientSecretOnBlur,
        isValid: clientSecretValid,
    } = useOnBlurError(
        `${type === AuthProviderType.GITLAB ? "Secret" : "Client Secret"} is missing.`,
        clientSecret.trim().length > 0,
    );

    const {
        message: authorizationUrlError,
        onBlur: authorizationUrlOnBlur,
        isValid: authorizationUrlValid,
    } = useOnBlurError(
        `Authorization URL is missing.`,
        type !== AuthProviderType.AZURE_DEVOPS || authorizationUrl.trim().length > 0,
    );

    const {
        message: tokenUrlError,
        onBlur: tokenUrlOnBlur,
        isValid: tokenUrlValid,
    } = useOnBlurError(`Token URL is missing.`, type !== AuthProviderType.AZURE_DEVOPS || tokenUrl.trim().length > 0);

    // Call our error onBlur handler, and remove prefixed "https://"
    const hostOnBlur = useCallback(() => {
        hostOnBlurErrorTracking();

        setHost(cleanHost(host));
    }, [host, hostOnBlurErrorTracking]);

    const reloadSavedProvider = useCallback(async () => {
        if (!savedProvider || !team) {
            return;
        }

        const { authProvider } = await authProviderClient.getAuthProvider({ authProviderId: savedProvider.id });
        if (authProvider) {
            setSavedProvider(authProvider);
        }
    }, [savedProvider, team]);

    const activate = useCallback(async () => {
        if (!team) {
            console.error("no current team selected");
            return;
        }

        // Set a saving state and clear any error message
        setSavingProvider(true);
        setErrorMessage(undefined);

        const trimmedId = clientId.trim();
        const trimmedSecret = clientSecret.trim();
        const trimmedAuthorizationUrl = authorizationUrl.trim();
        const trimmedTokenUrl = tokenUrl.trim();

        try {
            let newProvider: AuthProvider;
            if (isNew) {
                newProvider = await createProvider.mutateAsync({
                    provider: {
                        host: cleanHost(host),
                        type,
                        orgId: team.id,
                        clientId: trimmedId,
                        clientSecret: trimmedSecret,
                        authorizationUrl: trimmedAuthorizationUrl,
                        tokenUrl: trimmedTokenUrl,
                    },
                });
            } else {
                newProvider = await updateProvider.mutateAsync({
                    provider: {
                        id: savedProvider.id,
                        clientId: trimmedId,
                        clientSecret: clientSecret === "redacted" ? "" : trimmedSecret,
                        authorizationUrl: trimmedAuthorizationUrl,
                        tokenUrl: trimmedTokenUrl,
                    },
                });
            }

            // switch mode to stay and edit this integration.
            setSavedProvider(newProvider);

            // the server is checking periodically for updates of dynamic providers, thus we need to
            // wait at least 2 seconds for the changes to be propagated before we try to use this provider.
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // just open the authorization window and do *not* await
            openAuthorizeWindow({
                login: false,
                host: newProvider.host,
                onSuccess: (payload) => {
                    invalidateOrgAuthProviders();

                    // Refresh the current user - they may have a new identity record now
                    // setup a promise and don't wait so we can close the modal right away
                    userClient.getAuthenticatedUser({}).then(({ user }) => {
                        if (user) {
                            setUser(user);
                        }
                    });
                    toast(`${toAuthProviderLabel(newProvider.type)} integration has been activated.`);

                    props.onClose();
                },
                onError: (payload) => {
                    reloadSavedProvider();

                    let errorMessage: string;
                    if (typeof payload === "string") {
                        errorMessage = payload;
                    } else {
                        errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                    }
                    setErrorMessage(errorMessage);
                },
            });
        } catch (error) {
            console.log(error);
            setErrorMessage("message" in error ? error.message : "Failed to update Git provider");
        }

        setSavingProvider(false);
    }, [
        clientId,
        clientSecret,
        authorizationUrl,
        tokenUrl,
        host,
        invalidateOrgAuthProviders,
        isNew,
        props,
        savedProvider?.id,
        setUser,
        team,
        toast,
        type,
        createProvider,
        updateProvider,
        reloadSavedProvider,
    ]);

    const isValid = useMemo(
        () => clientIdValid && clientSecretValid && hostValid && authorizationUrlValid && tokenUrlValid,
        [clientIdValid, clientSecretValid, hostValid, authorizationUrlValid, tokenUrlValid],
    );

    const getNumber = (paramValue: string | null) => {
        if (!paramValue) {
            return 0;
        }

        try {
            const number = Number.parseInt(paramValue, 10);
            if (Number.isNaN(number)) {
                return 0;
            }

            return number;
        } catch (e) {
            return 0;
        }
    };

    return (
        <Modal visible onClose={props.onClose} onSubmit={activate} autoFocus={isNew}>
            <ModalHeader>{isNew ? "New Git Provider" : "Git Provider"}</ModalHeader>
            <ModalBody>
                {isNew && (
                    <Subheading>
                        Configure a Git Integration with a self-managed instance of GitLab, GitHub{" "}
                        {supportAzureDevOps ? ", Bitbucket Server or Azure DevOps" : "or Bitbucket"}.
                    </Subheading>
                )}

                <div>
                    <SelectInputField
                        disabled={!isNew}
                        label="Provider Type"
                        value={type.toString()}
                        topMargin={false}
                        onChange={(val) => setType(getNumber(val))}
                    >
                        {availableProviderOptions.map((option) => (
                            <option key={option.type} value={option.type}>
                                {option.label}
                            </option>
                        ))}
                    </SelectInputField>
                    <TextInputField
                        label="Provider Host Name"
                        value={host}
                        disabled={!isNew || type === AuthProviderType.BITBUCKET}
                        placeholder={getPlaceholderForIntegrationType(type)}
                        error={hostError}
                        onChange={setHost}
                        onBlur={hostOnBlur}
                    />

                    <InputField label="Redirect URI" hint={<RedirectUrlDescription type={type} />}>
                        <InputWithCopy value={redirectURL} tip="Copy the redirect URI to clipboard" />
                    </InputField>

                    {type === AuthProviderType.AZURE_DEVOPS && (
                        <>
                            <TextInputField
                                label="Authorization URL"
                                value={authorizationUrl}
                                error={authorizationUrlError}
                                onBlur={authorizationUrlOnBlur}
                                onChange={setAuthorizationUrl}
                            />
                            <TextInputField
                                label="Token URL"
                                value={tokenUrl}
                                error={tokenUrlError}
                                onBlur={tokenUrlOnBlur}
                                onChange={setTokenUrl}
                            />
                        </>
                    )}

                    <TextInputField
                        label={type === AuthProviderType.GITLAB ? "Application ID" : "Client ID"}
                        value={clientId}
                        error={clientIdError}
                        onBlur={clientIdOnBlur}
                        onChange={setClientId}
                    />

                    <TextInputField
                        label={type === AuthProviderType.GITLAB ? "Secret" : "Client Secret"}
                        type="password"
                        value={clientSecret}
                        error={clientSecretError}
                        onChange={setClientSecret}
                        onBlur={clientSecretOnBlur}
                    />
                </div>
            </ModalBody>
            <ModalFooter
                alert={
                    <>
                        {errorMessage ? (
                            <ModalFooterAlert type="danger">{errorMessage}</ModalFooterAlert>
                        ) : (
                            !isNew &&
                            !savedProvider?.verified && (
                                <ModalFooterAlert type="warning" closable={false}>
                                    You need to activate this configuration.
                                </ModalFooterAlert>
                            )
                        )}
                    </>
                }
            >
                <Button variant="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" disabled={!isValid} loading={savingProvider}>
                    Activate
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};

const callbackUrl = () => {
    const pathname = `/auth/callback`;
    return gitpodHostUrl.with({ pathname }).toString();
};

const getPlaceholderForIntegrationType = (type: AuthProviderType) => {
    switch (type) {
        case AuthProviderType.GITHUB:
            return "github.example.com";
        case AuthProviderType.GITLAB:
            return "gitlab.example.com";
        case AuthProviderType.BITBUCKET:
            return "bitbucket.org";
        case AuthProviderType.BITBUCKET_SERVER:
            return "bitbucket.example.com";
        case AuthProviderType.AZURE_DEVOPS:
            return "dev.azure.com";
        default:
            return "";
    }
};

type RedirectUrlDescriptionProps = {
    type: AuthProviderType;
};
const RedirectUrlDescription: FunctionComponent<RedirectUrlDescriptionProps> = ({ type }) => {
    let docsUrl = ``;
    switch (type) {
        case AuthProviderType.GITHUB:
            docsUrl = `https://www.gitpod.io/docs/configure/authentication/github-enterprise`;
            break;
        case AuthProviderType.GITLAB:
            docsUrl = `https://www.gitpod.io/docs/configure/authentication/gitlab#registering-a-self-hosted-gitlab-installation`;
            break;
        case AuthProviderType.BITBUCKET:
            docsUrl = `https://www.gitpod.io/docs/configure/authentication`;
            break;
        case AuthProviderType.BITBUCKET_SERVER:
            docsUrl = "https://www.gitpod.io/docs/configure/authentication/bitbucket-server";
            break;
        case AuthProviderType.AZURE_DEVOPS:
            docsUrl = "https://www.gitpod.io/docs/configure/authentication/azure-devops";
            break;
        default:
            return null;
    }

    return (
        <span>
            Use this redirect URI to register a {toAuthProviderLabel(type)} instance as an authorized Git provider in
            Gitpod.{" "}
            <a href={docsUrl} target="_blank" rel="noreferrer noopener" className="gp-link">
                Learn more
            </a>
        </span>
    );
};

function cleanHost(host: string) {
    let cleanedHost = host;

    // Removing https protocol
    if (host.startsWith("https://")) {
        cleanedHost = host.replace("https://", "");
    }

    // Trim any trailing slashes
    cleanedHost = cleanedHost.replace(/\/$/, "");

    return cleanedHost;
}
