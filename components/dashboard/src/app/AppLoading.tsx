/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useEffect, useState } from "react";
import gitpodIcon from "../icons/gitpod.svg";
import { Delayed } from "../components/Delayed";

function useDelay(wait: number) {
    const [done, setDone] = useState(false);
    useEffect(() => {
        const timeout = setTimeout(() => setDone(true), wait);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wait]);
    return done;
}

export const AppLoading: FunctionComponent = () => {
    const done = useDelay(8000);
    const connectionProblems = useDelay(25000);
    return (
        <Delayed wait={3000}>
            <div className="flex flex-col justify-center items-center w-full h-screen space-y-4 bg-gray-100 dark:bg-gray-900">
                <img
                    src={gitpodIcon}
                    alt="Gitpod's logo"
                    className={"h-8 flex-shrink-0 animate-fade-in filter-grayscale"}
                />
                {connectionProblems ? (
                    <p className={done ? "" : "invisible"}>
                        <span className="text-gray-600 dark:text-gray-300 font-semibold text-md">
                            <span className="text-gitpod-red">[ERROR]</span> Could not load dashboard
                        </span>
                    </p>
                ) : (
                    <p className={done ? "animate-fade-in" : "invisible"}>
                        <span className="text-gray-500 dark:text-gray-300 font-semibold text-md">
                            Loading dashboard...
                        </span>
                    </p>
                )}
                {connectionProblems ? (
                    <p className={done ? "max-w-xl text-center" : "invisible"}>
                        <span className="text-gray-400 dark:text-gray-500">
                            Check your network connection or try restarting your browser.
                        </span>
                    </p>
                ) : (
                    <p className={done ? "animate-fade-in" : "invisible"}>
                        <span className="text-gray-400 dark:text-gray-500">
                            This is taking longer than it expected.
                        </span>
                    </p>
                )}
            </div>
        </Delayed>
    );
};
