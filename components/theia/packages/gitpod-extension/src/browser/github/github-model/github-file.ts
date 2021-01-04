/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PullRequestReviewComment } from "./github-protocol";

export class GitHubFile {

    protected readonly _lines = new Map<number, GitHubFile.Line>();
    protected readonly _diffPositions = new Map<number, GitHubFile.Line>();

    modified?: GitHubFile;

    constructor(
        readonly kind: GitHubFile.Kind,
        readonly path: string,
        readonly original?: GitHubFile
    ) { }

    get lineNumbers(): number[] {
        return Array.from(this._lines.keys());
    }

    get lines(): GitHubFile.Line[] {
        return Array.from(this._lines.values());
    }

    get(lineNumber: number): GitHubFile.Line | undefined {
        return this._lines.get(lineNumber);
    }

    protected create(lineNumber: number): GitHubFile.Line {
        const line = new GitHubFile.Line(this, lineNumber);
        this._lines.set(lineNumber, line);
        return line;
    }
    obtain(lineNumber: number): GitHubFile.Line {
        return this.get(lineNumber) || this.create(lineNumber);
    }

    pushHunk(hunk: GitHubFile.Hunk): void {
        for (let index = 0; index < hunk.length; index++) {
            const lineNumber = hunk.start + index;
            const line = this.obtain(lineNumber);
            line.hunk = hunk;
            const { diffPosition } = line;
            if (diffPosition) {
                this._diffPositions.set(diffPosition, line);
            }
        }
    }

    /** A shortcut for completly new files that avoids the costly computation of diff positions */
    pushHunkCompleteFileAdded(hunk: GitHubFile.Hunk): void {
        for (let index = 0; index < hunk.length; index++) {
            const lineNumber = hunk.start + index;
            const line = this.obtain(lineNumber);
            line.setHunkCompleteFileAdded(hunk);
            this._diffPositions.set(lineNumber, line);
        }
    }

    findByDiffPosition(diffPosition: number): GitHubFile.Line | undefined {
        return this._diffPositions.get(diffPosition);
    }

}
export namespace GitHubFile {
    /** used for testing only */
    export var computeDiffLineWithContent = false;

    export type Kind = 'original' | 'modified';
    export interface Hunk {
        diffPosition: number,
        start: number,
        length: number,
        lines: string[]
    }
    export interface DiffLine {
        position: number
        content?: string
        operation: PullRequestReviewComment.DiffOperation
    }
    export class Line {

        protected _hunk: Hunk | undefined;
        protected _diffLine: DiffLine | undefined;

        readonly comments: PullRequestReviewComment.Resolved[] = [];

        constructor(
            readonly file: GitHubFile,
            readonly lineNumber: number,
        ) { }

        get hunk(): Hunk | undefined {
            return this._hunk;
        }
        set hunk(hunk: Hunk | undefined) {
            if (this._hunk && hunk) {
                console.error('Unexpected hunk', hunk, 'current hunk', this._hunk);
                return;
            }
            this._hunk = hunk;
            this._diffLine = this.computeDiffLine();
        }
        /** A shortcut that avoids the costly computation in computeDiffLine for files that are completly new (O(n^2)) */
        setHunkCompleteFileAdded(hunk: Hunk) {
            this._hunk = hunk;
            this._diffLine = { position: this.lineNumber, operation: "+" };
        }

        protected computeDiffLine(): DiffLine | undefined {
            const hunk = this.hunk;
            if (!hunk) {
                return undefined;
            }
            let position = hunk.diffPosition;
            let lines = this.lineNumber - hunk.start + 1;
            for (const content of hunk.lines) {
                if (PullRequestReviewComment.DiffOperation.isLine(content)) {
                    const operation = content[0] as PullRequestReviewComment.DiffOperation;
                    if (operation !== (this.file.kind === 'original' ? '+' : '-')) {
                        lines--;
                    }
                    if (lines === 0) {
                        if (GitHubFile.computeDiffLineWithContent) {
                            // Include content only for tests because of performance/memory consumption
                            return { position, content, operation };
                        } else {
                            return { position, operation };
                        }
                    }
                }
                position++;
            }
            return undefined;
        }

        get diffLine(): DiffLine | undefined {
            return this._diffLine;
        }

        get diffPosition(): number | undefined {
            const line = this.diffLine;
            return line && line.position;
        }

        pushComment(comment: PullRequestReviewComment.Resolved): void {
            const createdAt = Date.parse(comment.createdAt);
            const index = this.comments.findIndex(c => Date.parse(c.createdAt) > createdAt);
            if (index === -1) {
                this.comments.push(comment);
            } else {
                this.comments.splice(index, 0, comment);
            }
        }

        deleteComment(comment: PullRequestReviewComment.Resolved): void {
            const index = this.comments.indexOf(comment);
            if (index !== -1) {
                this.comments.splice(index, 1);
            }
        }
    }
}
