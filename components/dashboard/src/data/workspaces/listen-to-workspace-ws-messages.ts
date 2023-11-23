/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Disposable } from "@gitpod/gitpod-protocol";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { stream, workspaceClient } from "../../service/public-api";
import {
    WatchWorkspaceStatusRequest,
    WatchWorkspaceStatusResponse,
    Workspace,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

export const useListenToWorkspacesWSMessages = () => {
    const queryClient = useQueryClient();
    const organizationId = useCurrentOrg().data?.id;

    useEffect(() => {
        const disposable = watchWorkspaceStatus(undefined, (status) => {
            const queryKey = getListWorkspacesQueryKey(organizationId);
            let foundWorkspaces = false;

            // Update the workspace with the latest instance
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.map((info) => {
                    if (info.id !== status.workspaceId) {
                        return info;
                    }
                    foundWorkspaces = true;
                    const workspace = new Workspace(info);
                    workspace.status = status.status;
                    info.status = status.status;
                    return workspace;
                });
            });

            if (!foundWorkspaces) {
                // If the instance was for a workspace we don't have, it should get returned w/ an updated query
                queryClient.invalidateQueries({ queryKey });
            }
        });

        return () => {
            disposable.dispose();
        };
    }, [organizationId, queryClient]);
};

export function watchWorkspaceStatus(
    workspaceId: string | undefined,
    cb: (response: WatchWorkspaceStatusResponse) => void,
): Disposable {
    return stream<WatchWorkspaceStatusRequest>(
        (options) => workspaceClient.watchWorkspaceStatus({ workspaceId }, options),
        cb,
    );
}
