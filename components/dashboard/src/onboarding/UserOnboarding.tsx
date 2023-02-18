/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FunctionComponent } from "react";

type Props = {
    user: User;
};
const UserOnboarding: FunctionComponent<Props> = ({ user }) => {
    // Placeholder UI to start stubbing out new flow
    return (
        <div className="container">
            <h1>Welcome</h1>

            <p>Help us get to know you a bit better</p>
        </div>
    );
};
export default UserOnboarding;
