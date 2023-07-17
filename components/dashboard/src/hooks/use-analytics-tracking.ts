/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect } from "react";
import { useHistory } from "react-router";
import { trackButtonOrAnchor, trackPathChange } from "../Analytics";
import { useUserLoader } from "./use-user-loader";
import { useTheme } from "../theme-context";
import { useOrbital } from "./use-orbital";

export const useAnalyticsTracking = () => {
    const history = useHistory();
    const { user, loading } = useUserLoader();
    const { isDark } = useTheme();

    // Todo(ft): only enable on gitpod.io
    const { orbital, isLoaded: isOrbitalLoaded } = useOrbital("4aErj3uvRbye");

    // listen and notify Segment of client-side path updates
    useEffect(() => {
        //store current path to have access to previous when path changes
        const w = window as any;
        const _gp = w._gp || (w._gp = {});
        _gp.path = window.location.pathname;

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

    useEffect(() => {
        if (!isOrbitalLoaded) {
            return;
        }

        orbital("customConfig", { theme: { colorScheme: isDark ? "dark" : "light" } });
    }, [isDark, isOrbitalLoaded, orbital]);

    useEffect(() => {
        if (loading || !user || !user.additionalData?.profile?.onboardedTimestamp || !isOrbitalLoaded) {
            return;
        }

        orbital("identify", user.id);

        orbital("trigger", "YyOnOjsPDZN0", { force: true, position: "bottom_center" });

        return orbital("reset");
    }, [isOrbitalLoaded, loading, orbital, user]);
};
