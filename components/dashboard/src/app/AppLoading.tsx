/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useEffect, useState } from "react";
import { Heading3, Subheading } from "../components/typography/headings";
import { Delayed } from "@podkit/loading/Delayed";
import { ProductLogo } from "../components/ProductLogo";

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
            <div className="flex flex-col justify-center items-center w-full h-screen space-y-4">
                <ProductLogo className={"h-16 flex-shrink-0 animate-fade-in"} />
                {connectionProblems ? (
                    <Heading3 className={done ? "" : "invisible"}>This is taking longer than it should</Heading3>
                ) : (
                    <Heading3 className={done ? "animate-fade-in" : "invisible"}>
                        Just getting a few more things ready
                    </Heading3>
                )}
                {connectionProblems ? (
                    <Subheading className={done ? "max-w-xl text-center" : "invisible"}>
                        It seems like you are having connection issues. Please check your network connection. Sometimes
                        this problem can also be caused by a slow browser with too many tabs and/or extensions.
                    </Subheading>
                ) : (
                    <Subheading className={done ? "animate-fade-in" : "invisible"}>hang in there...</Subheading>
                )}
            </div>
        </Delayed>
    );
};
