/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export type SubjectKind = keyof typeof SubjectKindNames;
const SubjectKindNames = {
    user: "user",
};
const SubjectKindByShortName: ReadonlyMap<string, SubjectKind> = new Map(
    Object.keys(SubjectKindNames).map((k) => {
        return [SubjectKindNames[k as SubjectKind], k as SubjectKind];
    }),
);

export class SubjectId {
    private static readonly SEPARATOR = "_";

    constructor(public readonly kind: SubjectKind, public readonly value: string) {}

    public static fromUserId(userId: string): SubjectId {
        return new SubjectId("user", userId);
    }

    public static is(obj: any): obj is SubjectId {
        return !!obj && obj instanceof SubjectId;
    }

    public static isSubjectKind(str: string): str is SubjectKind {
        return !!SubjectKindNames[str as SubjectKind];
    }

    public toString(): string {
        const prefix = SubjectKindNames[this.kind];
        return prefix + SubjectId.SEPARATOR + this.value;
    }

    public static parse(str: string): SubjectId | undefined {
        try {
            return SubjectId.tryParse(str);
        } catch (err) {
            return undefined;
        }
    }

    public static tryParse(str: string): SubjectId {
        const parts = str.split(SubjectId.SEPARATOR);
        if (parts.length < 2) {
            throw new Error("Unable to parse SubjectId");
        }
        const kind = SubjectKindByShortName.get(parts[0]);
        if (!kind) {
            throw new Error("Unable to parse SubjectId: unknown SubjectKind!");
        }
        const value = parts.slice(1).join();
        return new SubjectId(kind, value);
    }

    public userId(): string | undefined {
        if (this.kind === "user") {
            return this.value;
        }
        return undefined;
    }

    public equals(other: SubjectId): boolean {
        return this.kind === other.kind && this.value === other.value;
    }
}

// The following codes is meant for backwards-compatibility with the existing express types, or other code, that relies on `userId: string` or `User`
/**
 * Interface type meant for backwards compatibility
 */
export type Subject = string | SubjectId;
export namespace Subject {
    export function toId(subject: Subject): SubjectId {
        if (SubjectId.is(subject)) {
            return subject;
        }
        if (typeof subject === "string") {
            // either a subjectId string or a userId string
            const parsed = SubjectId.parse(subject);
            return parsed || SubjectId.fromUserId(subject);
        }
        throw new Error("Invalid Subject");
    }
}
