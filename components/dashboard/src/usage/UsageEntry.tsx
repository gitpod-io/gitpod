/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceType } from "@gitpod/gitpod-protocol";
import { Usage, WorkspaceInstanceUsageData } from "@gitpod/gitpod-protocol/lib/usage";
import { FC } from "react";
import { useWorkspaceClasses } from "../data/workspaces/workspace-classes-query";
import { ReactComponent as UsageIcon } from "../images/usage-default.svg";
import { toRemoteURL } from "../projects/render-utils";
// TODO: shift these into a DatePicker component that wraps react-datepicker
import "react-datepicker/dist/react-datepicker.css";
import "../components/react-datepicker.css";

type Props = {
    usage: Usage;
};
export const UsageEntry: FC<Props> = ({ usage }) => {
    // We shouldn't be delivering these to the client, but just in case, don't try to render them
    if (usage.kind !== "workspaceinstance") {
        return null;
    }

    const metadata = usage.metadata as WorkspaceInstanceUsageData;

    return (
        <div
            key={usage.workspaceInstanceId}
            className="flex p-3 grid grid-cols-12 gap-x-3 justify-between transition ease-in-out rounded-xl"
        >
            <div className="flex flex-col col-span-2 my-auto">
                <span className="text-gray-600 dark:text-gray-100 text-md font-medium">
                    {getType(metadata.workspaceType)}
                </span>
                <span className="text-sm text-gray-400 dark:text-gray-500">
                    <DisplayName workspaceClass={metadata.workspaceClass} />
                </span>
            </div>
            <div className="flex flex-col col-span-5 my-auto">
                <div className="flex">
                    {isRunning(usage) && (
                        <div
                            className="rounded-full w-2 h-2 text-sm align-middle bg-green-500 my-auto mx-1"
                            title="Still running"
                        />
                    )}
                    <span className="truncate text-gray-600 dark:text-gray-100 text-md font-medium">
                        {metadata.workspaceId}
                    </span>
                </div>
                <span className="text-sm truncate text-gray-400 dark:text-gray-500">
                    {metadata.contextURL && toRemoteURL(metadata.contextURL)}
                </span>
            </div>
            <div className="flex flex-col my-auto">
                <span className="text-right text-gray-500 dark:text-gray-400 font-medium">{usage.credits}</span>
                <span className="text-right text-sm text-gray-400 dark:text-gray-500">{getMinutes(usage)}</span>
            </div>
            <div className="my-auto" />
            <div className="flex flex-col col-span-3 my-auto">
                <span className="text-gray-400 dark:text-gray-500 truncate font-medium">
                    {displayTime(usage.effectiveTime!)}
                </span>
                <div className="flex">
                    {metadata.workspaceType === "prebuild" ? <UsageIcon className="my-auto w-4 h-4 mr-1" /> : ""}
                    {metadata.workspaceType === "prebuild" ? (
                        <span className="text-sm text-gray-400 dark:text-gray-500">Gitpod</span>
                    ) : (
                        <div className="flex">
                            <img
                                className="my-auto rounded-full w-4 h-4 inline-block align-text-bottom mr-1 overflow-hidden"
                                src={metadata.userAvatarURL || ""}
                                alt="user avatar"
                            />
                            <span className="text-sm text-gray-400 dark:text-gray-500">{metadata.userName || ""}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const DisplayName: FC<{ workspaceClass: string }> = ({ workspaceClass }) => {
    const supportedClasses = useWorkspaceClasses();

    const workspaceDisplayName = supportedClasses.data?.find((wc) => wc.id === workspaceClass)?.displayName;

    return <span>{workspaceDisplayName || workspaceClass}</span>;
};

const getType = (type: WorkspaceType) => {
    if (type === "regular") {
        return "Workspace";
    }
    return "Prebuild";
};

const isRunning = (usage: Usage) => {
    if (usage.kind !== "workspaceinstance") {
        return false;
    }
    const metaData = usage.metadata as WorkspaceInstanceUsageData;
    return metaData.endTime === "" || metaData.endTime === undefined;
};

const getMinutes = (usage: Usage) => {
    if (usage.kind !== "workspaceinstance") {
        return "";
    }
    const metaData = usage.metadata as WorkspaceInstanceUsageData;
    const end = metaData.endTime ? new Date(metaData.endTime).getTime() : Date.now();
    const start = new Date(metaData.startTime).getTime();
    const lengthOfUsage = Math.floor(end - start);
    const inMinutes = (lengthOfUsage / (1000 * 60)).toFixed(1);
    return inMinutes + " min";
};

export const displayTime = (time: string | number) => {
    const options: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
    };
    return new Date(time).toLocaleDateString(undefined, options).replace("at ", "");
};
