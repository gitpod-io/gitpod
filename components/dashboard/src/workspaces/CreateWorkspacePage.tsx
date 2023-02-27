/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContextURL, GitpodServer, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { FunctionComponent, useCallback, useState } from "react";
import { useHistory, useLocation } from "react-router";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import RepositoryFinder from "../components/RepositoryFinder";
import SelectIDEComponent from "../components/SelectIDEComponent";
import SelectWorkspaceClassComponent from "../components/SelectWorkspaceClassComponent";
import { UsageLimitReachedModal } from "../components/UsageLimitReachedModal";
import { openAuthorizeWindow } from "../provider-utils";
import { gitpodHostUrl } from "../service/service";
import { LimitReachedOutOfHours, LimitReachedParallelWorkspacesModal } from "../start/CreateWorkspace";
import { StartWorkspaceOptions } from "../start/start-workspace-options";
import { StartWorkspaceError } from "../start/StartPage";
import { useCurrentUser } from "../user-context";
import { SelectAccountModal } from "../user-settings/SelectAccountModal";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { useCurrentTeam } from "../teams/teams-context";
import { useCreateWorkspaceMutation } from "../data/workspaces/create-workspace-mutation";
import { Button } from "../components/Button";

export const useNewCreateWorkspacePage = () => {
    const { startWithOptions } = useFeatureFlags();
    const user = useCurrentUser();
    return !!startWithOptions || !!user?.additionalData?.isMigratedToTeamOnlyAttribution;
};

export function CreateWorkspacePage() {
    const user = useCurrentUser();
    const team = useCurrentTeam();
    const location = useLocation();
    const history = useHistory();
    const props = StartWorkspaceOptions.parseSearchParams(location.search);
    const createWorkspaceMutation = useCreateWorkspaceMutation();

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
    const [repo, setRepo] = useState<string | undefined>(location.hash.substring(1));
    const onSelectEditorChange = useCallback(
        (ide: string, useLatest: boolean) => {
            setSelectedIde(ide);
            setUseLatestIde(useLatest);
        },
        [setSelectedIde, setUseLatestIde],
    );
    const [errorIde, setErrorIde] = useState<string | undefined>(undefined);

    const [existingWorkspaces, setExistingWorkspaces] = useState<WorkspaceInfo[]>([]);
    const [selectAccountError, setSelectAccountError] = useState<SelectAccountPayload | undefined>(undefined);

    const createWorkspace = useCallback(
        async (options?: Omit<GitpodServer.CreateWorkspaceOptions, "contextUrl">) => {
            // add options from search params
            const opts = options || {};

            if (!opts.workspaceClass) {
                opts.workspaceClass = selectedWsClass;
            }
            if (!opts.ideSettings) {
                opts.ideSettings = {
                    defaultIde: selectedIde,
                    useLatestVersion: useLatestIde,
                };
            }
            if (!repo) {
                return;
            }

            try {
                const result = await createWorkspaceMutation.mutateAsync({
                    contextUrl: repo,
                    organizationId: team?.id,
                    ...opts,
                });
                if (result.workspaceURL) {
                    window.location.href = result.workspaceURL;
                } else if (result.createdWorkspaceId) {
                    history.push(`/start/${result.createdWorkspaceId}`);
                } else if (result.existingWorkspaces && result.existingWorkspaces.length > 0) {
                    setExistingWorkspaces(result.existingWorkspaces);
                }
            } catch (error) {
                console.log(error);
            }
        },
        [createWorkspaceMutation, history, repo, selectedIde, selectedWsClass, team?.id, useLatestIde],
    );

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
                <h1>New Workspace</h1>
                <div className="text-gray-500 text-center text-base">
                    Start a new workspace with the following options.
                </div>
                <div className="-mx-6 px-6 mt-6 w-full">
                    <div className="pt-3">
                        <RepositoryFinder setSelection={setRepo} initialValue={repo} />
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
                        onClick={createWorkspace}
                        loading={createWorkspaceMutation.isLoading}
                        disabled={!repo || repo.length === 0 || !!errorIde || !!errorWsClass}
                    >
                        {createWorkspaceMutation.isLoading ? "Creating Workspace ..." : "New Workspace"}
                    </Button>
                </div>
                <div>
                    <StatusMessage
                        error={createWorkspaceMutation.error as StartWorkspaceError}
                        setSelectAccountError={setSelectAccountError}
                        createWorkspace={createWorkspace}
                    />
                </div>
            </div>
            {existingWorkspaces.length > 0 && (
                <ExistingWorkspaceModal
                    existingWorkspaces={existingWorkspaces}
                    createWorkspace={createWorkspace}
                    onClose={() => setExistingWorkspaces([])}
                />
            )}
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
    setSelectAccountError: (error?: SelectAccountPayload) => void;
    createWorkspace: (opts: Omit<GitpodServer.CreateWorkspaceOptions, "contextUrl">) => void;
}
const StatusMessage: FunctionComponent<StatusMessageProps> = ({ error, setSelectAccountError, createWorkspace }) => {
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
            return <UsageLimitReachedModal hints={error?.data} />;
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

interface ExistingWorkspaceModalProps {
    existingWorkspaces: WorkspaceInfo[];
    onClose: () => void;
    createWorkspace: (opts: Omit<GitpodServer.CreateWorkspaceOptions, "contextUrl">) => void;
}

const ExistingWorkspaceModal: FunctionComponent<ExistingWorkspaceModalProps> = ({
    existingWorkspaces,
    onClose,
    createWorkspace,
}) => {
    return (
        <Modal visible={true} closeable={true} onClose={onClose}>
            <ModalHeader>Running Workspaces</ModalHeader>
            <ModalBody>
                <p className="mt-1 mb-2 text-base">
                    You already have running workspaces with the same context. You can open an existing one or open a
                    new workspace.
                </p>
                <>
                    {existingWorkspaces.map((w) => {
                        const normalizedContextUrl =
                            ContextURL.getNormalizedURL(w.workspace)?.toString() || "undefined";
                        return (
                            <a
                                key={w.workspace.id}
                                href={w.latestInstance?.ideUrl || `/start/${w.workspace.id}}`}
                                className="rounded-xl group hover:bg-gray-100 dark:hover:bg-gray-800 flex p-3 my-1"
                            >
                                <div className="w-full">
                                    <p className="text-base text-black dark:text-gray-100 font-bold">
                                        {w.workspace.id}
                                    </p>
                                    <p className="truncate" title={normalizedContextUrl}>
                                        {normalizedContextUrl}
                                    </p>
                                </div>
                            </a>
                        );
                    })}
                </>
            </ModalBody>
            <ModalFooter>
                <button className="secondary" onClick={onClose}>
                    Cancel
                </button>
                <button onClick={() => createWorkspace({ ignoreRunningWorkspaceOnSameCommit: true })}>
                    New Workspace
                </button>
            </ModalFooter>
        </Modal>
    );
};
