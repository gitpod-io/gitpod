/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Timestamp } from "@bufbuild/protobuf";
import { WorkspaceSession, WorkspaceSpec_WorkspaceType } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { AccordionContent, AccordionItem, AccordionTrigger } from "../components/accordion/Accordion";
import { ReactComponent as UsageIcon } from "../images/usage-default.svg";
import { toRemoteURL } from "../projects/render-utils";
import { DisplayName } from "../usage/UsageEntry";
import { WorkspaceSessionEntry } from "./WorkspaceSession";
import { displayWorkspaceType } from "./download/download-sessions";

type Props = {
    id: string;
    sessions: WorkspaceSession[];
};
export const WorkspaceSessionGroup = ({ id, sessions }: Props) => {
    if (!sessions?.length) {
        return null;
    }
    const { workspace, owner } = sessions[0];

    return (
        <AccordionItem key={id} value={id}>
            <div className="w-full p-3 grid grid-cols-12 gap-x-3 justify-between transition ease-in-out rounded-xl">
                <div className="flex flex-col col-span-2 my-auto">
                    <span className="text-pk-content-primary text-md font-medium capitalize">
                        {displayWorkspaceType(workspace?.spec?.type)}
                    </span>
                    <span className="text-sm text-pk-content-tertiary">
                        {workspace?.spec?.class ? <DisplayName workspaceClass={workspace?.spec?.class} /> : "n/a"}
                    </span>
                </div>
                <div className="flex flex-col col-span-5 my-auto">
                    <div className="flex">
                        <span className="truncate text-pk-content-primary text-md font-medium">{workspace?.id}</span>
                    </div>
                    <span className="text-sm truncate text-pk-content-secondary">
                        {workspace?.metadata?.originalContextUrl && toRemoteURL(workspace.metadata.originalContextUrl)}
                    </span>
                </div>
                <div className="flex flex-col col-span-3 my-auto">
                    <span className="text-right text-pk-content-secondary font-medium">
                        {workspace?.spec?.type === WorkspaceSpec_WorkspaceType.PREBUILD ? (
                            <div className="flex">
                                <UsageIcon className="my-auto w-4 h-4 mr-1" />
                                <span className="text-sm">Gitpod</span>
                            </div>
                        ) : (
                            <div className="flex">
                                <img
                                    className="my-auto rounded-full w-4 h-4 inline-block align-text-bottom mr-1 overflow-hidden"
                                    src={owner?.avatarUrl ?? ""}
                                    alt=""
                                />
                                <span className="text-sm">{owner?.name}</span>
                            </div>
                        )}
                    </span>
                </div>
                <div className="flex flex-col col-span-2 my-auto">
                    <AccordionTrigger className="w-full">
                        <span className="text-pk-content-primary truncate font-medium">{sessions.length}</span>
                    </AccordionTrigger>
                </div>
            </div>
            <AccordionContent>
                <div className="px-3 py-2 space-y-2">
                    <h4 className="text-sm font-medium text-pk-content-primary">Workspace starts:</h4>
                    <ul className="space-y-1">
                        {sessions.map((session) => (
                            <WorkspaceSessionEntry key={session.id} session={session} />
                        ))}
                    </ul>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

export const displayTime = (time: Timestamp) => {
    const options: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
    };

    return time.toDate().toLocaleDateString(undefined, options).replace("at ", "");
};
