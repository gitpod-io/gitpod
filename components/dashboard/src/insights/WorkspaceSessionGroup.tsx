/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Timestamp } from "@bufbuild/protobuf";
import { OrganizationMember } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { WorkspaceSpec_WorkspaceType } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { AccordionContent, AccordionItem, AccordionTrigger } from "../components/accordion/Accordion";
import { ReactComponent as UsageIcon } from "../images/usage-default.svg";
import { toRemoteURL } from "../projects/render-utils";
import { DisplayName } from "../usage/UsageEntry";
import { WorkspaceSessionEntry } from "./WorkspaceSession";

type Props = {
    id: string;
    sessions: any[];
    member?: OrganizationMember;
};
export const WorkspaceSessionGroup = ({ id, sessions, member }: Props) => {
    if (!sessions?.length) {
        return null;
    }
    const workspace = sessions[0].workspace!;

    return (
        <AccordionItem key={id} value={id}>
            <div className="w-full p-3 grid grid-cols-12 gap-x-3 justify-between transition ease-in-out rounded-xl">
                <div className="flex flex-col col-span-2 my-auto">
                    <span className="text-gray-600 dark:text-gray-100 text-md font-medium">
                        {getType(workspace.spec?.type)}
                    </span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                        {workspace.spec?.class ? <DisplayName workspaceClass={workspace?.spec?.class} /> : "n/a"}
                    </span>
                </div>
                <div className="flex flex-col col-span-5 my-auto">
                    <div className="flex">
                        <span className="truncate text-gray-600 dark:text-gray-100 text-md font-medium">
                            {workspace.id}
                        </span>
                    </div>
                    <span className="text-sm truncate text-gray-400 dark:text-gray-500">
                        {workspace.metadata?.originalContextUrl && toRemoteURL(workspace.metadata?.originalContextUrl)}
                    </span>
                </div>
                <div className="flex flex-col col-span-3 my-auto">
                    <span className="text-right text-gray-500 dark:text-gray-400 font-medium">
                        {workspace.spec?.type === WorkspaceSpec_WorkspaceType.PREBUILD ? (
                            <>
                                <UsageIcon className="my-auto w-4 h-4 mr-1" />
                                <span className="text-sm text-gray-400 dark:text-gray-500">Gitpod</span>
                            </>
                        ) : (
                            <div className="flex">
                                <img
                                    className="my-auto rounded-full w-4 h-4 inline-block align-text-bottom mr-1 overflow-hidden"
                                    src={member?.avatarUrl ?? ""}
                                    alt=""
                                />
                                <span className="text-sm text-gray-400 dark:text-gray-500">{member?.fullName}</span>
                            </div>
                        )}
                    </span>
                </div>
                <AccordionTrigger className="w-full">
                    <div className="flex flex-col col-span-2 my-auto">
                        <span className="text-gray-400 dark:text-gray-500 truncate font-medium">{sessions.length}</span>
                    </div>
                </AccordionTrigger>
            </div>
            <AccordionContent>
                <div className="px-3 py-2 space-y-2">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Workspace starts:</h4>
                    <ul className="space-y-1">
                        {sessions.map((session, index) => (
                            <WorkspaceSessionEntry key={session.id || index} session={session} index={index} />
                        ))}
                    </ul>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

const getType = (type?: WorkspaceSpec_WorkspaceType) => {
    switch (type) {
        case WorkspaceSpec_WorkspaceType.PREBUILD:
            return "Prebuild";
        case WorkspaceSpec_WorkspaceType.REGULAR:
            return "Workspace";
        default:
            return "Unknown";
    }
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
