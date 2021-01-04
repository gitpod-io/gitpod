/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { parsePatch, IHunk } from 'diff';

export interface RepositoryQueryResult {
    repository: Repository | null
    node: Node
    nodes: Node[]
}

export enum PullRequestState {
    /**
     * A pull request that is still open.
     */
    OPEN = "OPEN",
    /**
     * A pull request that has been closed without being merged.
     */
    CLOSED = "CLOSED",
    /**
     * A pull request that has been closed by being merged.
     */
    MERGED = "MERGED"
}

export enum MergeableState {
    CONFLICTING = "CONFLICTING",
    MERGEABLE = "MERGEABLE",
    UNKNOWN = "UNKNOWN"
}

export interface PullRequest extends Comment, Node {
    url: string;
    number: number;
    title: string;
    baseRef: Ref | null;
    /**
     * Identifies the name of the base Ref associated with the pull request, even if the ref has been deleted.
     */
    baseRefName: string;
    baseRefOid: string;
    headRef: Ref | null;
    /**
     * Identifies the name of the head Ref associated with the pull request, even if the ref has been deleted.
     */
    headRefName: string;
    headRefOid: string;
    isCrossRepository: boolean,
    reviews: PullRequestReviewConnection;
    state: PullRequestState
    commits: PullRequestCommitConnection;
    timeline: PullRequestTimelineConnection;
    /**
     * The repository associated with this node.
     */
    repository: Repository;
    mergeable: MergeableState;
    merged: boolean;
    viewerCanUpdate: boolean;
}

export interface PullRequestTimelineConnection {
    nodes: PullRequestTimelineItem[]
    pageInfo: PageInfo
    totalCount: number
}

export interface PullRequestTimelineItem {
    __typename: string;
}

export interface PullRequestConnection {
    nodes: PullRequest[]
}

export interface PullRequestCommitConnection {
    nodes: PullRequestCommit[]
    pageInfo: PageInfo
    totalCount: number
}

export interface PullRequestCommit extends Node {

}

export interface PullRequestReviewConnection {
    nodes: PullRequestReview[]
    pageInfo: PageInfo
}

export enum PullRequestReviewState {
    /**
     * A review allowing the pull request to merge.
     */
    APPROVED = 'APPROVED',
    /**
     * A review allowing the pull request to merge.
     */
    CHANGES_REQUESTED = 'CHANGES_REQUESTED',
    /**
     * A review blocking the pull request from merging.
     */
    COMMENTED = 'COMMENTED',
    /**
     * A review that has been dismissed.
     */
    DISMISSED = 'DISMISSED',
    /**
     * A review that has not yet been submitted.
     */
    PENDING = 'PENDING'
}

export interface PullRequestReview extends Comment, Node, PullRequestTimelineItem {
    submittedAt: string | null
    comments: PullRequestReviewCommentConnection
    /**
     * Identifies the current state of the pull request review.
     */
    state: PullRequestReviewState
}

export namespace PullRequestReview {
    export function is(item: any): item is PullRequestReview {
        return !!item && item.__typename === 'PullRequestReview';
    }
    export function isPending(item: any): item is PullRequestReview {
        return is(item) && item.state === PullRequestReviewState.PENDING;
    }
    export function getPending(item: any): PullRequestReview | undefined {
        return isPending(item) ? item : undefined;
    }
}

export interface PullRequestReviewCommentConnection {
    nodes: PullRequestReviewComment[]
    pageInfo: PageInfo
}

export interface PullRequestReviewComment extends Comment, Node {
    commit: Commit
    originalCommit: Commit
    /**
     * The original line index in the diff to which the comment applies.
     */
    originalPosition: number
    /**
     * The path to which the comment applies.
     */
    path: string
    /**
     * The line index in the diff to which the comment applies.
     */
    position: number | null
    /**
     * Identifies when the comment was published at.
     */
    publishedAt: string | null
    updatedAt: string
    replyTo: PullRequestReviewComment | null
    /**
     * The pull request associated with this review comment.
     */
    pullRequest: PullRequest
    /**
     * The pull request review associated with this review comment.
     */
    pullRequestReview: PullRequestReview | null
    /**
     * Identifies the primary key from the database.
     *
     * For the backward-compatibility with the REST api.
     */
    databaseId: number | null
    /**
     * The diff hunk to which the comment applies.
     */
    diffHunk: string
}
export namespace PullRequestReviewComment {
    export type DiffOperation = '+' | '-' | ' '
    export namespace DiffOperation {
        export function is(value: string): value is DiffOperation {
            return value === '+' || value === '-' || value === ' ';
        }
        export function isLine(line: string): boolean {
            return is(line[0]);
        }
    }
    export interface DiffHunk {
        hunk: IHunk
        diffPosition: number
        operation: DiffOperation
        comment: PullRequestReviewComment
    }
    export interface Resolved extends PullRequestReviewComment {
        position: number
        operation: DiffOperation
    }
    export namespace Resolved {
        export function is(comment: PullRequestReviewComment): comment is Resolved {
            return typeof comment.position === 'number' && 'operation' in comment && DiffOperation.is((<any>comment)['operation']);
        }
    }
    export function resolve(comment: PullRequestReviewComment): Resolved | undefined {
        if (Resolved.is(comment)) {
            return comment;
        }
        if (typeof comment.position !== 'number') {
            return undefined;
        }
        const hunk = parsePatch(comment.diffHunk)[0].hunks[0];
        const lines = hunk.lines.filter(DiffOperation.isLine);
        const operation = lines[lines.length - 1].substr(0, 1) as DiffOperation;
        return Object.assign(comment, {
            position: comment.position,
            operation
        });
    }
}

export interface Commit extends GitObject, Node, PullRequestTimelineItem {
    /**
     * An abbreviated version of the Git object ID
     */
    abbreviatedOid: string
    /**
     * The Git object ID
     */
    oid: string
    /**
     * Authorship details of the commit.
     */
    author: GitActor | null
    /**
     * Check if the committer and the author match.
     */
    authoredByCommitter: boolean
    /**
     * The datetime when this commit was authored.
     */
    authoredDate: string
    /**
     * The datetime when this commit was committed.
     */
    committedDate: string
    /**
     * Committership details of the commit.
     */
    committer: GitActor | null
    /**
     * The Git commit message
     */
    message: string
    /**
     * The Git commit message headline
     */
    messageHeadline: string
    /**
     * The commit message headline rendered to HTML.
     */
    messageHeadlineHTML: string
    /**
     * The datetime when this commit was pushed.
     */
    pushedDate: string | null
}
export namespace Commit {
    export function is(item: any): item is Commit {
        return !!item && item.__typename === 'Commit';
    }
    /**
     * see https://github.com/atom/github/blob/daf0b55463776645e1d4bc9431e309fdb7158c16/lib/containers/timeline-items/commit-container.js#L12
     */
    export function authoredByCommitter(commit: Commit): boolean {
        if (commit.authoredByCommitter) {
            return true;
        }
        const committer = commit.committer;
        if (!committer) {
            return false;
        }
        // If you commit on GitHub online the committer details would be:
        //
        //    name: "GitHub"
        //    email: "noreply@github.com"
        //    user: null
        //
        if (committer.email === 'noreply@github.com') {
            return true;
        }
        if (committer.name === 'GitHub' && committer.user === null) {
            return true;
        }
        return false;
    }
}

export interface Comment {
    author: Actor | null
    body: string
    bodyHTML: string
    createdAt: string
}

export interface IssueComment extends Comment, Node, PullRequestTimelineItem {
}
export namespace IssueComment {
    export function is(item: any): item is IssueComment {
        return !!item && item.__typename === 'IssueComment';
    }
}

/**
 * Represents an actor in a Git commit (ie. an author or committer).
 */
export interface GitActor {
    /**
     * A URL pointing to the author's public avatar.
     */
    avatarUrl: string
    /**
     * The timestamp of the Git action (authoring or committing).
     */
    date: string | null
    /**
     * The email in the Git commit.
     */
    email: string | null
    /**
     * The name in the Git commit.
     */
    name: string | null
    /**
     * The GitHub user corresponding to the email field. Null if no such user exists.
     */
    user: User | null
}

export interface User extends Actor {

}

export interface Actor {
    login: string
    avatarUrl: string
    url: string
}

export interface Ref {
    name: string
    repository: Repository
}

export enum RepositoryPermission {
    ADMIN = "ADMIN",
    READ = "READ",
    WRITE = "WRITE"
}

export namespace RepositoryPermission {
    export function mayPush(perm: RepositoryPermission | null): boolean {
        return perm !== null && (perm === RepositoryPermission.ADMIN || perm === RepositoryPermission.WRITE);
    }
}

export interface Repository extends Node {
    owner: Actor;
    name: string;
    parent: Repository | null
    pullRequest: PullRequest | null
    pullRequests: PullRequestConnection
    defaultBranchRef: Ref | null
    forks: RepositoryConnection
    refs: RefConnection
    isFork: boolean
    mergeCommitAllowed: boolean
    rebaseMergeAllowed: boolean
    squashMergeAllowed: boolean
    viewerPermission: RepositoryPermission | null
}
export namespace Repository {
    export function getDefaultBranch(repository: Repository): string {
        return repository.defaultBranchRef && repository.defaultBranchRef.name || 'master';
    }
    export function equals(repository: Repository, repository2: Repository): boolean {
        return repository.name === repository2.name && repository.owner.login === repository2.owner.login;
    }
}

export interface RepositoryConnection {
    nodes: Repository[]
    pageInfo: PageInfo
    totalCount: number
}

export interface RefConnection {
    nodes: Ref[]
    pageInfo: PageInfo
}

export interface Node {
    id: string
}

export interface GitObject {
    abbreviatedOid: string
    oid: string
}

export interface PageInfo {
    endCursor: string
    hasNextPage: boolean
    hasPreviousPage: boolean
    startCursor: string
}

/**
 * Specifies a review comment to be left with a Pull Request Review.
 */
export interface DraftPullRequestReviewComment {
    /**
     * Body of the comment to leave.
     */
    body: string
    /**
     * Path to the file being commented on.
     */
    path: string
    /**
     * Position in the file to leave a comment on.
     */
    position: number
}

/**
 * The possible events to perform on a pull request review.
 */
export enum PullRequestReviewEvent {
    /**
     * Submit feedback and approve merging these changes.
     */
    APPROVE = 'APPROVE',
    /**
     * Submit general feedback without explicit approval.
     */
    COMMENT = 'COMMENT',
    /**
     * Dismiss review so it now longer effects merging.
     */
    DISMISS = 'DISMISS',
    /**
     * Submit feedback that must be addressed before merging.
     */
    REQUEST_CHANGES = 'REQUEST_CHANGES'
}

export interface AddPullRequestReview {
    /**
     * A unique identifier for the client performing the mutation.
     */
    clientMutationId?: string
    /**
     * The newly created pull request review.
     */
    pullRequestReview: PullRequestReview
}
export namespace AddPullRequestReview {
    export interface Params {
        /**
         * The contents of the review body comment.
         */
        body?: string
        /**
         * A unique identifier for the client performing the mutation.
         */
        clientMutationId?: string
        /**
         * The review line comments.
         */
        comments?: DraftPullRequestReviewComment[]
        /**
         * The commit OID the review pertains to.
         */
        commitOID?: string
        /**
         * The event to perform on the pull request review.
         */
        event?: PullRequestReviewEvent
        /**
         * The Node ID of the pull request to modify.
         */
        pullRequestId: string
    }
    export interface Result {
        addPullRequestReview: AddPullRequestReview
    }
}

export interface SubmitPullRequestReview {
    /**
     * A unique identifier for the client performing the mutation.
     */
    clientMutationId?: string
    /**
     * The submitted pull request review.
     */
    pullRequestReview: PullRequestReview
}
export namespace SubmitPullRequestReview {
    export interface Params {
        /**
         * The text field to set on the Pull Request Review.
         */
        body?: string
        /**
         * A unique identifier for the client performing the mutation.
         */
        clientMutationId?: string
        /**
         * The event to send to the Pull Request Review.
         */
        event: PullRequestReviewEvent
        /**
         * The Pull Request Review ID to submit.
         */
        pullRequestReviewId: string
    }
    export interface Result {
        submitPullRequestReview: SubmitPullRequestReview
    }
}

export interface DeletePullRequestReview {
    /**
     * A unique identifier for the client performing the mutation.
     */
    clientMutationId?: string
    /**
     * The deleted pull request review.
     */
    pullRequestReview: PullRequestReview
}
export namespace DeletePullRequestReview {
    export interface Params {
        /**
         * A unique identifier for the client performing the mutation.
         */
        clientMutationId?: string
        /**
         * The Node ID of the pull request review to delete.
         */
        pullRequestReviewId: string
    }
    export interface Result {
        deletePullRequestReview: DeletePullRequestReview
    }

}

export interface AddPullRequestReviewComment {
    /**
     * A unique identifier for the client performing the mutation.
     */
    clientMutationId?: string
    /**
     * The newly created comment.
     */
    comment: PullRequestReviewComment
}
export namespace AddPullRequestReviewComment {
    export interface Params {
        /**
         * The text of the comment.
         */
        body: string
        /**
         * The Node ID of the review to modify.
         */
        pullRequestReviewId: string
        /**
         * The SHA of the commit to comment on.
         */
        commitOID?: string
        /**
         * The comment id to reply to.
         */
        inReplyTo?: string
        /**
         * The relative path of the file to comment on.
         */
        path?: string
        /**
         * The line index in the diff to comment on.
         */
        position?: number
        /**
         * A unique identifier for the client performing the mutation.
         */
        clientMutationId?: string
    }
    export interface Result {
        addPullRequestReviewComment: AddPullRequestReviewComment
    }
}

export interface UpdatePullRequestReviewComment {
    /**
     * A unique identifier for the client performing the mutation.
     */
    clientMutationId?: string
    /**
     * The updated comment.
     */
    pullRequestReviewComment: PullRequestReviewComment
}
export namespace UpdatePullRequestReviewComment {
    export interface Params {
        /**
         * The text of the comment.
         */
        body: string
        /**
         * A unique identifier for the client performing the mutation.
         */
        clientMutationId?: string
        /**
         * The Node ID of the comment to modify.
         */
        pullRequestReviewCommentId: string
    }
    export interface Result {
        updatePullRequestReviewComment: UpdatePullRequestReviewComment
    }
}
