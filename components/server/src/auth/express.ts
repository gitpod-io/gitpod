/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { runWithSubjectId } from "../util/request-context";
import { SubjectId } from "./subject-id";

/**
 *
 * @param req
 * @returns req.subjectId if set, SubjectId.fromUserId(req.user.id) otherwise
 */
export function getAuthorizingSubjectId(req: express.Request): SubjectId | undefined {
    // If set, we strictly prefer the subjectId (which might be a token) to not inadvertently elevate privileges.
    if (!!req.subjectId) {
        return req.subjectId;
    }
    return req.user?.id ? SubjectId.fromUserId(req.user.id) : undefined;
}

export async function runWithReqSubjectId(req: express.Request, res: express.Response, next: express.NextFunction) {
    const subjectId = getAuthorizingSubjectId(req);
    if (!subjectId) {
        res.sendStatus(401);
        return;
    }
    return await runWithSubjectId(subjectId, async () => next());
}
