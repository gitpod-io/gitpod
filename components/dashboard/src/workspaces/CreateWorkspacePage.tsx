/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AdditionalUserData, CommitContext, GitpodServer, WithReferrerContext } from "@gitpod/gitpod-protocol";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { FC, FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import Modal from "../components/Modal";
import RepositoryFinder from "../components/RepositoryFinder";
import { UsageLimitReachedModal } from "../components/UsageLimitReachedModal";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { Heading1 } from "../components/typography/headings";
import { useAuthProviders } from "../data/auth-providers/auth-provider-query";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useListProjectsQuery } from "../data/projects/list-projects-query";
import { useCreateWorkspaceMutation } from "../data/workspaces/create-workspace-mutation";
import { useListWorkspacesQuery } from "../data/workspaces/list-workspaces-query";
import { useWorkspaceContext } from "../data/workspaces/resolve-context-query";
import { openAuthorizeWindow } from "../provider-utils";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { StartWorkspaceError } from "../start/StartPage";
import { VerifyModal } from "../start/VerifyModal";
import { StartWorkspaceOptions } from "../start/start-workspace-options";
import { UserContext, useCurrentUser } from "../user-context";
import { SelectAccountModal } from "../user-settings/SelectAccountModal";
import { settingsPathPreferences } from "../user-settings/settings.routes";
import { WorkspaceEntry } from "./WorkspaceEntry";
import { AuthorizeGit, useNeedsGitAuthorization } from "../components/AuthorizeGit";
import { settingsPathIntegrations } from "../user-settings/settings.routes";
import { useDirtyState } from "../hooks/use-dirty-state";
import { LinkButton } from "../components/LinkButton";
import { InputField } from "../components/forms/InputField";
import Alert from "../components/Alert";
import { WorkspaceDetails } from "./create-workspace/WorkspaceDetails";

export function CreateWorkspacePage() {
    const { user, setUser } = useContext(UserContext);
    const currentOrg = useCurrentOrg().data;
    const projects = useListProjectsQuery();
    const workspaces = useListWorkspacesQuery({ limit: 50 });
    const location = useLocation();
    const history = useHistory();
    const props = StartWorkspaceOptions.parseSearchParams(location.search);
    const [autostart, setAutostart] = useState<boolean | undefined>(props.autostart);
    const createWorkspaceMutation = useCreateWorkspaceMutation();

    const defaultLatestIde =
        props.ideSettings?.useLatestVersion !== undefined
            ? props.ideSettings.useLatestVersion
            : !!user?.additionalData?.ideSettings?.useLatestVersion;
    const [useLatestIde, setUseLatestIde] = useState(defaultLatestIde);
    const defaultIde =
        props.ideSettings?.defaultIde !== undefined
            ? props.ideSettings.defaultIde
            : user?.additionalData?.ideSettings?.defaultIde;
    const [selectedIde, setSelectedIde, selectedIdeIsDirty] = useDirtyState(defaultIde);
    const defaultWorkspaceClass = props.workspaceClass;
    const [selectedWsClass, setSelectedWsClass, selectedWsClassIsDirty] = useDirtyState(defaultWorkspaceClass);
    // TODO: handle errors in WorkspaceDetail
    const [errorWsClass] = useState<string | undefined>(undefined);
    const [contextURL, setContextURL] = useState<string | undefined>(
        StartWorkspaceOptions.parseContextUrl(location.hash),
    );
    const workspaceContext = useWorkspaceContext(contextURL);
    const [rememberOptions, setRememberOptions] = useState(false);
    const needsGitAuthorization = useNeedsGitAuthorization();

    const storeAutoStartOptions = useCallback(async () => {
        if (!workspaceContext.data || !user || !currentOrg) {
            return;
        }
        const cloneURL = CommitContext.is(workspaceContext.data) && workspaceContext.data.repository.cloneUrl;
        if (!cloneURL) {
            return;
        }
        let workspaceAutoStartOptions = (user.additionalData?.workspaceAutostartOptions || []).filter(
            (e) => !(e.cloneURL === cloneURL && e.organizationId === currentOrg.id),
        );

        // we only keep the last 20 options
        workspaceAutoStartOptions = workspaceAutoStartOptions.slice(-40);

        if (rememberOptions) {
            workspaceAutoStartOptions.push({
                cloneURL,
                organizationId: currentOrg.id,
                ideSettings: {
                    defaultIde: selectedIde,
                    useLatestVersion: useLatestIde,
                },
                workspaceClass: selectedWsClass,
            });
        }
        AdditionalUserData.set(user, {
            workspaceAutostartOptions: workspaceAutoStartOptions,
        });
        setUser(user);
        await getGitpodService().server.updateLoggedInUser(user);
        console.log("Stored autostart options", workspaceAutoStartOptions);
    }, [currentOrg, rememberOptions, selectedIde, selectedWsClass, setUser, useLatestIde, user, workspaceContext.data]);

    // see if we have a matching project based on context url and project's repo url
    const project = useMemo(() => {
        if (!workspaceContext.data || !projects.data) {
            return undefined;
        }
        if ("repository" in workspaceContext.data) {
            const cloneUrl = (workspaceContext.data as CommitContext)?.repository?.cloneUrl;
            if (!cloneUrl) {
                return;
            }

            return projects.data.projects.find((p) => p.cloneUrl === cloneUrl);
        }
    }, [projects.data, workspaceContext.data]);

    // Apply project ws class settings
    useEffect(() => {
        // If URL has a ws class set, we don't override it w/ project settings
        if (props.workspaceClass) {
            return;
        }

        if (!project) {
            // If no project and user hasn't changed ws class, reset it to default value
            // Empty value causes SelectWorkspaceClassComponent to use the default ws class
            if (!selectedWsClassIsDirty) {
                setSelectedWsClass(defaultWorkspaceClass, false);
            }
            return;
        }
        const wsClass = project.settings?.workspaceClasses;

        // only set if user hasn't changed the value themselves, and project has a vaue
        if (wsClass?.regular && !selectedWsClassIsDirty) {
            setSelectedWsClass(wsClass?.regular, false);
        }
    }, [defaultWorkspaceClass, project, props.workspaceClass, selectedWsClassIsDirty, setSelectedWsClass]);

    // In addition to updating state, we want to update the url hash as well
    // This allows the contextURL to persist if user changes orgs, or copies/shares url
    const handleContextURLChange = useCallback(
        (newContextURL: string) => {
            // we disable auto start if the user changes the context URL
            setAutostart(false);
            setContextURL(newContextURL);
            history.replace(`#${newContextURL}`);
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
    // TODO: handle errors in WorkspaceDetail
    const [errorIde] = useState<string | undefined>(undefined);

    const existingWorkspaces = useMemo(() => {
        if (!workspaces.data || !CommitContext.is(workspaceContext.data)) {
            return [];
        }
        return workspaces.data.filter(
            (ws) =>
                ws.latestInstance?.status?.phase === "running" &&
                CommitContext.is(ws.workspace.context) &&
                CommitContext.is(workspaceContext.data) &&
                ws.workspace.context.repository.cloneUrl === workspaceContext.data.repository.cloneUrl &&
                ws.workspace.context.revision === workspaceContext.data.revision,
        );
    }, [workspaces.data, workspaceContext.data]);
    const [selectAccountError, setSelectAccountError] = useState<SelectAccountPayload | undefined>(undefined);

    const createWorkspace = useCallback(
        async (options?: Omit<GitpodServer.CreateWorkspaceOptions, "contextUrl" | "organizationId">) => {
            // add options from search params
            const opts = options || {};

            // we already have shown running workspaces to the user
            opts.ignoreRunningWorkspaceOnSameCommit = true;
            opts.ignoreRunningPrebuild = true;

            // if user received an INVALID_GITPOD_YML yml for their contextURL they can choose to proceed using default configuration
            if (workspaceContext.error?.code === ErrorCodes.INVALID_GITPOD_YML) {
                opts.forceDefaultConfig = true;
            }

            if (!opts.workspaceClass) {
                opts.workspaceClass = selectedWsClass;
            }
            if (!opts.ideSettings) {
                opts.ideSettings = {
                    defaultIde: selectedIde,
                    useLatestVersion: useLatestIde,
                };
            }
            if (!contextURL) {
                return;
            }

            const organizationId = currentOrg?.id;
            if (!organizationId) {
                // We need an organizationId for this group of users
                console.error("Skipping createWorkspace");
                return;
            }

            try {
                if (createWorkspaceMutation.isStarting) {
                    console.log("Skipping duplicate createWorkspace call.");
                    return;
                }
                // we wait at least 5 secs
                const timeout = new Promise((resolve) => setTimeout(resolve, 5000));
                const result = await createWorkspaceMutation.createWorkspace({
                    contextUrl: contextURL,
                    organizationId,
                    ...opts,
                });
                await storeAutoStartOptions();
                await timeout;
                if (result.workspaceURL) {
                    window.location.href = result.workspaceURL;
                } else if (result.createdWorkspaceId) {
                    history.push(`/start/#${result.createdWorkspaceId}`);
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
            workspaceContext.error?.code,
            contextURL,
            currentOrg?.id,
            selectedWsClass,
            selectedIde,
            useLatestIde,
            createWorkspaceMutation,
            storeAutoStartOptions,
            history,
            autostart,
        ],
    );

    // listen on auto start changes
    useEffect(() => {
        if (!autostart) {
            return;
        }
        createWorkspace();
    }, [autostart, createWorkspace]);

    // when workspaceContext is available, we look up if options are remembered
    useEffect(() => {
        const cloneURL = CommitContext.is(workspaceContext.data) && workspaceContext.data.repository.cloneUrl;
        if (!cloneURL || autostart) {
            return undefined;
        }
        const rememberedOptions = (user?.additionalData?.workspaceAutostartOptions || []).find(
            (e) => e.cloneURL === cloneURL && e.organizationId === currentOrg?.id,
        );
        if (rememberedOptions) {
            setRememberOptions(true);
            if (!selectedIdeIsDirty) {
                setSelectedIde(rememberedOptions.ideSettings?.defaultIde, false);
                setUseLatestIde(!!rememberedOptions.ideSettings?.useLatestVersion);
            }

            if (!selectedWsClassIsDirty) {
                setSelectedWsClass(rememberedOptions.workspaceClass, false);
            }
            if (autostart === undefined) {
                setAutostart(true);
            }
        } else {
            setRememberOptions(false);
            // reset the ide settings to the user's default IF they haven't changed it manually
            if (!selectedIdeIsDirty) {
                setSelectedIde(defaultIde, false);
                setUseLatestIde(defaultLatestIde);
            }
        }
        // we only update the remembered options when the workspaceContext changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceContext.data]);

    // Need a wrapper here so we call createWorkspace w/o any arguments
    const onClickCreate = useCallback(() => createWorkspace(), [createWorkspace]);

    // if the context URL has a referrer prefix, we set the referrerIde as the selected IDE and autostart the workspace.
    useEffect(() => {
        if (workspaceContext.data && WithReferrerContext.is(workspaceContext.data)) {
            if (workspaceContext.data.referrerIde && !selectedIdeIsDirty) {
                setSelectedIde(workspaceContext.data.referrerIde, false);
            }
            setAutostart(true);
        }
    }, [selectedIdeIsDirty, setSelectedIde, workspaceContext.data]);

    // Derive if the continue button is disabled based on current state
    const continueButtonDisabled = useMemo(() => {
        if (workspaceContext.isLoading || !contextURL || contextURL.length === 0 || !!errorIde || !!errorWsClass) {
            return true;
        }
        if (workspaceContext.error) {
            // For INVALID_GITPOD_YML we don't want to disable the button
            // The user see a warning that their file is invalid, but they can continue and it will be ignored
            if (workspaceContext.error.code === ErrorCodes.INVALID_GITPOD_YML) {
                return false;
            }
            return true;
        }

        return false;
    }, [contextURL, errorIde, errorWsClass, workspaceContext.error, workspaceContext.isLoading]);

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
                <div className="flex flex-col max-h-screen max-w-lg mx-auto items-center w-full">
                    <Heading1>New Workspace</Heading1>
                    <div className="text-gray-500 text-center text-base">
                        Start a new workspace with the following options.
                    </div>
                    <AuthorizeGit className="mt-12" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col mt-32 mx-auto ">
            <div className="flex flex-col max-h-screen max-w-lg mx-auto items-center w-full">
                <Heading1>New Workspace</Heading1>
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
                            setSelection={handleContextURLChange}
                            initialValue={contextURL}
                            disabled={createWorkspaceMutation.isStarting}
                        />
                    </InputField>

                    {/* <InputField error={errorIde}>
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
                    </InputField> */}

                    <WorkspaceDetails
                        selectedIDE={selectedIde || ""}
                        useLatestIDE={useLatestIde}
                        selectedWSClassID={selectedWsClass || ""}
                        onWSClassChange={setSelectedWsClass}
                        onIDEChange={onSelectEditorChange}
                    />
                </div>
                <div className="w-full flex justify-end mt-3 space-x-2 px-6">
                    <Button
                        onClick={onClickCreate}
                        autoFocus={true}
                        size="block"
                        loading={createWorkspaceMutation.isStarting}
                        disabled={continueButtonDisabled}
                    >
                        {createWorkspaceMutation.isStarting ? "Opening Workspace ..." : "Continue"}
                    </Button>
                </div>

                {workspaceContext.data && (
                    <RememberOptions
                        disabled={workspaceContext.isLoading || createWorkspaceMutation.isStarting}
                        checked={rememberOptions}
                        onChange={setRememberOptions}
                    />
                )}
                {existingWorkspaces.length > 0 && !createWorkspaceMutation.isStarting && (
                    <div className="w-full flex flex-col justify-end px-6">
                        <p className="mt-6 text-center text-base">Running workspaces on this revision</p>
                        {existingWorkspaces.map((w) => {
                            return (
                                <a
                                    key={w.workspace.id}
                                    href={w.latestInstance?.ideUrl || `/start/${w.workspace.id}}`}
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

function RememberOptions(params: { disabled?: boolean; checked: boolean; onChange: (checked: boolean) => void }) {
    const { disabled, checked, onChange } = params;

    return (
        <>
            <div className={"w-full flex justify-center mt-3 px-8 mx-2"}>
                <CheckboxInputField
                    label="Autostart with these options for this repository."
                    checked={checked}
                    disabled={disabled}
                    topMargin={false}
                    onChange={onChange}
                />
            </div>
            <div className={"w-full flex justify-center px-8 mx-2"}>
                <p className="text-gray-400 dark:text-gray-500 text-sm">
                    Don't worry, you can reset this anytime in your{" "}
                    <Link to={settingsPathPreferences} className="gp-link">
                        preferences
                    </Link>
                    .
                </p>
            </div>
        </>
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
            return <UsageLimitReachedModal onClose={reset} hints={error?.data} />;
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

    const authProviders = useAuthProviders();
    const authProvider = authProviders.data?.find((a) => a.host === host);
    if (!authProvider) {
        return <RepositoryInputError title="The repository was not found in your account." />;
    }

    // TODO: this should be aware of already granted permissions
    const missingScope = authProvider.authProviderType === "GitHub" ? "repo" : "read_repository";
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
            <h3 className="flex">
                <span className="flex-grow">Limit Reached</span>
                <img className="rounded-full w-8 h-8" src={user?.avatarUrl || ""} alt={user?.name || "Anonymous"} />
            </h3>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-4 -mx-6 px-6 py-2">
                {p.children}
            </div>
            <div className="flex justify-end mt-6">
                <a href={gitpodHostUrl.asDashboard().toString()}>
                    <button className="secondary">Go to Dashboard</button>
                </a>
                <a href={gitpodHostUrl.with({ pathname: "plans" }).toString()} className="ml-2">
                    <button>Upgrade</button>
                </a>
            </div>
        </Modal>
    );
}
