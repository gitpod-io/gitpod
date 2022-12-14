/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect } from "react";
import { useHistory } from "react-router";
import { trackButtonOrAnchor, trackPathChange } from "../Analytics";

export const useAnalyticsTracking = () => {
    const history = useHistory();

    // listen and notify Segment of client-side path updates
    useEffect(() => {
        return history.listen((location: any) => {
            const path = window.location.pathname;
            trackPathChange({
                prev: (window as any)._gp.path,
                path: path,
            });
            (window as any)._gp.path = path;
        });
    }, [history]);

    // Track button/anchor clicks
    useEffect(() => {
        const handleButtonOrAnchorTracking = (props: MouseEvent) => {
            var curr = props.target as HTMLElement;

            // TODO: Look at using curr.closest('a,button') instead - determine if divs w/ onClick are being used
            //check if current target or any ancestor up to document is button or anchor
            while (!(curr instanceof Document)) {
                if (
                    curr instanceof HTMLButtonElement ||
                    curr instanceof HTMLAnchorElement ||
                    (curr instanceof HTMLDivElement && curr.onclick)
                ) {
                    trackButtonOrAnchor(curr);
                    break; //finding first ancestor is sufficient
                }
                curr = curr.parentNode as HTMLElement;
            }
        };
        window.addEventListener("click", handleButtonOrAnchorTracking, true);
        return () => window.removeEventListener("click", handleButtonOrAnchorTracking, true);
    }, []);
};
