/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect } from "react";
import { useHistory } from "react-router";
import { trackButtonOrAnchor, trackPathChange } from "../Analytics";
import { useTheme } from "../theme-context";
import { useOrbital } from "./use-orbital";
import { useCurrentUser } from "../user-context";

export const useAnalyticsTracking = () => {
    const history = useHistory();
    const user = useCurrentUser();
    const { isDark } = useTheme();

    const { orbital, isLoaded: isOrbitalLoaded, discoveryIds } = useOrbital("4aErj3uvRbye");

    // listen and notify Segment of client-side path updates
    useEffect(() => {
        //store current path to have access to previous when path changes
        const w = window as any;
        const _gp = w._gp || (w._gp = {});
        _gp.path = window.location.pathname;

        return history.listen(() => {
            const path = window.location.pathname;
            // Make sure that we don't accidentally track the same path twice. This can happen if just the hash or search params change.
            if (path === _gp.path) {
                return;
            }

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

    useEffect(() => {
        if (!user || !user.profile?.onboardedTimestamp || !isOrbitalLoaded) {
            return;
        }

        orbital("identify", user.id);

        orbital("customConfig", {
            theme: {
                colorScheme: isDark ? "dark" : "light",
                colorsLight: {
                    primary: "#292524",
                },
                colorsDark: {
                    primary: "#fff",
                },
            },
        });

        // Initiate every discovery we have inside of Configcat. This does not show the modals right away, but rather lets Orbital's cleverness take over and decide when to show them.
        for (const id of discoveryIds) {
            orbital("trigger", id, { position: "bottom_left" });
        }

        return () => orbital("reset");
    }, [discoveryIds, isDark, isOrbitalLoaded, orbital, user]);
};
