/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export interface WorkspaceClassProps {
    selected: boolean;
    additionalStyles?: string;
    onClick: () => void;
    children?: React.ReactNode;
    category: string;
    friendlyName: string;
    description?: string;
    powerUps?: number;
}

function WorkspaceClass(props: WorkspaceClassProps) {
    return (
        <div
            className={`rounded-xl px-3 py-3 flex flex-col cursor-pointer group transition ease-in-out ${
                props.selected
                    ? "bg-gray-800 dark:bg-gray-100"
                    : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            } ${props.additionalStyles || ""}`}
            onClick={props.onClick}
        >
            <div className="flex items-center">
                <p
                    className={`w-full pl-1 text-sm font-normal truncate ${
                        props.selected ? "text-gray-400 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"
                    }`}
                    title={props.category}
                >
                    {props.category}
                </p>
                <input className="opacity-0" type="radio" checked={props.selected} />
            </div>
            <div className="pl-1 grid auto-rows-auto">
                <div
                    className={`text-xl font-semibold mt-1 mb-4 ${
                        props.selected ? "text-gray-100 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"
                    }`}
                >
                    {props.friendlyName}
                </div>
                <div
                    className={`text-sm font-normal truncate w-full ${
                        props.selected ? "text-gray-300 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"
                    }`}
                >
                    {props.description}
                </div>
                <div className="text-xl font-semibold mt-1 mb-4">
                    <svg viewBox="0 -4 50 50" xmlns="http://www.w3.org/2000/svg">
                        {Array.from(Array(props.powerUps).keys()).map((i) => {
                            return <ellipse cx={0.8 + i * 2.5} cy="-3" rx="0.8" ry="0.8" style={{ fill: "#FFB45B" }} />;
                        })}
                    </svg>
                </div>
            </div>
        </div>
    );
}

export default WorkspaceClass;
