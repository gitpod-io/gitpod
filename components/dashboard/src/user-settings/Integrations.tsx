/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    AzureDevOpsOAuthScopes,
    getRequiredScopes,
    getScopeNameForScope,
    getScopesForAuthProviderType,
} from "@gitpod/public-api-common/lib/auth-providers";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Alert from "../components/Alert";
import { CheckboxInputField, CheckboxListField } from "../components/forms/CheckboxInputField";
import ConfirmationModal from "../components/ConfirmationModal";
import { ContextMenuEntry } from "../components/ContextMenu";
import InfoBox from "../components/InfoBox";
import { ItemsList } from "../components/ItemsList";
import { SpinnerLoader } from "../components/Loader";
import Modal, { ModalBody, ModalHeader, ModalFooter } from "../components/Modal";
import { Heading2, Subheading } from "../components/typography/headings";
import exclamation from "../images/exclamation.svg";
import { openAuthorizeWindow, toAuthProviderLabel } from "../provider-utils";
import { gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import { AuthEntryItem } from "./AuthEntryItem";
import { IntegrationEntryItem } from "./IntegrationItemEntry";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { SelectAccountModal } from "./SelectAccountModal";
import { useAuthProviderDescriptions } from "../data/auth-providers/auth-provider-descriptions-query";
import { useFeatureFlag } from "../data/featureflag-query";
import { EmptyMessage } from "../components/EmptyMessage";
import { Delayed } from "@podkit/loading/Delayed";
import {
    AuthProvider,
    AuthProviderDescription,
    AuthProviderType,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { authProviderClient, scmClient, userClient } from "../service/public-api";
import { useCreateUserAuthProviderMutation } from "../data/auth-providers/create-user-auth-provider-mutation";
import { useUpdateUserAuthProviderMutation } from "../data/auth-providers/update-user-auth-provider-mutation";
import { useDeleteUserAuthProviderMutation } from "../data/auth-providers/delete-user-auth-provider-mutation";
import { Button } from "@podkit/buttons/Button";
import { isOrganizationOwned } from "@gitpod/public-api-common/lib/user-utils";
import { InputWithCopy } from "../components/InputWithCopy";
import { useAuthProviderOptionsQuery } from "../data/auth-providers/auth-provider-options-query";

export default function Integrations() {
    return (
        <div>
            <PageWithSettingsSubMenu>
                <GitProviders />
                <div className="h-12"></div>
                <GitIntegrations />
            </PageWithSettingsSubMenu>
        </div>
    );
}

const getDescriptionForScope = (scope: string) => {
    switch (scope) {
        // GitHub
        case "user:email":
            return "Read-only access to your email addresses";
        case "read:user":
            return "Read-only access to your profile information";
        case "public_repo":
            return "Write access to code in public repositories and organizations";
        case "repo":
            return "Read/write access to code in private repositories and organizations";
        case "read:org":
            return "Read-only access to organizations (used to suggest organizations when forking a repository)";
        case "workflow":
            return "Allow updating GitHub Actions workflow files";
        // GitLab
        case "read_user":
            return "Read-only access to your email addresses";
        case "api":
            return "Allow making API calls (used to set up a webhook when enabling prebuilds for a repository)";
        case "read_repository":
            return "Read/write access to your repositories";
        // Bitbucket
        case "account":
            return "Read-only access to your account information";
        case "repository":
            return "Read-only access to your repositories (note: Bitbucket doesn't support revoking scopes)";
        case "repository:write":
            return "Read/write access to your repositories (note: Bitbucket doesn't support revoking scopes)";
        case "pullrequest":
            return "Read access to pull requests and ability to collaborate via comments, tasks, and approvals (note: Bitbucket doesn't support revoking scopes)";
        case "pullrequest:write":
            return "Allow creating, merging and declining pull requests (note: Bitbucket doesn't support revoking scopes)";
        case "webhook":
            return "Allow installing webhooks (used when enabling prebuilds for a repository, note: Bitbucket doesn't support revoking scopes)";
        // Azure DevOps
        case AzureDevOpsOAuthScopes.WRITE_REPO:
            return "Code read and write permissions";
        case AzureDevOpsOAuthScopes.READ_USER:
            return "Read user profile";
        default:
            return "";
    }
};

function GitProviders() {
    const { user, setUser } = useContext(UserContext);

    const authProviders = useAuthProviderDescriptions();
    const [allScopes, setAllScopes] = useState<Map<string, string[]>>(new Map());
    const [disconnectModal, setDisconnectModal] = useState<{ provider: AuthProviderDescription } | undefined>(
        undefined,
    );
    const [editModal, setEditModal] = useState<
        { provider: AuthProviderDescription; prevScopes: Set<string>; nextScopes: Set<string> } | undefined
    >(undefined);
    const [selectAccountModal, setSelectAccountModal] = useState<SelectAccountPayload | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    const updateCurrentScopes = useCallback(async () => {
        if (user) {
            const scopesByProvider = new Map<string, string[]>();
            const connectedProviders = user.identities.map((i) =>
                authProviders.data?.find((ap) => ap.id === i.authProviderId),
            );
            for (let provider of connectedProviders) {
                if (!provider) {
                    continue;
                }
                const token = (await scmClient.searchSCMTokens({ host: provider.host })).tokens[0];
                scopesByProvider.set(provider.id, token?.scopes?.slice() || []);
            }
            setAllScopes(scopesByProvider);
        }
    }, [authProviders.data, user]);

    useEffect(() => {
        updateCurrentScopes();
    }, [updateCurrentScopes]);

    const isConnected = (authProviderId: string) => {
        return !!user?.identities?.find((i) => i.authProviderId === authProviderId);
    };

    const getSettingsUrl = (ap: AuthProviderDescription) => {
        const url = new URL(`https://${ap.host}`);
        switch (ap.type) {
            case AuthProviderType.GITHUB:
                url.pathname = "settings/applications";
                break;
            case AuthProviderType.GITLAB:
                url.pathname = "-/profile/applications";
                break;
            default:
                return undefined;
        }
        return url;
    };

    const gitProviderMenu = (provider: AuthProviderDescription) => {
        const result: ContextMenuEntry[] = [];
        const connected = isConnected(provider.id);
        if (connected) {
            const settingsUrl = getSettingsUrl(provider);
            result.push({
                title: "Edit Permissions",
                onClick: () => startEditPermissions(provider),
                separator: !settingsUrl,
            });
            if (settingsUrl) {
                result.push({
                    title: `Manage on ${provider.host}`,
                    onClick: () => {
                        window.open(settingsUrl, "_blank", "noopener,noreferrer");
                    },
                    separator: true,
                });
            }
            const canDisconnect =
                (user && isOrganizationOwned(user)) ||
                authProviders.data?.some((p) => p.id !== provider.id && isConnected(p.id));
            if (canDisconnect) {
                result.push({
                    title: "Disconnect",
                    customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                    onClick: () => setDisconnectModal({ provider }),
                });
            }
        } else {
            result.push({
                title: "Connect",
                customFontStyle: "text-green-600",
                onClick: () => connect(provider),
            });
        }
        return result;
    };

    const getUsername = (authProviderId: string) => {
        return user?.identities?.find((i) => i.authProviderId === authProviderId)?.authName;
    };

    const getPermissions = (authProviderId: string) => {
        return allScopes.get(authProviderId);
    };

    const connect = async (ap: AuthProviderDescription) => {
        await doAuthorize(ap.host);
    };

    const disconnect = async (ap: AuthProviderDescription) => {
        setDisconnectModal(undefined);
        const returnTo = gitpodHostUrl.with({ pathname: "complete-auth", search: "message=success" }).toString();
        const deauthorizeUrl = gitpodHostUrl
            .withApi({
                pathname: "/deauthorize",
                search: `returnTo=${returnTo}&host=${ap.host}`,
            })
            .toString();

        fetch(deauthorizeUrl)
            .then((res) => {
                if (!res.ok) {
                    throw Error("Fetch failed");
                }
                return res;
            })
            .then((response) => updateUser())
            .catch((error) =>
                setErrorMessage(
                    "You cannot disconnect this integration because it is required for authentication and logging in with this account.",
                ),
            );
    };

    const startEditPermissions = async (provider: AuthProviderDescription) => {
        // todo: add spinner

        const token = (await scmClient.searchSCMTokens({ host: provider.host })).tokens[0];
        if (token) {
            setEditModal({ provider, prevScopes: new Set(token.scopes), nextScopes: new Set(token.scopes) });
        }
    };

    const updateUser = async () => {
        const { user } = await userClient.getAuthenticatedUser({});
        if (user) {
            setUser(user);
        }
    };

    const doAuthorize = async (host: string, scopes?: string[]) => {
        try {
            await openAuthorizeWindow({
                host,
                scopes,
                overrideScopes: true,
                onSuccess: () => updateUser(),
                onError: (error) => {
                    if (typeof error === "string") {
                        try {
                            const payload = JSON.parse(error);
                            if (SelectAccountPayload.is(payload)) {
                                setSelectAccountModal(payload);
                            }
                        } catch (error) {
                            console.log(error);
                        }
                    }
                },
            });
        } catch (error) {
            console.log(error);
        }
    };

    const updatePermissions = async () => {
        if (!editModal) {
            return;
        }
        try {
            await doAuthorize(editModal.provider.host, Array.from(editModal.nextScopes));
        } catch (error) {
            console.log(error);
        }
        setEditModal(undefined);
    };
    const onChangeScopeHandler = (checked: boolean, scope: string) => {
        if (!editModal) {
            return;
        }

        const nextScopes = new Set(editModal.nextScopes);
        if (checked) {
            nextScopes.add(scope);
        } else {
            nextScopes.delete(scope);
        }
        setEditModal({ ...editModal, nextScopes });
    };

    return (
        <div>
            {selectAccountModal && (
                <SelectAccountModal {...selectAccountModal} close={() => setSelectAccountModal(undefined)} />
            )}

            {disconnectModal && (
                <ConfirmationModal
                    title="Disconnect Provider"
                    areYouSureText="Are you sure you want to disconnect the following provider?"
                    children={{
                        name: toAuthProviderLabel(disconnectModal.provider.type),
                        description: disconnectModal.provider.host,
                    }}
                    buttonText="Disconnect Provider"
                    onClose={() => setDisconnectModal(undefined)}
                    onConfirm={() => disconnect(disconnectModal.provider)}
                />
            )}

            {errorMessage && (
                <div className="flex rounded-md bg-red-600 p-3 mb-4">
                    <img
                        className="w-4 h-4 mx-2 my-auto filter-brightness-10"
                        src={exclamation}
                        alt="exclamation mark icon"
                    />
                    <span className="text-white">{errorMessage}</span>
                </div>
            )}

            {editModal && (
                <Modal visible={true} onClose={() => setEditModal(undefined)}>
                    <ModalHeader>Edit Permissions</ModalHeader>
                    <ModalBody>
                        <CheckboxListField label="Configure provider permissions.">
                            {(getScopesForAuthProviderType(editModal.provider.type) || []).map((scope) => {
                                const isRequired = getRequiredScopes(editModal.provider.type)?.default.includes(scope);

                                return (
                                    <CheckboxInputField
                                        key={scope}
                                        value={scope}
                                        label={getScopeNameForScope(scope) + (isRequired ? " (required)" : "")}
                                        hint={getDescriptionForScope(scope)}
                                        checked={editModal.nextScopes.has(scope)}
                                        disabled={isRequired}
                                        topMargin={false}
                                        onChange={(checked) => onChangeScopeHandler(checked, scope)}
                                    />
                                );
                            })}
                        </CheckboxListField>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            onClick={() => updatePermissions()}
                            disabled={equals(editModal.nextScopes, editModal.prevScopes)}
                        >
                            Update Permissions
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            <Heading2>Git Providers</Heading2>
            <Subheading>
                Manage your permissions to the available Git provider integrations.{" "}
                <a
                    className="gp-link"
                    href="https://www.gitpod.io/docs/configure/authentication"
                    target="_blank"
                    rel="noreferrer"
                >
                    Learn more
                </a>
            </Subheading>
            <ItemsList className="pt-6">
                {authProviders.data &&
                    (authProviders.data.length === 0 ? (
                        <EmptyMessage subtitle="No Git providers have been configured yet." />
                    ) : (
                        authProviders.data.map((ap) => (
                            <AuthEntryItem
                                key={ap.id}
                                isConnected={isConnected}
                                gitProviderMenu={gitProviderMenu}
                                getUsername={getUsername}
                                getPermissions={getPermissions}
                                ap={ap}
                            />
                        ))
                    ))}
            </ItemsList>
        </div>
    );
}

function GitIntegrations() {
    const { user } = useContext(UserContext);
    const userGitAuthProviders = useFeatureFlag("userGitAuthProviders");

    const deleteUserAuthProvider = useDeleteUserAuthProviderMutation();

    const [modal, setModal] = useState<
        | { mode: "new" }
        | { mode: "edit"; provider: AuthProvider }
        | { mode: "delete"; provider: AuthProvider }
        | undefined
    >(undefined);

    const {
        data: providers,
        isLoading,
        refetch,
    } = useQuery(
        ["own-auth-providers", { userId: user?.id ?? "" }],
        async () => {
            const { authProviders } = await authProviderClient.listAuthProviders({
                id: { case: "userId", value: user?.id || "" },
            });
            return authProviders;
        },
        { enabled: !!user },
    );

    const deleteProvider = async (provider: AuthProvider) => {
        try {
            await deleteUserAuthProvider.mutateAsync({
                providerId: provider.id,
            });
        } catch (error) {
            console.log(error);
        }
        setModal(undefined);
        refetch();
    };

    const gitProviderMenu = (provider: AuthProvider) => {
        const result: ContextMenuEntry[] = [];
        result.push({
            title: provider.verified ? "Edit Configuration" : "Activate Integration",
            onClick: () => setModal({ mode: "edit", provider }),
            separator: true,
        });
        result.push({
            title: "Remove",
            customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
            onClick: () => setModal({ mode: "delete", provider }),
        });
        return result;
    };

    if (isLoading) {
        return (
            <Delayed>
                <SpinnerLoader />
            </Delayed>
        );
    }

    // If user has no personal providers and ff is not enabled, don't show anything
    // Otherwise we show their existing providers w/o ability to create new ones if ff is disabled
    if ((providers || []).length === 0 && !userGitAuthProviders) {
        return null;
    }

    return (
        <div>
            {modal?.mode === "new" && (
                <GitIntegrationModal
                    mode={modal.mode}
                    userId={user?.id || "no-user"}
                    onClose={() => setModal(undefined)}
                    onUpdate={refetch}
                />
            )}
            {modal?.mode === "edit" && (
                <GitIntegrationModal
                    mode={modal.mode}
                    userId={user?.id || "no-user"}
                    provider={modal.provider}
                    onClose={() => setModal(undefined)}
                    onUpdate={refetch}
                />
            )}
            {modal?.mode === "delete" && (
                <ConfirmationModal
                    title="Remove Integration"
                    areYouSureText="Are you sure you want to remove the following Git integration?"
                    children={{
                        name: toAuthProviderLabel(modal.provider.type),
                        description: modal.provider.host,
                    }}
                    buttonText="Remove Integration"
                    onClose={() => setModal(undefined)}
                    onConfirm={async () => await deleteProvider(modal.provider)}
                />
            )}

            <div className="flex items-start sm:justify-between mb-2">
                <div>
                    <Heading2>Git Integrations</Heading2>
                    <Subheading>
                        Manage Git integrations for self-managed instances of GitLab, GitHub, or Bitbucket.
                    </Subheading>
                </div>
                {/* Hide create button if ff is disabled */}
                {userGitAuthProviders && (providers || []).length !== 0 ? (
                    <div className="flex mt-0">
                        <Button onClick={() => setModal({ mode: "new" })} className="ml-2">
                            New Integration
                        </Button>
                    </div>
                ) : null}
            </div>

            {providers && providers.length === 0 && (
                <div className="w-full flex h-80 mt-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                    <div className="m-auto text-center">
                        <Heading2 color="light" className="self-center mb-4">
                            No Git Integrations
                        </Heading2>
                        <Subheading className="text-gray-500 mb-6">
                            In addition to the default Git Providers you can authorize
                            <br /> with a self-hosted instance of a provider.
                        </Subheading>
                        <Button onClick={() => setModal({ mode: "new" })}>New Integration</Button>
                    </div>
                </div>
            )}
            <ItemsList className="pt-6">
                {providers && providers.map((ap) => <IntegrationEntryItem ap={ap} gitProviderMenu={gitProviderMenu} />)}
            </ItemsList>
        </div>
    );
}

export function GitIntegrationModal(
    props: (
        | {
              mode: "new";
          }
        | {
              mode: "edit";
              provider: AuthProvider;
          }
    ) & {
        login?: boolean;
        headerText?: string;
        userId: string;
        onClose?: () => void;
        closeable?: boolean;
        onUpdate?: () => void;
        onAuthorize?: (payload?: string) => void;
    },
) {
    const callbackUrl = useMemo(() => gitpodHostUrl.with({ pathname: `/auth/callback` }).toString(), []);

    const [mode, setMode] = useState<"new" | "edit">("new");
    const [providerEntry, setProviderEntry] = useState<AuthProvider | undefined>(undefined);

    const [type, setType] = useState<AuthProviderType>(AuthProviderType.GITLAB);
    const [host, setHost] = useState<string>("");
    const [clientId, setClientId] = useState<string>("");
    const [clientSecret, setClientSecret] = useState<string>("");
    const [authorizationUrl, setAuthorizationUrl] = useState("");
    const [tokenUrl, setTokenUrl] = useState("");

    const [busy, setBusy] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [validationError, setValidationError] = useState<string | undefined>();

    const createProvider = useCreateUserAuthProviderMutation();
    const updateProvider = useUpdateUserAuthProviderMutation();

    const availableProviderOptions = useAuthProviderOptionsQuery(false);

    useEffect(() => {
        setMode(props.mode);
        if (props.mode === "edit") {
            setProviderEntry(props.provider);
            setType(props.provider.type);
            setHost(props.provider.host);
            setClientId(props.provider.oauth2Config?.clientId || "");
            setClientSecret(props.provider.oauth2Config?.clientSecret || "");
            setAuthorizationUrl(props.provider.oauth2Config?.authorizationUrl || "");
            setTokenUrl(props.provider.oauth2Config?.tokenUrl || "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setErrorMessage(undefined);
        validate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId, clientSecret, authorizationUrl, tokenUrl, type]);

    const onClose = () => props.onClose && props.onClose();
    const onUpdate = () => props.onUpdate && props.onUpdate();

    const activate = async () => {
        setBusy(true);
        setErrorMessage(undefined);
        try {
            let newProvider: AuthProvider;

            if (mode === "new") {
                newProvider = await createProvider.mutateAsync({
                    provider: {
                        clientId,
                        clientSecret,
                        authorizationUrl,
                        tokenUrl,
                        type,
                        host,
                        userId: props.userId,
                    },
                });
            } else {
                newProvider = await updateProvider.mutateAsync({
                    provider: {
                        id: providerEntry?.id || "",
                        clientId,
                        clientSecret: clientSecret === "redacted" ? "" : clientSecret,
                        authorizationUrl,
                        tokenUrl,
                    },
                });
            }

            // the server is checking periodically for updates of dynamic providers, thus we need to
            // wait at least 2 seconds for the changes to be propagated before we try to use this provider.
            await new Promise((resolve) => setTimeout(resolve, 2000));

            onUpdate();

            const updateProviderEntry = async () => {
                const { authProvider } = await authProviderClient.getAuthProvider({
                    authProviderId: newProvider.id,
                });
                if (authProvider) {
                    setProviderEntry(authProvider);
                }
            };

            // just open the authorization window and do *not* await
            openAuthorizeWindow({
                login: props.login,
                host: newProvider.host,
                onSuccess: (payload) => {
                    updateProviderEntry();
                    onUpdate();
                    props.onAuthorize && props.onAuthorize(payload);
                    onClose();
                },
                onError: (payload) => {
                    updateProviderEntry();
                    let errorMessage: string;
                    if (typeof payload === "string") {
                        errorMessage = payload;
                    } else {
                        errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                    }
                    setErrorMessage(errorMessage);
                },
            });

            if (props.closeable) {
                // close the modal, as the creation phase is done anyways.
                onClose();
            } else {
                // switch mode to stay and edit this integration.
                // this modal is expected to be closed programmatically.
                setMode("edit");
                setProviderEntry(newProvider);
            }
        } catch (error) {
            console.log(error);
            setErrorMessage("message" in error ? error.message : "Failed to update Git provider");
        }
        setBusy(false);
    };

    const updateHostValue = (host: string) => {
        if (mode === "new") {
            let newHostValue = host;

            if (host.startsWith("https://")) {
                newHostValue = host.replace("https://", "");
            }

            setHost(newHostValue);
            setErrorMessage(undefined);
        }
    };

    const updateClientId = (value: string) => {
        setClientId(value.trim());
    };
    const updateClientSecret = (value: string) => {
        setClientSecret(value.trim());
    };
    const updateAuthorizationUrl = (value: string) => {
        setAuthorizationUrl(value.trim());
    };
    const updateTokenUrl = (value: string) => {
        setTokenUrl(value.trim());
    };

    const validate = () => {
        const errors: string[] = [];
        if (clientId.trim().length === 0) {
            errors.push(`${type === AuthProviderType.GITLAB ? "Application ID" : "Client ID"} is missing.`);
        }
        if (clientSecret.trim().length === 0) {
            errors.push(`${type === AuthProviderType.GITLAB ? "Secret" : "Client Secret"} is missing.`);
        }
        if (type === AuthProviderType.AZURE_DEVOPS) {
            if (authorizationUrl.trim().length === 0) {
                errors.push("Authorization URL is missing.");
            }
            if (tokenUrl.trim().length === 0) {
                errors.push("Token URL is missing.");
            }
        }
        if (errors.length === 0) {
            setValidationError(undefined);
            return true;
        } else {
            setValidationError(errors.join("\n"));
            return false;
        }
    };

    const getRedirectUrlDescription = (type: AuthProviderType, host: string) => {
        if (type === AuthProviderType.AZURE_DEVOPS) {
            return (
                <span>
                    Use this redirect URI to update the OAuth application and set it up.&nbsp;
                    <a
                        href="https://www.gitpod.io/docs/azure-devops-integration/#oauth-application"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="gp-link"
                    >
                        Learn more
                    </a>
                    .
                </span>
            );
        }
        let settingsUrl = ``;
        switch (type) {
            case AuthProviderType.GITHUB:
                // if host is empty or untouched by user, use the default value
                if (host === "") {
                    settingsUrl = "github.com/settings/developers";
                } else {
                    settingsUrl = `${host}/settings/developers`;
                }
                break;
            case AuthProviderType.GITLAB:
                // if host is empty or untouched by user, use the default value
                if (host === "") {
                    settingsUrl = "gitlab.com/-/profile/applications";
                } else {
                    settingsUrl = `${host}/-/profile/applications`;
                }
                break;
            default:
                return undefined;
        }
        let docsUrl = ``;
        switch (type) {
            case AuthProviderType.GITHUB:
                docsUrl = `https://www.gitpod.io/docs/github-integration/#oauth-application`;
                break;
            case AuthProviderType.GITLAB:
                docsUrl = `https://www.gitpod.io/docs/gitlab-integration/#oauth-application`;
                break;
            default:
                return undefined;
        }

        return (
            <span>
                Use this redirect URI to update the OAuth application. Go to{" "}
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
        // TODO: Use title and buttons props
        <Modal visible={!!props} onClose={onClose} closeable={props.closeable}>
            <Heading2 className="pb-2">{mode === "new" ? "New Git Integration" : "Git Integration"}</Heading2>
            <div className="space-y-4 border-t border-b border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 py-4">
                {mode === "edit" && !providerEntry?.verified && (
                    <Alert type="warning">You need to activate this integration.</Alert>
                )}
                <div className="flex flex-col">
                    <span className="text-gray-500">
                        {props.headerText ||
                            "Configure an integration with a self-managed instance of GitLab, GitHub, or Bitbucket."}
                    </span>
                </div>

                <div className="overscroll-contain max-h-96 space-y-4 overflow-y-auto pr-2">
                    {mode === "new" && (
                        <div className="flex flex-col space-y-2">
                            <label htmlFor="type" className="font-medium">
                                Provider Type
                            </label>
                            <select
                                name="type"
                                value={type}
                                disabled={mode !== "new"}
                                className="w-full"
                                onChange={(e) => setType(getNumber(e.target.value))}
                            >
                                {availableProviderOptions.map((options) => (
                                    <option key={options.type} value={options.type}>
                                        {options.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {mode === "new" && type === AuthProviderType.BITBUCKET_SERVER && (
                        <InfoBox className="my-4 mx-auto">
                            OAuth 2.0 support in Bitbucket Server was added in version 7.20.{" "}
                            <a
                                target="_blank"
                                href="https://confluence.atlassian.com/bitbucketserver/bitbucket-data-center-and-server-7-20-release-notes-1101934428.html"
                                rel="noopener noreferrer"
                                className="gp-link"
                            >
                                Learn more
                            </a>
                        </InfoBox>
                    )}
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="hostName" className="font-medium">
                            Provider Host Name
                        </label>
                        <input
                            id="hostName"
                            disabled={mode === "edit"}
                            type="text"
                            placeholder={getPlaceholderForIntegrationType(type)}
                            value={host}
                            className="w-full"
                            onChange={(e) => updateHostValue(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="redirectURI" className="font-medium">
                            Redirect URI
                        </label>
                        <InputWithCopy value={callbackUrl} tip="Copy the redirect URI to clipboard" />
                        <span className="text-gray-500 text-sm">{getRedirectUrlDescription(type, host)}</span>
                    </div>
                    {type === AuthProviderType.AZURE_DEVOPS && (
                        <>
                            <div className="flex flex-col space-y-2">
                                <label htmlFor="authorizationUrl" className="font-medium">{`Authorization URL`}</label>
                                <input
                                    name="Authorization URL"
                                    type="text"
                                    value={authorizationUrl}
                                    className="w-full"
                                    onChange={(e) => updateAuthorizationUrl(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col space-y-2">
                                <label htmlFor="tokenUrl" className="font-medium">{`Token URL`}</label>
                                <input
                                    name="Token URL"
                                    type="text"
                                    value={tokenUrl}
                                    className="w-full"
                                    onChange={(e) => updateTokenUrl(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="clientId" className="font-medium">{`${
                            type === AuthProviderType.GITLAB ? "Application ID" : "Client ID"
                        }`}</label>
                        <input
                            name="clientId"
                            type="text"
                            value={clientId}
                            className="w-full"
                            onChange={(e) => updateClientId(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="clientSecret" className="font-medium">{`${
                            type === AuthProviderType.GITLAB ? "Secret" : "Client Secret"
                        }`}</label>
                        <input
                            name="clientSecret"
                            type="password"
                            value={clientSecret}
                            className="w-full"
                            onChange={(e) => updateClientSecret(e.target.value)}
                        />
                    </div>
                </div>

                {(errorMessage || validationError) && (
                    <div className="flex rounded-md bg-red-600 p-3">
                        <img
                            className="w-4 h-4 mx-2 my-auto filter-brightness-10"
                            src={exclamation}
                            alt="exclamation mark icon"
                        />
                        <span className="text-white">{errorMessage || validationError}</span>
                    </div>
                )}
            </div>
            <div className="flex justify-end mt-6">
                <Button onClick={() => validate() && activate()} disabled={!!validationError || busy}>
                    Activate Integration
                </Button>
            </div>
        </Modal>
    );
}

function equals(a: Set<string>, b: Set<string>): boolean {
    return a.size === b.size && Array.from(a).every((e) => b.has(e));
}
