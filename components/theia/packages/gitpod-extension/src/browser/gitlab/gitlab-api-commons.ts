/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Users, UserSchema } from "gitlab";

export namespace GitLabApiCommons {

    export async function getCurrentUser(api: { Users: Users }): Promise<UserSchema | undefined> {
        const currentUser = await api.Users.current();
        return GitLabApiCommons.isUserSchema(currentUser) ? currentUser : undefined;
    }

    export function isUserSchema(x: any): x is UserSchema {
        return !!x.id &&
            !!x.name &&
            !!x.username &&
            !!x.state &&
            !!x.avatar_url &&
            !!x.web_url;
    }
}