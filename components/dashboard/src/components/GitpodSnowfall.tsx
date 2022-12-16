/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import Snowfall from "react-snowfall";
import { useTheme } from "../theme-context";

// Wrapping <Snowfall/> so it can be lazy-loaded
export default () => {
    const { isDark } = useTheme();

    return (
        <Snowfall
            speed={[0.5, 1]}
            wind={[0.5, 1]}
            radius={[0.5, 2]}
            snowflakeCount={100}
            color={isDark ? "#fff" : "#FFE4BC"}
        />
    );
};
