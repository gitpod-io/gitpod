/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CommitContext, GitpodServer, WithReferrerContext } from "@gitpod/gitpod-protocol";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router";
import { Button } from "../components/Button";
import RepositoryFinder from "../components/RepositoryFinder";
import SelectIDEComponent from "../components/SelectIDEComponent";
import SelectWorkspaceClassComponent from "../components/SelectWorkspaceClassComponent";
import { Heading1 } from "../components/typography/headings";
import { UsageLimitReachedModal } from "../components/UsageLimitReachedModal";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useListProjectsQuery } from "../data/projects/list-projects-query";
import { useCreateWorkspaceMutation } from "../data/workspaces/create-workspace-mutation";
import { useListWorkspacesQuery } from "../data/workspaces/list-workspaces-query";
import { useWorkspaceContext } from "../data/workspaces/resolve-context-query";
import { openAuthorizeWindow } from "../provider-utils";
import { gitpodHostUrl } from "../service/service";
import { LimitReachedOutOfHours, LimitReachedParallelWorkspacesModal } from "../start/CreateWorkspace";
import { StartWorkspaceOptions } from "../start/start-workspace-options";
import { StartWorkspaceError } from "../start/StartPage";
import { useCurrentUser } from "../user-context";
import { SelectAccountModal } from "../user-settings/SelectAccountModal";
import { WorkspaceEntry } from "./WorkspaceEntry";

export const useNewCreateWorkspacePage = () => {
    const { startWithOptions } = useFeatureFlags();
    const user = useCurrentUser();
    return !!startWithOptions || !!user?.additionalData?.isMigratedToTeamOnlyAttribution;
};

export function CreateWorkspacePage() {
    const user = useCurrentUser();
    const currentOrg = useCurrentOrg().data;
    const projects = useListProjectsQuery();
    const workspaces = useListWorkspacesQuery({ limit: 50, orgId: currentOrg?.id });
    const location = useLocation();
    const history = useHistory();
    const props = StartWorkspaceOptions.parseSearchParams(location.search);
    const createWorkspaceMutation = useCreateWorkspaceMutation();
    const isStarting =
        createWorkspaceMutation.isLoading ||
        !!createWorkspaceMutation.data?.workspaceURL ||
        !!createWorkspaceMutation.data?.createdWorkspaceId;

    const [useLatestIde, setUseLatestIde] = useState(
        props.ideSettings?.useLatestVersion !== undefined
            ? props.ideSettings.useLatestVersion
            : !!user?.additionalData?.ideSettings?.useLatestVersion,
    );
    const [selectedIde, setSelectedIde] = useState(
        props.ideSettings?.defaultIde !== undefined
            ? props.ideSettings.defaultIde
            : user?.additionalData?.ideSettings?.defaultIde,
    );
    const [selectedWsClass, setSelectedWsClass] = useState<string | undefined>(props.workspaceClass);
    const [errorWsClass, setErrorWsClass] = useState<string | undefined>(undefined);
    const [contextURL, setContextURL] = useState<string | undefined>(
        StartWorkspaceOptions.parseContextUrl(location.hash),
    );
    const workspaceContext = useWorkspaceContext(contextURL);
    const isLoading = workspaceContext.isLoading || projects.isLoading;

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

    useEffect(() => {
        if (!project || props.workspaceClass) {
            return;
        }
        const wsClass = project.settings?.workspaceClasses;
        if (wsClass?.regular) {
            setSelectedWsClass(wsClass?.regular);
        }
    }, [project, props.workspaceClass]);

    const onSelectEditorChange = useCallback(
        (ide: string, useLatest: boolean) => {
            setSelectedIde(ide);
            setUseLatestIde(useLatest);
        },
        [setSelectedIde, setUseLatestIde],
    );
    const [errorIde, setErrorIde] = useState<string | undefined>(undefined);

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
        async (options?: Omit<GitpodServer.CreateWorkspaceOptions, "contextUrl">) => {
            // add options from search params
            const opts = options || {};

            // we already have shown running workspaces to the user
            opts.ignoreRunningWorkspaceOnSameCommit = true;

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
            if (!organizationId && !!user?.additionalData?.isMigratedToTeamOnlyAttribution) {
                // We need an organizationId for this group of users
                console.warn("Skipping createWorkspace");
                return;
            }

            try {
                if (createWorkspaceMutation.isLoading || createWorkspaceMutation.isSuccess) {
                    console.log("Skipping duplicate createWorkspace call.");
                    return;
                }
                const result = await createWorkspaceMutation.mutateAsync({
                    contextUrl: contextURL,
                    organizationId,
                    ...opts,
                });
                if (result.workspaceURL) {
                    window.location.href = result.workspaceURL;
                } else if (result.createdWorkspaceId) {
                    history.push(`/start/#${result.createdWorkspaceId}`);
                }
            } catch (error) {
                console.log(error);
            }
        },
        [
            createWorkspaceMutation,
            history,
            contextURL,
            selectedIde,
            selectedWsClass,
            currentOrg?.id,
            user?.additionalData?.isMigratedToTeamOnlyAttribution,
            useLatestIde,
        ],
    );

    // Need a wrapper here so we call createWorkspace w/o any arguments
    const onClickCreate = useCallback(() => createWorkspace(), [createWorkspace]);

    // if the context URL has a referrer prefix, we set the referrerIde as the selected IDE and immediately start a workspace.
    useEffect(() => {
        if (workspaceContext.data && WithReferrerContext.is(workspaceContext.data)) {
            let options: Omit<GitpodServer.CreateWorkspaceOptions, "contextUrl"> | undefined;
            if (workspaceContext.data.referrerIde) {
                setSelectedIde(workspaceContext.data.referrerIde);
                options = {
                    ideSettings: {
                        defaultIde: workspaceContext.data.referrerIde,
                    },
                };
            }
            createWorkspace(options);
        }
    }, [workspaceContext.data, createWorkspace]);

    if (SelectAccountPayload.is(selectAccountError)) {
        return (
            <SelectAccountModal
                {...selectAccountError}
                close={() => {
                    window.location.href = gitpodHostUrl.asAccessControl().toString();
                }}
            />
        );
    }

    return (
        <div className="flex flex-col mt-32 mx-auto ">
            <div className="flex flex-col max-h-screen max-w-lg mx-auto items-center w-full">
                <Heading1>New Workspace</Heading1>
                <div className="text-gray-500 text-center text-base">
                    Start a new workspace with the following options.
                </div>
                <div className="-mx-6 px-6 mt-6 w-full">
                    <div className="pt-3">
                        {workspaceContext.error && (
                            <div className="text-red-500 text-sm">
                                {workspaceContext.error.message} URL was: {contextURL}
                            </div>
                        )}
                        <RepositoryFinder setSelection={setContextURL} initialValue={contextURL} />
                    </div>
                    <div className="pt-3">
                        {errorIde && <div className="text-red-500 text-sm">{errorIde}</div>}
                        <SelectIDEComponent
                            onSelectionChange={onSelectEditorChange}
                            setError={setErrorIde}
                            selectedIdeOption={selectedIde}
                            useLatest={useLatestIde}
                        />
                    </div>
                    <div className="pt-3">
                        {errorWsClass && <div className="text-red-500 text-sm">{errorWsClass}</div>}
                        <SelectWorkspaceClassComponent
                            onSelectionChange={setSelectedWsClass}
                            setError={setErrorWsClass}
                            selectedWorkspaceClass={selectedWsClass}
                        />
                    </div>
                </div>
                <div className="w-full flex justify-end mt-6 space-x-2 px-6">
                    <Button
                        onClick={onClickCreate}
                        autoFocus={true}
                        loading={isStarting || isLoading}
                        disabled={
                            !contextURL ||
                            contextURL.length === 0 ||
                            !!errorIde ||
                            !!errorWsClass ||
                            !!workspaceContext.error
                        }
                    >
                        {isLoading ? "Loading ..." : isStarting ? "Creating Workspace ..." : "New Workspace"}
                    </Button>
                </div>
                {existingWorkspaces.length > 0 && (
                    <div className="w-full flex flex-col justify-end px-6">
                        <p className="mt-6 text-center text-base">Running workspaces on this revision</p>
                        <>
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
                        </>
                    </div>
                )}
                <div>
                    <StatusMessage
                        error={createWorkspaceMutation.error as StartWorkspaceError}
                        setSelectAccountError={setSelectAccountError}
                        reset={() => {
                            createWorkspaceMutation.reset();
                        }}
                        createWorkspace={createWorkspace}
                    />
                </div>
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

interface StatusMessageProps {
    error?: StartWorkspaceError;
    reset: () => void;
    setSelectAccountError: (error?: SelectAccountPayload) => void;
    createWorkspace: (opts: Omit<GitpodServer.CreateWorkspaceOptions, "contextUrl">) => void;
}
const StatusMessage: FunctionComponent<StatusMessageProps> = ({
    error,
    reset,
    setSelectAccountError,
    createWorkspace,
}) => {
    if (!error) {
        return <></>;
    }
    switch (error.code) {
        case ErrorCodes.CONTEXT_PARSE_ERROR:
            return (
                <div className="text-center">
                    <p className="text-base mt-2">
                        Are you trying to open a Git repository from a self-managed git hoster?{" "}
                        <a className="text-blue" href={gitpodHostUrl.asAccessControl().toString()}>
                            Add integration
                        </a>
                    </p>
                </div>
            );
        case ErrorCodes.INVALID_GITPOD_YML:
            return (
                <div className="mt-2 flex flex-col space-y-8">
                    <button
                        className=""
                        onClick={() => {
                            createWorkspace({ forceDefaultConfig: true });
                        }}
                    >
                        Continue with default configuration
                    </button>
                </div>
            );
        case ErrorCodes.NOT_AUTHENTICATED:
            return (
                <div className="mt-2 flex flex-col space-y-8">
                    <button
                        className=""
                        onClick={() => {
                            tryAuthorize(error?.data.host, error?.data.scopes).then((payload) =>
                                setSelectAccountError(payload),
                            );
                        }}
                    >
                        Authorize with {error.data.host}
                    </button>
                </div>
            );
        case ErrorCodes.PERMISSION_DENIED:
            return <p className="text-base text-gitpod-red w-96">Access is not allowed</p>;
        case ErrorCodes.USER_BLOCKED:
            window.location.href = "/blocked";
            return <></>;
        case ErrorCodes.NOT_FOUND:
            return <p className="text-base text-gitpod-red w-96">{error.message}</p>;
        case ErrorCodes.TOO_MANY_RUNNING_WORKSPACES:
            return <LimitReachedParallelWorkspacesModal />;
        case ErrorCodes.NOT_ENOUGH_CREDIT:
            return <LimitReachedOutOfHours />;
        case ErrorCodes.INVALID_COST_CENTER:
            return (
                <div>
                    <p className="text-base text-gitpod-red w-96">
                        The organization <b>{error.data}</b> is not valid.
                    </p>
                </div>
            );
        case ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED:
            return <UsageLimitReachedModal onClose={reset} hints={error?.data} />;
        case ErrorCodes.PROJECT_REQUIRED:
            return (
                <p className="text-base text-gitpod-red w-96">
                    <a className="gp-link" href="https://www.gitpod.io/docs/configure/projects">
                        Learn more about projects
                    </a>
                </p>
            );
        default:
            return <p className="text-base text-gitpod-red w-96">Unknown Error: {JSON.stringify(error, null, 2)}</p>;
    }
};
