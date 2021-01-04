/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { parsePatch, IHunk } from 'diff';
import { PullRequestTimelineItem, PullRequestReviewComment } from './github-protocol';
import { GitHubFile } from './github-file';
import { ReposCompareCommitsResult } from './github-rest-api';

export class GitHubData {

    readonly timeline: PullRequestTimelineItem[] = [];
    readonly pendingComments: PullRequestReviewComment.Resolved[] = [];

    protected commonParentCommit: string | undefined;
    get getCommonParentCommit(): string | undefined {
        return this.commonParentCommit;
    }

    protected commits: GitHubData.Commit[] = [];
    get lastCommit(): GitHubData.Commit | undefined {
        return this.commits[this.commits.length - 1];
    }
    get commitCount(): number {
        return this.commits.length;
    }

    protected readonly modified = new Map<string, GitHubFile>();
    protected readonly original = new Map<string, GitHubFile>();
    getFiles(kind: GitHubFile.Kind): Map<string, GitHubFile> {
        return kind === 'original' ? this.original : this.modified;
    }

    getFile(kind: GitHubFile.Kind, path: string): GitHubFile | undefined {
        return this.getFiles(kind).get(path);
    }
    getFileLine(kind: GitHubFile.Kind, path: string, lineNumber: number): GitHubFile.Line | undefined {
        const file = this.getFile(kind, path);
        return file && file.get(lineNumber);
    }
    getDiffLine(kind: GitHubFile.Kind, path: string, lineNumber: number): GitHubFile.DiffLine | undefined {
        const line = this.getFileLine(kind, path, lineNumber);
        return line && line.diffLine;
    }
    getDiffPosition(kind: GitHubFile.Kind, path: string, lineNumber: number): number | undefined {
        const line = this.getFileLine(kind, path, lineNumber);
        return line && line.diffPosition;
    }
    getComments(kind: GitHubFile.Kind, path: string, lineNumber: number): PullRequestReviewComment[] {
        const line = this.getFileLine(kind, path, lineNumber);
        return line && line.comments || [];
    }

    get paths(): ReadonlySet<string> {
        const paths = new Set<string>();
        [...this.getFiles('original').keys()].forEach(p => paths.add(p));
        [...this.getFiles('modified').keys()].forEach(p => paths.add(p));
        return paths;
    }
    getLineNumbers(path: string): number[] {
        const lineNumbers = new Set<number>();
        const original = this.getFile('original', path);
        if (original) {
            [...original.lineNumbers].forEach(n => lineNumbers.add(n));
        }
        const modified = this.getFile('modified', path);
        if (modified) {
            [...modified.lineNumbers].forEach(n => lineNumbers.add(n));
        }
        return [...lineNumbers].sort((a, b) => a - b);
    }
    getLineConversations(path: string, lineNumber: number): GitHubData.Conversation[] {
        const modified = this.getFile('modified', path);
        if (!modified) return [];

        const conversations = new Map<string, GitHubData.Conversation>();
        this.collectLineConversations(modified.original!.get(lineNumber), conversations);
        this.collectLineConversations(modified.get(lineNumber), conversations);
        return Array.from(conversations.values());
    }
    protected collectLineConversations(line: GitHubFile.Line | undefined, conversations: Map<string, GitHubData.Conversation>): void {
        if (!line) {
            return;
        }
        for (const comment of line.comments) {
            const replyTo = comment.replyTo && conversations.get(comment.replyTo.id);
            if (replyTo) {
                replyTo.comments.push(comment);
            } else {
                const originalLineNumber = this.getOriginalLineNumber(line);
                conversations.set(comment.id, {
                    operation: comment.operation,
                    originalLineNumber,
                    comments: [comment]
                });
            }
        }
    }
    protected getOriginalLineNumber(line: GitHubFile.Line): number | undefined {
        if (line.file.kind === 'original' || !line.diffLine) {
            return undefined;
        }
        const originalFile = line.file.original;
        const originalLine = originalFile && originalFile.findByDiffPosition(line.diffLine.position);
        return originalLine && originalLine.lineNumber;
    }
    get conversationCount(): number {
        return [...this.paths].reduce((total, path) =>
            total + this.getLineNumbers(path).reduce((count, lineNumber) =>
                count + this.getLineConversations(path, lineNumber).length, 0
            ), 0
        );
    }
    get hasChanges(): boolean {
        return this.original.size !== 0 || this.modified.size !== 0;
    }

    protected createFile(kind: GitHubFile.Kind, path: string, original?: GitHubFile): GitHubFile {
        const file = new GitHubFile(kind, path, original);
        this.getFiles(file.kind).set(file.path, file);
        return file;
    }

    pushComments(comments: PullRequestReviewComment[]): void {
        comments.forEach(comment => this.pushComment(comment));
    }
    pushComment(comment: PullRequestReviewComment): void {
        const resolved = PullRequestReviewComment.resolve(comment);
        if (resolved === undefined) return;

        const file = this.getCommentFile(resolved);
        if (file === undefined) return;

        const line = file.findByDiffPosition(resolved.position);
        if (line) {
            line.pushComment(resolved);
        }

        if (!resolved.publishedAt) {
            this.pendingComments.push(resolved);
        }
    }
    deleteComment(comment: PullRequestReviewComment): void {
        const resolved = PullRequestReviewComment.resolve(comment);
        if (resolved === undefined) return;

        const file = this.getCommentFile(resolved);
        if (file === undefined) return;

        const line = file.findByDiffPosition(resolved.position);
        if (line) {
            line.deleteComment(resolved);
        }

        const pendingIndex = this.pendingComments.indexOf(resolved);
        if (pendingIndex !== -1) {
            this.pendingComments.splice(pendingIndex, 1);
        }
    }

    protected getCommentFile(comment: PullRequestReviewComment.Resolved): GitHubFile | undefined {
        const file = this.getFile('modified', comment.path) || this.getFile('original', comment.path);
        if (!file) return undefined;
        if (comment.operation === '-') {
            return file.kind === 'original' ? file : file.original;
        }
        return file.kind === 'modified' ? file : file.modified;
    }

    pushCompare(compareResult: ReposCompareCommitsResult): void {
        this.commonParentCommit = compareResult.commonParentCommit;
        this.pushFiles(compareResult.files);
        this.pushCommits(compareResult.commits);
    }
    pushCommits(commits: ReposCompareCommitsResult.Commit[]): void {
        this.commits = commits.map(({ sha, commit }) => ({
            sha,
            message: commit.message
        }));
    }
    pushFiles(files: ReposCompareCommitsResult.File[]): void {
        files.forEach(file => this.pushFile(file));
    }
    pushFile(file: ReposCompareCommitsResult.File): void {
        try {
            const original = this.createFile('original', file.previous_filename || file.filename);
            const modified = this.createFile('modified', file.filename, original);
            original.modified = modified;
            if (file.patch) {
                this.pushPatch(original, modified, file.patch);
            } else if (file.hunks) {
                this.pushHunks(original, modified, file.hunks);
            }
        } catch (e) {
            console.error('Failed to parse a file diff', e, file);
        }
    }
    protected pushPatch(original: GitHubFile, modified: GitHubFile, patch: string): void {
        parsePatch(patch).reduce((diffPosition, diff) => this.pushHunks(original, modified, diff.hunks, diffPosition), 1);
    }
    protected pushHunks(original: GitHubFile, modified: GitHubFile, hunks: IHunk[], startDiffPosition: number = 1): number {
        return hunks.reduce((diffPosition, hunk) => this.pushHunk(original, modified, hunk, diffPosition), startDiffPosition);
    }
    protected pushHunk(original: GitHubFile, modified: GitHubFile, hunk: IHunk, diffPosition: number): number {
        original.pushHunk({
            diffPosition,
            start: hunk.oldStart,
            length: hunk.oldLines,
            lines: hunk.lines
        });
        
        if (hunk.oldLines === 0 && hunk.newLines !== 0) {
            // An optimization for files that are completely new
            modified.pushHunkCompleteFileAdded({
                diffPosition,
                start: hunk.newStart,
                length: hunk.newLines,
                lines: hunk.lines
            })
        } else {
            modified.pushHunk({
                diffPosition,
                start: hunk.newStart,
                length: hunk.newLines,
                lines: hunk.lines
            });
        }
        return diffPosition + hunk.lines.length + 1;
    }

}
export namespace GitHubData {
    export interface Conversation {
        operation: PullRequestReviewComment.DiffOperation;
        originalLineNumber?: number;
        comments: PullRequestReviewComment.Resolved[]
    }
    export interface Commit {
        sha: string,
        message: string
    }
}