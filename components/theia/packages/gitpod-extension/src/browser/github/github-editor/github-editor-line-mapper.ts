/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Event } from "@theia/core";

export class GitHubEditorLineMapper {

    constructor(
        readonly model: GitHubEditorLineMapper.Model
    ) { }

    mapToPullRequest(lineNumber: number): number {
        const changes = this.model.changes;
        if (!changes) {
            return 0;
        }
        const inversedChanges = this.inverseChanges(this.normalizeChanges(changes));
        return this.doMap(inversedChanges, lineNumber);
    }

    mapToChanges(pullRequestLineNumber: number): number {
        const changes = this.model.changes;
        if (!changes) {
            return 0;
        }
        return this.doMap(this.normalizeChanges(changes), pullRequestLineNumber);
    }

    protected doMap(changes: IterableIterator<monaco.services.IChange>, lineNumber: number): number {
        let delta = 0;
        for (const change of changes) {
            if (this.isBelow(change, lineNumber)) {
                break;
            }
            if (this.isDeleted(change, lineNumber)) {
                return 0;
            }
            delta += this.computeDelta(change);
        }
        return lineNumber + delta
    }

    protected isBelow(change: monaco.services.IChange, lineNumber: number): boolean {
        if (this.isDeletion(change)) {
            return change.originalStartLineNumber > lineNumber;
        }
        return change.originalStartLineNumber >= lineNumber;
    }

    protected isDeleted(change: monaco.services.IChange, lineNumber: number): boolean {
        return this.isDeletion(change) && change.originalEndLineNumber >= lineNumber;
    }

    protected computeDelta(change: monaco.services.IChange): number {
        if (this.isInsertion(change)) {
            const modifiedLength = this.getModifiedLength(change);
            return 1 + modifiedLength;
        }
        if (this.isDeletion(change)) {
            const originalLength = this.getOriginalLength(change);
            return -(1 + originalLength);
        }
        return 0;
    }

    protected * normalizeChanges(changes: monaco.services.IChange[]): IterableIterator<monaco.services.IChange> {
        for (const change of changes) {
            for (const normalized of this.normalizeChange(change)) {
                yield normalized;
            }
        }
    }
    protected normalizeChange(change: monaco.services.IChange): monaco.services.IChange[] {
        if (this.isDeletion(change) || this.isInsertion(change)) {
            return [change];
        }
        const originalLength = this.getOriginalLength(change);
        const modifiedLength = this.getModifiedLength(change);
        const lengthChange = originalLength - modifiedLength;
        if (lengthChange === 0) {
            return [change];
        }
        if (lengthChange > 0) {
            return this.doNormalizeChange(change, lengthChange);
        }
        const inverseChange = this.inverseChange(change);
        return this.doNormalizeChange(inverseChange, lengthChange * -1).map(this.inverseChange);
    }
    protected doNormalizeChange(change: monaco.services.IChange, lengthChange: number): monaco.services.IChange[] {
        const originalEndLineNumber = change.originalEndLineNumber - lengthChange;
        const normalized: monaco.services.IChange = {
            ...change,
            originalEndLineNumber
        };
        const deletion: monaco.services.IChange = {
            ...change,
            originalStartLineNumber: originalEndLineNumber + 1,
            modifiedStartLineNumber: change.modifiedEndLineNumber,
            modifiedEndLineNumber: 0
        }
        return [normalized, deletion];
    }

    protected * inverseChanges(changes: IterableIterator<monaco.services.IChange>): IterableIterator<monaco.services.IChange> {
        for (const change of changes) {
            yield this.inverseChange(change);
        }
    }
    protected inverseChange(change: monaco.services.IChange): monaco.services.IChange {
        return {
            originalStartLineNumber: change.modifiedStartLineNumber,
            originalEndLineNumber: change.modifiedEndLineNumber,
            modifiedStartLineNumber: change.originalStartLineNumber,
            modifiedEndLineNumber: change.originalEndLineNumber
        }
    }

    protected getModifiedLength(change: monaco.services.IChange): number {
        return change.modifiedEndLineNumber - change.modifiedStartLineNumber;
    }

    protected getOriginalLength(change: monaco.services.IChange): number {
        return change.originalEndLineNumber - change.originalStartLineNumber;
    }

    protected isInsertion(change: monaco.services.IChange): boolean {
        return change.originalEndLineNumber === 0;
    }

    protected isDeletion(change: monaco.services.IChange): boolean {
        return change.modifiedEndLineNumber === 0;
    }

}
export namespace GitHubEditorLineMapper {
    export interface Model {
        readonly onChanged: Event<void>;
        /**
         * undefined is changes cannot be computed
         */
        readonly changes: monaco.services.IChange[] | undefined;
    }
}
