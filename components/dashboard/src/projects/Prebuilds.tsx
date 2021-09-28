/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrebuiltWorkspaceState, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import Spinner from "../icons/Spinner.svg";
import StatusDone from "../icons/StatusDone.svg";
import StatusFailed from "../icons/StatusFailed.svg";
import StatusPaused from "../icons/StatusPaused.svg";
import StatusRunning from "../icons/StatusRunning.svg";


export function prebuildStatusLabel(status: PrebuiltWorkspaceState | undefined) {
    switch (status) {
        case "aborted":
            return (<span className="font-medium text-red-500 uppercase">failed</span>);
        case "available":
            return (<span className="font-medium text-green-500 uppercase">ready</span>);
        case "building":
            return (<span className="font-medium text-blue-500 uppercase">running</span>);
        case "queued":
            return (<span className="font-medium text-orange-500 uppercase">pending</span>);
        default:
            break;
    }
}

export function prebuildStatusIcon(status: PrebuiltWorkspaceState | undefined) {
    switch (status) {
        case "aborted":
            return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16ZM6.70711 5.29289C6.31658 4.90237 5.68342 4.90237 5.29289 5.29289C4.90237 5.68342 4.90237 6.31658 5.29289 6.70711L6.58579 8L5.29289 9.29289C4.90237 9.68342 4.90237 10.3166 5.29289 10.7071C5.68342 11.0976 6.31658 11.0976 6.70711 10.7071L8 9.41421L9.29289 10.7071C9.68342 11.0976 10.3166 11.0976 10.7071 10.7071C11.0976 10.3166 11.0976 9.68342 10.7071 9.29289L9.41421 8L10.7071 6.70711C11.0976 6.31658 11.0976 5.68342 10.7071 5.29289C10.3166 4.90237 9.68342 4.90237 9.29289 5.29289L8 6.58579L6.70711 5.29289Z" fill="#F87171" />
            </svg>)
        case "available":
            return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16ZM11.7071 6.70711C12.0976 6.31658 12.0976 5.68342 11.7071 5.29289C11.3166 4.90237 10.6834 4.90237 10.2929 5.29289L7 8.58578L5.7071 7.29289C5.31658 6.90237 4.68342 6.90237 4.29289 7.29289C3.90237 7.68342 3.90237 8.31658 4.29289 8.70711L6.29289 10.7071C6.68342 11.0976 7.31658 11.0976 7.7071 10.7071L11.7071 6.70711Z" fill="#84CC16" />
            </svg>);
        case "building":
            return (<svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8.99609 16C13.4144 16 16.9961 12.4183 16.9961 8C16.9961 3.58172 13.4144 0 8.99609 0C4.57781 0 0.996094 3.58172 0.996094 8C0.996094 12.4183 4.57781 16 8.99609 16ZM9.99609 4C9.99609 3.44772 9.54837 3 8.99609 3C8.4438 3 7.99609 3.44772 7.99609 4V8C7.99609 8.26522 8.10144 8.51957 8.28898 8.70711L11.1174 11.5355C11.5079 11.9261 12.1411 11.9261 12.5316 11.5355C12.9221 11.145 12.9221 10.5118 12.5316 10.1213L9.99609 7.58579V4Z" fill="#60A5FA" />
            </svg>);
        case "queued":
            return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM5 6C5 5.44772 5.44772 5 6 5C6.55228 5 7 5.44772 7 6V10C7 10.5523 6.55228 11 6 11C5.44772 11 5 10.5523 5 10V6ZM10 5C9.44771 5 9 5.44772 9 6V10C9 10.5523 9.44771 11 10 11C10.5523 11 11 10.5523 11 10V6C11 5.44772 10.5523 5 10 5Z" fill="#FBBF24" />
            </svg>);
        default:
            break;
    }
}

export function PrebuildInstanceStatus(props: { prebuildInstance?: WorkspaceInstance }) {
    let status = <></>;
    let details = <></>;
    switch (props.prebuildInstance?.status.phase) {
        case undefined: // Fall through
        case 'unknown':
            status = <div className="flex space-x-1 items-center text-yellow-600">
                <img className="h-4 w-4" src={StatusPaused} />
                <span>PENDING</span>
                </div>;
            details = <div className="flex space-x-1 items-center text-gray-400">
                <img className="h-4 w-4 animate-spin" src={Spinner} />
                <span>Prebuild in progress ...</span>
                </div>;
            break;
        case 'preparing': // Fall through
        case 'pending': // Fall through
        case 'creating': // Fall through
        case 'initializing': // Fall  through
        case 'running': // Fall through
        case 'interrupted':
            status = <div className="flex space-x-1 items-center text-blue-600">
                <img className="h-4 w-4" src={StatusRunning} />
                <span>RUNNING</span>
                </div>;
            details = <div className="flex space-x-1 items-center text-gray-400">
                <img className="h-4 w-4 animate-spin" src={Spinner} />
                <span>Prebuild in progress ...</span>
                </div>;
            break;
        case 'stopping': // Fall through
        case 'stopped':
            status = <div className="flex space-x-1 items-center text-green-600">
                <img className="h-4 w-4" src={StatusDone} />
                <span>READY</span>
                </div>;
            details = <div className="flex space-x-1 items-center text-gray-400">
                <img className="h-4 w-4 filter-grayscale" src={StatusRunning} />
                <span>{!!props.prebuildInstance?.stoppedTime
                    ? `${Math.round(((new Date(props.prebuildInstance.stoppedTime).getTime()) - (new Date(props.prebuildInstance.creationTime).getTime())) / 1000)}s`
                    : '...'}</span>
                </div>;
            break;
    }
    if (props.prebuildInstance?.status.conditions.failed) {
        status = <div className="flex space-x-1 items-center text-gitpod-red">
            <img className="h-4 w-4" src={StatusFailed} />
            <span>FAILED</span>
            </div>;
        details = <div className="flex space-x-1 items-center text-gray-400">
            <span>Prebuild failed</span>
            </div>;
    }
    return <div className="flex flex-col space-y-1 justify-center text-sm font-semibold">
        <div>{status}</div>
        <div>{details}</div>
    </div>;
}