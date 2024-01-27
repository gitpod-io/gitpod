/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ReactComponent as Spinner } from "../icons/Spinner.svg";

export function SpinnerLoader(props: { content?: string; small?: boolean }) {
    return (
        <div
            className={`flex items-center justify-center space-x-2 text-gray-400 text-sm ${
                props.small ? "" : "pt-16 pb-40"
            }`}
        >
            <Spinner className="h-4 w-4 animate-spin" />
            {props.content && <span>{props.content}</span>}
        </div>
    );
}

interface SpinnerContentProps {
    loading?: boolean;
    content?: string;
    children: React.ReactChild[] | React.ReactChild | React.ReactNode;
}
export function SpinnerOverlayLoader(props: SpinnerContentProps) {
    return (
        <div className="relative">
            {props.loading && (
                <div className="absolute h-full w-full">
                    <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm h-full">
                        <Spinner className="h-4 w-4 animate-spin" />
                        {props.content && <span>{props.content}</span>}
                    </div>
                </div>
            )}
            <div className={props.loading ? "opacity-40 select-none pointer-events-none" : ""}>{props.children}</div>
        </div>
    );
}
