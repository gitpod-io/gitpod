/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { FC, FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router";
import Alert from "../components/Alert";
import { AuthorizeGit, useNeedsGitAuthorization } from "../components/AuthorizeGit";
import { LinkButton } from "../components/LinkButton";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import RepositoryFinder from "../components/RepositoryFinder";
import SelectIDEComponent from "../components/SelectIDEComponent";
import SelectWorkspaceClassComponent from "../components/SelectWorkspaceClassComponent";
import { UsageLimitReachedModal } from "../components/UsageLimitReachedModal";
import { InputField } from "../components/forms/InputField";
import { Heading1 } from "../components/typography/headings";
import { useAuthProviderDescriptions } from "../data/auth-providers/auth-provider-descriptions-query";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useListAllProjectsQuery } from "../data/projects/list-all-projects-query";
import { useCreateWorkspaceMutation } from "../data/workspaces/create-workspace-mutation";
import { useListWorkspacesQuery } from "../data/workspaces/list-workspaces-query";
import { useWorkspaceContext } from "../data/workspaces/resolve-context-query";
import { useDirtyState } from "../hooks/use-dirty-state";
import { openAuthorizeWindow } from "../provider-utils";
import { gitpodHostUrl } from "../service/service";
import { StartWorkspaceError } from "../start/StartPage";
import { VerifyModal } from "../start/VerifyModal";
import { StartWorkspaceOptions } from "../start/start-workspace-options";
import { UserContext, useCurrentUser } from "../user-context";
import { SelectAccountModal } from "../user-settings/SelectAccountModal";
import { settingsPathIntegrations } from "../user-settings/settings.routes";
import { WorkspaceEntry } from "./WorkspaceEntry";
import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import {
    CreateAndStartWorkspaceRequest_ContextURL,
    WorkspacePhase_Phase,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { Button } from "@podkit/buttons/Button";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { CreateAndStartWorkspaceRequest } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { PartialMessage } from "@bufbuild/protobuf";
import { User_WorkspaceAutostartOption } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { EditorReference } from "@gitpod/public-api/lib/gitpod/v1/editor_pb";
import { converter } from "../service/public-api";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { useOrgWorkspaceClassesQuery } from "../data/organizations/org-workspace-classes-query";

export function CreateWorkspacePage() {
    const { user, setUser } = useContext(UserContext);
    const updateUser = useUpdateCurrentUserMutation();
    const { data: orgWorkspaceClasses } = useOrgWorkspaceClassesQuery();
    const currentOrg = useCurrentOrg().data;
    const projects = useListAllProjectsQuery();
    const workspaces = useListWorkspacesQuery({ limit: 50 });
    const location = useLocation();
    const history = useHistory();
    const props = StartWorkspaceOptions.parseSearchParams(location.search);
    const [autostart, setAutostart] = useState<boolean | undefined>(props.autostart);
    const createWorkspaceMutation = useCreateWorkspaceMutation();

    const defaultLatestIde =
        props.ideSettings?.useLatestVersion !== undefined
            ? props.ideSettings.useLatestVersion
            : user?.editorSettings?.version === "latest";
    const [useLatestIde, setUseLatestIde] = useState(defaultLatestIde);
    const defaultIde =
        props.ideSettings?.defaultIde !== undefined ? props.ideSettings.defaultIde : user?.editorSettings?.name;
    const [selectedIde, setSelectedIde, selectedIdeIsDirty] = useDirtyState(defaultIde);
    const defaultWorkspaceClass = props.workspaceClass ?? orgWorkspaceClasses?.find((e) => e.isDefault)?.id;
    const [selectedWsClass, setSelectedWsClass, selectedWsClassIsDirty] = useDirtyState(defaultWorkspaceClass);
    const [errorWsClass, setErrorWsClass] = useState<string | undefined>(undefined);
    const [contextURL, setContextURL] = useState<string | undefined>(
        StartWorkspaceOptions.parseContextUrl(location.hash),
    );
    const [optionsLoaded, setOptionsLoaded] = useState(false);
    // Currently this tracks if the user has selected a project from the dropdown
    // Need to make sure we initialize this to a project if the url hash value maps to a project's repo url
    // Will need to handle multiple projects w/ same repo url
    const [selectedProjectID, setSelectedProjectID] = useState<string | undefined>(undefined);
    const workspaceContext = useWorkspaceContext(contextURL);
    const needsGitAuthorization = useNeedsGitAuthorization();

    const storeAutoStartOptions = useCallback(async () => {
        if (!workspaceContext.data || !user || !currentOrg) {
            return;
        }
        const cloneURL = workspaceContext.data.cloneUrl;
        if (!cloneURL) {
            return;
        }
        let workspaceAutoStartOptions = (user.workspaceAutostartOptions || []).filter(
            (e) => !(e.cloneUrl === cloneURL && e.organizationId === currentOrg.id),
        );

        // we only keep the last 40 options
        workspaceAutoStartOptions = workspaceAutoStartOptions.slice(-40);

        // remember options
        workspaceAutoStartOptions.push(
            new User_WorkspaceAutostartOption({
                cloneUrl: cloneURL,
                organizationId: currentOrg.id,
                workspaceClass: selectedWsClass,
                editorSettings: new EditorReference({
                    name: selectedIde,
                    version: useLatestIde ? "latest" : "stable",
                }),
            }),
        );
        const updatedUser = await updateUser.mutateAsync({
            additionalData: {
                workspaceAutostartOptions: workspaceAutoStartOptions.map((o) =>
                    converter.fromWorkspaceAutostartOption(o),
                ),
            },
        });
        setUser(updatedUser);
    }, [updateUser, currentOrg, selectedIde, selectedWsClass, setUser, useLatestIde, user, workspaceContext.data]);

    // see if we have a matching project based on context url and project's repo url
    const project = useMemo(() => {
        if (!workspaceContext.data || !projects.data) {
            return undefined;
        }
        const cloneUrl = workspaceContext.data.cloneUrl;
        if (!cloneUrl) {
            return;
        }
        // TODO: Account for multiple projects w/ the same cloneUrl
        return projects.data.projects.find((p) => p.cloneUrl === cloneUrl);
    }, [projects.data, workspaceContext.data]);

    // Handle the case where the context url in the hash matches a project and we don't have that project selected yet
    useEffect(() => {
        if (project && !selectedProjectID) {
            setSelectedProjectID(project.id);
        }
    }, [project, selectedProjectID]);

    // In addition to updating state, we want to update the url hash as well
    // This allows the contextURL to persist if user changes orgs, or copies/shares url
    const handleContextURLChange = useCallback(
        (repo: SuggestedRepository) => {
            // we disable auto start if the user changes the context URL
            setAutostart(false);
            // TODO: consider storing SuggestedRepository as state vs. discrete props
            setContextURL(repo?.url);
            setSelectedProjectID(repo?.projectId);
            // TOOD: consider dropping this - it's a lossy conversion
            history.replace(`#${repo?.url}`);
        },
        [history],
    );

    const onSelectEditorChange = useCallback(
        (ide: string, useLatest: boolean) => {
            setSelectedIde(ide);
            setUseLatestIde(useLatest);
        },
        [setSelectedIde, setUseLatestIde],
    );
    const [errorIde, setErrorIde] = useState<string | undefined>(undefined);

    const existingWorkspaces = useMemo(() => {
        if (!workspaces.data || !workspaceContext.data) {
            return [];
        }
        return workspaces.data.filter(
            (ws) =>
                ws.status?.phase?.name === WorkspacePhase_Phase.RUNNING &&
                workspaceContext.data &&
                ws.status.gitStatus?.cloneUrl === workspaceContext.data.cloneUrl &&
                ws.status?.gitStatus?.latestCommit === workspaceContext.data.revision,
        );
    }, [workspaces.data, workspaceContext.data]);
    const [selectAccountError, setSelectAccountError] = useState<SelectAccountPayload | undefined>(undefined);

    const createWorkspace = useCallback(
        /**
         * options will omit
         * - source.url
         * - source.workspaceClass
         * - metadata.organizationId
         * - metadata.configurationId
         */
        async (options?: PartialMessage<CreateAndStartWorkspaceRequest>) => {
            // add options from search params
            const opts = options || {};

            if (!contextURL) {
                return;
            }

            const organizationId = currentOrg?.id;
            if (!organizationId) {
                // We need an organizationId for this group of users
                console.error("Skipping createWorkspace");
                return;
            }

            // if user received an INVALID_GITPOD_YML yml for their contextURL they can choose to proceed using default configuration
            if (
                workspaceContext.error &&
                ApplicationError.hasErrorCode(workspaceContext.error) &&
                workspaceContext.error.code === ErrorCodes.INVALID_GITPOD_YML
            ) {
                opts.forceDefaultConfig = true;
            }

            try {
                if (createWorkspaceMutation.isStarting) {
                    console.log("Skipping duplicate createWorkspace call.");
                    return;
                }
                // we wait at least 5 secs
                const timeout = new Promise((resolve) => setTimeout(resolve, 5000));

                if (!opts.metadata) {
                    opts.metadata = {};
                }
                opts.metadata.organizationId = organizationId;
                opts.metadata.configurationId = selectedProjectID;

                const contextUrlSource: PartialMessage<CreateAndStartWorkspaceRequest_ContextURL> =
                    opts.source?.case === "contextUrl" ? opts.source?.value ?? {} : {};
                contextUrlSource.url = contextURL;
                contextUrlSource.workspaceClass = selectedWsClass;
                if (!contextUrlSource.editor || !contextUrlSource.editor.name) {
                    contextUrlSource.editor = {
                        name: selectedIde,
                        version: useLatestIde ? "latest" : undefined,
                    };
                }
                opts.source = {
                    case: "contextUrl",
                    value: contextUrlSource,
                };
                const result = await createWorkspaceMutation.createWorkspace(opts);
                await storeAutoStartOptions();
                await timeout;
                if (result.workspace?.status?.workspaceUrl) {
                    window.location.href = result.workspace.status.workspaceUrl;
                } else if (result.workspace!.id) {
                    history.push(`/start/#${result.workspace!.id}`);
                }
            } catch (error) {
                console.log(error);
            } finally {
                // we only auto start once, so we don't run into endless start loops on errors
                if (autostart) {
                    setAutostart(false);
                }
            }
        },
        [
            workspaceContext.error,
            contextURL,
            currentOrg?.id,
            selectedWsClass,
            selectedIde,
            useLatestIde,
            createWorkspaceMutation,
            selectedProjectID,
            storeAutoStartOptions,
            history,
            autostart,
        ],
    );

    // listen on auto start changes
    useEffect(() => {
        if (!autostart || !optionsLoaded) {
            return;
        }
        createWorkspace();
    }, [autostart, optionsLoaded, createWorkspace]);

    // when workspaceContext is available, we look up if options are remembered
    useEffect(() => {
        if (!workspaceContext.data || !user || !currentOrg) {
            return;
        }
        const cloneURL = workspaceContext.data.cloneUrl;
        if (!cloneURL) {
            return undefined;
        }
        const rememberedOptions = (user?.workspaceAutostartOptions || []).find(
            (e) => e.cloneUrl === cloneURL && e.organizationId === currentOrg?.id,
        );
        if (rememberedOptions) {
            if (!selectedIdeIsDirty) {
                setSelectedIde(rememberedOptions.editorSettings?.name, false);
                setUseLatestIde(rememberedOptions.editorSettings?.version === "latest");
            }

            if (!selectedWsClassIsDirty) {
                setSelectedWsClass(rememberedOptions.workspaceClass, false);
            }
        } else {
            // reset the ide settings to the user's default IF they haven't changed it manually
            if (!selectedIdeIsDirty) {
                setSelectedIde(defaultIde, false);
                setUseLatestIde(defaultLatestIde);
            }
            if (!selectedWsClassIsDirty) {
                const projectWsClass = project?.settings?.workspaceClasses?.regular;
                setSelectedWsClass(projectWsClass || defaultWorkspaceClass, false);
            }
        }
        setOptionsLoaded(true);
        // we only update the remembered options when the workspaceContext changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceContext.data, setOptionsLoaded, project]);

    // Need a wrapper here so we call createWorkspace w/o any arguments
    const onClickCreate = useCallback(() => createWorkspace(), [createWorkspace]);

    // if the context URL has a referrer prefix, we set the referrerIde as the selected IDE and autostart the workspace.
    useEffect(() => {
        if (workspaceContext.data && workspaceContext.data.refererIDE) {
            if (!selectedIdeIsDirty) {
                setSelectedIde(workspaceContext.data.refererIDE, false);
            }
            setAutostart(true);
        }
    }, [selectedIdeIsDirty, setSelectedIde, workspaceContext.data]);

    // on error we disable auto start and consider options loaded
    useEffect(() => {
        if (workspaceContext.error || createWorkspaceMutation.error) {
            setAutostart(false);
            setOptionsLoaded(true);
        }
    }, [workspaceContext.error, createWorkspaceMutation.error]);

    // Derive if the continue button is disabled based on current state
    const continueButtonDisabled = useMemo(() => {
        if (
            autostart ||
            workspaceContext.isLoading ||
            !contextURL ||
            contextURL.length === 0 ||
            !!errorIde ||
            !!errorWsClass
        ) {
            return true;
        }
        if (workspaceContext.error) {
            // For INVALID_GITPOD_YML we don't want to disable the button
            // The user see a warning that their file is invalid, but they can continue and it will be ignored
            if (
                workspaceContext.error &&
                ApplicationError.hasErrorCode(workspaceContext.error) &&
                workspaceContext.error.code === ErrorCodes.INVALID_GITPOD_YML
            ) {
                return false;
            }
            return true;
        }

        return false;
    }, [autostart, contextURL, errorIde, errorWsClass, workspaceContext.error, workspaceContext.isLoading]);

    if (SelectAccountPayload.is(selectAccountError)) {
        return (
            <SelectAccountModal
                {...selectAccountError}
                close={() => {
                    history.push(settingsPathIntegrations);
                }}
            />
        );
    }

    if (needsGitAuthorization) {
        return (
            <div className="flex flex-col mt-32 mx-auto ">
                <div className="flex flex-col max-h-screen max-w-xl mx-auto items-center w-full">
                    <Heading1>New workspace</Heading1>
                    <div className="text-gray-500 text-center text-base">
                        Start a new workspace with the following options.
                    </div>
                    <AuthorizeGit className="mt-12 border-2 border-gray-100 dark:border-gray-800 rounded-lg" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col mt-32 mx-auto ">
            <div className="flex flex-col max-h-screen max-w-xl mx-auto items-center w-full">
                <Heading1>New workspace</Heading1>
                <div className="text-gray-500 text-center text-base">
                    Create a new workspace in the{" "}
                    <span className="font-semibold text-gray-600 dark:text-gray-400">{currentOrg?.name}</span>{" "}
                    organization.
                </div>

                <div className="-mx-6 px-6 mt-6 w-full">
                    {createWorkspaceMutation.error || workspaceContext.error ? (
                        <ErrorMessage
                            error={
                                (createWorkspaceMutation.error as StartWorkspaceError) ||
                                (workspaceContext.error as StartWorkspaceError)
                            }
                            setSelectAccountError={setSelectAccountError}
                            reset={() => {
                                createWorkspaceMutation.reset();
                            }}
                        />
                    ) : null}

                    <InputField>
                        <RepositoryFinder
                            onChange={handleContextURLChange}
                            selectedContextURL={contextURL}
                            selectedConfigurationId={selectedProjectID}
                            expanded={!contextURL}
                            disabled={createWorkspaceMutation.isStarting}
                        />
                    </InputField>

                    <InputField error={errorIde}>
                        <SelectIDEComponent
                            onSelectionChange={onSelectEditorChange}
                            setError={setErrorIde}
                            selectedIdeOption={selectedIde}
                            useLatest={useLatestIde}
                            disabled={createWorkspaceMutation.isStarting}
                            loading={workspaceContext.isLoading}
                        />
                    </InputField>

                    <InputField error={errorWsClass}>
                        <SelectWorkspaceClassComponent
                            onSelectionChange={setSelectedWsClass}
                            setError={setErrorWsClass}
                            selectedWorkspaceClass={selectedWsClass}
                            disabled={createWorkspaceMutation.isStarting}
                            loading={workspaceContext.isLoading}
                        />
                    </InputField>
                </div>
                <div className="w-full flex justify-end mt-3 space-x-2 px-6">
                    <LoadingButton
                        onClick={onClickCreate}
                        autoFocus={true}
                        className="w-full"
                        loading={createWorkspaceMutation.isStarting || !!autostart}
                        disabled={continueButtonDisabled}
                    >
                        {createWorkspaceMutation.isStarting ? "Opening workspace ..." : "Continue"}
                    </LoadingButton>
                </div>
                {existingWorkspaces.length > 0 && !createWorkspaceMutation.isStarting && (
                    <div className="w-full flex flex-col justify-end px-6">
                        <p className="mt-6 text-center text-base">Running workspaces on this revision</p>
                        {existingWorkspaces.map((w) => {
                            return (
                                <a
                                    key={w.id}
                                    href={w.status?.workspaceUrl || `/start/${w.id}}`}
                                    className="rounded-xl group hover:bg-gray-100 dark:hover:bg-gray-800 flex"
                                >
                                    <WorkspaceEntry info={w} shortVersion={true} />
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function tryAuthorize(host: string, scopes?: string[]): Promise<SelectAccountPayload | undefined> {
    const result = new Deferred<SelectAccountPayload | undefined>();
    openAuthorizeWindow({
        host,
        scopes,
        onSuccess: () => {
            result.resolve();
        },
        onError: (error) => {
            if (typeof error === "string") {
                try {
                    const payload = JSON.parse(error);
                    if (SelectAccountPayload.is(payload)) {
                        result.resolve(payload);
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        },
    }).catch((error) => {
        console.log(error);
    });
    return result.promise;
}

interface ErrorMessageProps {
    error?: StartWorkspaceError;
    reset: () => void;
    setSelectAccountError: (error?: SelectAccountPayload) => void;
}
const ErrorMessage: FunctionComponent<ErrorMessageProps> = ({ error, reset, setSelectAccountError }) => {
    if (!error) {
        return null;
    }

    switch (error.code) {
        case ErrorCodes.INVALID_GITPOD_YML:
            return (
                <RepositoryInputError
                    title="Invalid YAML configuration; using default settings."
                    message={error.message}
                />
            );
        case ErrorCodes.NOT_AUTHENTICATED:
            return (
                <RepositoryInputError
                    title="You are not authenticated."
                    linkText={`Authorize with ${error.data?.host}`}
                    linkOnClick={() => {
                        tryAuthorize(error.data?.host, error.data?.scopes).then((payload) =>
                            setSelectAccountError(payload),
                        );
                    }}
                />
            );
        case ErrorCodes.NOT_FOUND:
            return <RepositoryNotFound error={error} />;
        case ErrorCodes.PERMISSION_DENIED:
            return <RepositoryInputError title="Access is not allowed" />;
        case ErrorCodes.USER_BLOCKED:
            window.location.href = "/blocked";
            return null;
        case ErrorCodes.TOO_MANY_RUNNING_WORKSPACES:
            return <LimitReachedParallelWorkspacesModal />;
        case ErrorCodes.INVALID_COST_CENTER:
            return <RepositoryInputError title={`The organization '${error.data}' is not valid.`} />;
        case ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED:
            return <UsageLimitReachedModal onClose={reset} />;
        case ErrorCodes.NEEDS_VERIFICATION:
            return <VerifyModal />;
        default:
            // Catch-All error message
            return (
                <RepositoryInputError
                    title="We're sorry, there seems to have been an error."
                    message={error.message || JSON.stringify(error)}
                />
            );
    }
};

type RepositoryInputErrorProps = {
    type?: "error" | "warning";
    title: string;
    message?: string;
    linkText?: string;
    linkHref?: string;
    linkOnClick?: () => void;
};
const RepositoryInputError: FC<RepositoryInputErrorProps> = ({ title, message, linkText, linkHref, linkOnClick }) => {
    return (
        <Alert type="warning">
            <div>
                <span className="text-sm font-semibold">{title}</span>
                {message && (
                    <div className="font-mono text-xs">
                        <span>{message}</span>
                    </div>
                )}
            </div>
            {linkText && (
                <div>
                    {linkOnClick ? (
                        <LinkButton className="whitespace-nowrap text-sm font-semibold" onClick={linkOnClick}>
                            {linkText}
                        </LinkButton>
                    ) : (
                        <a className="gp-link whitespace-nowrap text-sm font-semibold" href={linkHref}>
                            {linkText}
                        </a>
                    )}
                </div>
            )}
        </Alert>
    );
};

export const RepositoryNotFound: FC<{ error: StartWorkspaceError }> = ({ error }) => {
    const { host, owner, userIsOwner, userScopes = [], lastUpdate } = error.data || {};

    const authProviders = useAuthProviderDescriptions();
    const authProvider = authProviders.data?.find((a) => a.host === host);
    if (!authProvider) {
        return <RepositoryInputError title="The repository was not found in your account." />;
    }

    // TODO: this should be aware of already granted permissions
    const missingScope =
        authProvider.type === AuthProviderType.GITHUB
            ? "repo"
            : authProvider.type === AuthProviderType.GITLAB
            ? "api"
            : "";
    const authorizeURL = gitpodHostUrl
        .withApi({
            pathname: "/authorize",
            search: `returnTo=${encodeURIComponent(window.location.toString())}&host=${host}&scopes=${missingScope}`,
        })
        .toString();

    if (!userScopes.includes(missingScope)) {
        return (
            <RepositoryInputError
                title="The repository may be private. Please authorize Gitpod to access private repositories."
                linkText="Grant access"
                linkHref={authorizeURL}
            />
        );
    }

    if (userIsOwner) {
        return <RepositoryInputError title="The repository was not found in your account." />;
    }

    let updatedRecently = false;
    if (lastUpdate && typeof lastUpdate === "string") {
        try {
            const minutes = (Date.now() - Date.parse(lastUpdate)) / 1000 / 60;
            updatedRecently = minutes < 5;
        } catch {
            // ignore
        }
    }

    if (!updatedRecently) {
        return (
            <RepositoryInputError
                title={`Permission to access private repositories has been granted. If you are a member of '${owner}', please try to request access for Gitpod.`}
                linkText="Request access"
                linkHref={authorizeURL}
            />
        );
    }

    return (
        <RepositoryInputError
            title={`Your access token was updated recently. Please try again if the repository exists and Gitpod was approved for '${owner}'.`}
            linkText="Authorize again"
            linkHref={authorizeURL}
        />
    );
};

export function LimitReachedParallelWorkspacesModal() {
    return (
        <LimitReachedModal>
            <p className="mt-1 mb-2 text-base dark:text-gray-400">
                You have reached the limit of parallel running workspaces for your account. Please, upgrade or stop one
                of the running workspaces.
            </p>
        </LimitReachedModal>
    );
}

export function LimitReachedModal(p: { children: React.ReactNode }) {
    const user = useCurrentUser();
    return (
        // TODO: Use title and buttons props
        <Modal visible={true} closeable={false} onClose={() => {}}>
            <ModalHeader>
                <div className="flex">
                    <span className="flex-grow">Limit reached</span>
                    <img className="rounded-full w-8 h-8" src={user?.avatarUrl || ""} alt={user?.name || "Anonymous"} />
                </div>
            </ModalHeader>
            <ModalBody>{p.children}</ModalBody>
            <ModalFooter>
                <a href={gitpodHostUrl.asDashboard().toString()}>
                    <Button variant="secondary">Go to dashboard</Button>
                </a>
                <a href={gitpodHostUrl.with({ pathname: "plans" }).toString()} className="ml-2">
                    <Button>Upgrade</Button>
                </a>
            </ModalFooter>
        </Modal>
    );
}
