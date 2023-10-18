/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SubjectId } from "../auth/subject-id";

declare module "@connectrpc/connect" {
    interface HandlerContext {
        subjectId: SubjectId;
    }
}
