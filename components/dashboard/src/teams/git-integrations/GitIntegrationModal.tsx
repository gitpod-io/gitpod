/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { InputField } from "../../components/forms/InputField";
import { SelectInputField } from "../../components/forms/SelectInputField";
import { TextInputField } from "../../components/forms/TextInputField";
import { InputWithCopy } from "../../components/InputWithCopy";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { Subheading } from "../../components/typography/headings";
import { useInvalidateOrgAuthProvidersQuery } from "../../data/auth-providers/org-auth-providers-query";
import { useUpsertOrgAuthProviderMutation } from "../../data/auth-providers/upsert-org-auth-provider-mutation";
import { useCurrentOrg } from "../../data/organizations/orgs-query";
import { useOnBlurError } from "../../hooks/use-onblur-error";
import { openAuthorizeWindow } from "../../provider-utils";
import { getGitpodService, gitpodHostUrl } from "../../service/service";

type Props = {
    provider?: AuthProviderEntry;
    onClose: () => void;
};

export const GitIntegrationModal: FunctionComponent<Props> = (props) => {
    const team = useCurrentOrg().data;
    const [type, setType] = useState<string>(props.provider?.type ?? "GitLab");
    const [host, setHost] = useState<string>(props.provider?.host ?? "");
    const [clientId, setClientId] = useState<string>(props.provider?.oauth.clientId ?? "");
    const [clientSecret, setClientSecret] = useState<string>(props.provider?.oauth.clientSecret ?? "");

    const [savedProvider, setSavedProvider] = useState(props.provider);
    const isNew = !savedProvider;

    // This is a readonly value to copy and plug into external oauth config
    const redirectURL = useMemo(() => {
        let url = "";

        // Once it's saved, use what's stored
        if (!isNew) {
            url = savedProvider?.oauth.callBackUrl ?? url;
        } else {
            // Otherwise construct it w/ their provided host value or example
            url = callbackUrl(host || "gitlab.example.com");
        }

        return url;
    }, [host, isNew, savedProvider?.oauth.callBackUrl]);

    const [savingProvider, setSavingProvider] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    const upsertProvider = useUpsertOrgAuthProviderMutation();
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
    } = useOnBlurError(`${type === "GitLab" ? "Application ID" : "Client ID"} is missing.`, clientId.trim().length > 0);

    const {
        message: clientSecretError,
        onBlur: clientSecretOnBlur,
        isValid: clientSecretValid,
    } = useOnBlurError(`${type === "GitLab" ? "Secret" : "Client Secret"} is missing.`, clientSecret.trim().length > 0);

    // Call our error onBlur handler, and remove prefixed "https://"
    const hostOnBlur = useCallback(() => {
        hostOnBlurErrorTracking();

        setHost(cleanHost(host));
    }, [host, hostOnBlurErrorTracking]);

    // TODO: We could remove this extra state management if we convert the modal into a detail flow w/ it's own route
    // Used to grab latest provider record after activation flow
    const reloadSavedProvider = useCallback(async () => {
        if (!savedProvider || !team) {
            return;
        }

        const provider = (await getGitpodService().server.getOrgAuthProviders({ organizationId: team.id })).find(
            (ap) => ap.id === savedProvider.id,
        );
        if (provider) {
            setSavedProvider(provider);
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

        try {
            const newProvider = await upsertProvider.mutateAsync({
                provider: isNew
                    ? {
                          host: cleanHost(host),
                          type,
                          clientId: trimmedId,
                          clientSecret: trimmedSecret,
                          organizationId: team.id,
                      }
                    : {
                          id: savedProvider.id,
                          clientId: trimmedId,
                          clientSecret: clientSecret === "redacted" ? "" : trimmedSecret,
                          organizationId: team.id,
                      },
            });

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
        host,
        invalidateOrgAuthProviders,
        isNew,
        props,
        reloadSavedProvider,
        savedProvider?.id,
        team,
        type,
        upsertProvider,
    ]);

    const isValid = useMemo(
        () => clientIdValid && clientSecretValid && hostValid,
        [clientIdValid, clientSecretValid, hostValid],
    );

    return (
        <Modal
            visible
            onClose={props.onClose}
            onEnter={() => {
                activate();
                return false;
            }}
        >
            <ModalHeader>{isNew ? "New Git Auth" : "Git Auth"}</ModalHeader>
            <ModalBody>
                {isNew && (
                    <Subheading>
                        Configure Git Auth with a self-managed instance of GitLab, GitHub or Bitbucket Server.
                    </Subheading>
                )}

                <div>
                    <SelectInputField disabled={!isNew} label="Provider Type" value={type} onChange={setType}>
                        <option value="GitHub">GitHub</option>
                        <option value="GitLab">GitLab</option>
                        <option value="BitbucketServer">Bitbucket Server</option>
                    </SelectInputField>
                    <TextInputField
                        label="Provider Host Name"
                        value={host}
                        disabled={!isNew}
                        placeholder={getPlaceholderForIntegrationType(type)}
                        error={hostError}
                        onChange={setHost}
                        onBlur={hostOnBlur}
                    />

                    <InputField label="Redirect URL" hint={<RedirectUrlDescription type={type} host={host} />}>
                        <InputWithCopy value={redirectURL} tip="Copy the Redirect URL to clipboard" />
                    </InputField>

                    <TextInputField
                        label={type === "GitLab" ? "Application ID" : "Client ID"}
                        value={clientId}
                        error={clientIdError}
                        onBlur={clientIdOnBlur}
                        onChange={setClientId}
                    />

                    <TextInputField
                        label={type === "GitLab" ? "Secret" : "Client Secret"}
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
                            savedProvider?.status !== "verified" && (
                                <ModalFooterAlert type="warning" closable={false}>
                                    You need to activate this configuration.
                                </ModalFooterAlert>
                            )
                        )}
                    </>
                }
            >
                <Button type="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <Button onClick={activate} disabled={!isValid || savingProvider} loading={savingProvider}>
                    Activate
                </Button>
            </ModalFooter>
        </Modal>
    );
};

const callbackUrl = (host: string) => {
    // Negative Lookahead (?!\/)
    // `\/` matches the character `/`
    // "https://foobar:80".replace(/:(?!\/)/, "_")
    // => 'https://foobar_80'
    host = host.replace(/:(?!\/)/, "_");
    const pathname = `/auth/${host}/callback`;
    return gitpodHostUrl.with({ pathname }).toString();
};

const getPlaceholderForIntegrationType = (type: string) => {
    switch (type) {
        case "GitHub":
            return "github.example.com";
        case "GitLab":
            return "gitlab.example.com";
        case "BitbucketServer":
            return "bitbucket.example.com";
        default:
            return "";
    }
};

type RedirectUrlDescriptionProps = {
    type: string;
    host: string;
};
const RedirectUrlDescription: FunctionComponent<RedirectUrlDescriptionProps> = ({ type, host }) => {
    let settingsUrl = ``;
    switch (type) {
        case "GitHub":
            settingsUrl = `${host}/settings/developers`;
            break;
        case "GitLab":
            settingsUrl = `${host}/-/profile/applications`;
            break;
        default:
            return null;
    }

    let docsUrl = ``;
    switch (type) {
        case "GitHub":
            docsUrl = `https://www.gitpod.io/docs/github-integration/#oauth-application`;
            break;
        case "GitLab":
            docsUrl = `https://www.gitpod.io/docs/gitlab-integration/#oauth-application`;
            break;
        default:
            return null;
    }

    return (
        <span>
            Use this redirect URL to update the OAuth application. Go to{" "}
            <a href={`https://${settingsUrl}`} target="_blank" rel="noreferrer noopener" className="gp-link">
                developer settings
            </a>{" "}
            and setup the OAuth application.&nbsp;
            <a href={docsUrl} target="_blank" rel="noreferrer noopener" className="gp-link">
                Learn more
            </a>
            .
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
