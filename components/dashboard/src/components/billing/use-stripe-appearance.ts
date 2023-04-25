/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Appearance } from "@stripe/stripe-js";
import { ThemeContext } from "../../theme-context";
import { useContext, useMemo } from "react";

export const useStripeAppearance = (): Appearance => {
    const { isDark } = useContext(ThemeContext);

    return useMemo(
        () => ({
            theme: isDark ? "night" : "stripe",
        }),
        [isDark],
    );
};
