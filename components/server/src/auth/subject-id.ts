/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { LogContext, log } from "@gitpod/gitpod-protocol/lib/util/logging";

export type SubjectId = {
    kind: SubjectKind;
    /**
     * The value of the subject id, _without_ the prefix.
     */
    value: string;
};
export type SubjectKind = keyof typeof SubjectKindNames;
const SubjectKindNames = {
    apitoken: "apitoken",
    user: "user",
};
const SubjectKindByShortName: ReadonlyMap<string, SubjectKind> = new Map(
    Object.keys(SubjectKindNames).map((k) => {
        return [SubjectKindNames[k as SubjectKind], k as SubjectKind];
    }),
);

export namespace SubjectId {
    const SEPARATOR = "_";
    export function create(kind: SubjectKind, value: string): SubjectId {
        switch (kind) {
            case "user":
                return { kind, value };
            case "apitoken":
                return { kind, value };
        }
    }
    export function fromUserId(userId: string): SubjectId {
        return create("user", userId);
    }
    export function is(obj: any): obj is SubjectId {
        return !!obj && isSubjectKind(obj.kind) && typeof obj["value"] === "string";
    }
    export function isSubjectKind(str: string): str is SubjectKind {
        return !!SubjectKindNames[str as SubjectKind];
    }
    export function toString(id: SubjectId): string {
        const prefix = SubjectKindNames[id.kind];
        return prefix + SEPARATOR + id.value;
    }
    export function parse(str: string): SubjectId | undefined {
        try {
            return tryParse(str);
        } catch (err) {
            log.warn("Unable to parse SubjectId", err, str);
            return undefined;
        }
    }
    export function tryParse(str: string): SubjectId {
        const parts = str.split(SEPARATOR);
        if (parts.length < 2) {
            throw new Error(`Unable to parse SubjectId`);
        }
        const kind = SubjectKindByShortName.get(parts[0]);
        if (!kind) {
            throw new Error(`Unable to parse SubjectId: unknown SubjectKind!`);
        }
        const value = parts.slice(1).join();
        return { kind, value };
    }
}

// The following codes is meant for backwards-compatibility with the existing express types, or other code, that relis on
export type Subject = User | SubjectId;
export namespace Subject {
    export function wrap(user: Express.User | User | undefined): Subject | undefined {
        if (!user) {
            return undefined;
        }
        if (SubjectId.is(user)) {
            return user;
        }
        return user as User;
    }

    export function toId(subject: Subject): SubjectId {
        if (SubjectId.is(subject)) {
            return subject;
        }
        return SubjectId.fromUserId(subject.id);
    }

    export function toLogIds(subject: Subject | undefined): Pick<LogContext, "userId" | "subjectId"> {
        let userId = undefined;
        let subjectId = undefined;
        if (SubjectId.is(subject)) {
            if (subject.kind === "user") {
                userId = subject.value;
            }
            subjectId = SubjectId.toString(subject);
        } else if (User.is(subject)) {
            userId = subject.id;
        }
        return { userId, subjectId };
    }
    /**
     * Meant for backwards-compatibility
     * @param subject
     * @returns
     * @deprecated
     */
    export function toIdStr(subject: Subject | undefined): string | undefined {
        if (subject === undefined) {
            return undefined;
        }
        if (SubjectId.is(subject)) {
            if (subject.kind === "user") {
                return subject.value;
            }
            return SubjectId.toString(subject);
        }
        return subject.id;
    }
}
