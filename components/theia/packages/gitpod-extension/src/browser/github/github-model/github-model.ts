/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { ArrayExt } from "@phosphor/algorithm";
import { CancellationToken } from "@theia/core/lib/common/cancellation";
import { MessageService } from "@theia/core/lib/common/message-service";
import { GitRepositoryTracker } from "@theia/git/lib/browser/git-repository-tracker";
import URI from "@theia/core/lib/common/uri";
import { Git, Repository as GitRepository } from "@theia/git/lib/common";
import { GitHubEndpoint } from "./github-endpoint";
import { PullRequestReviewComment, PullRequestReview, PullRequest, PullRequestReviewEvent, PullRequestTimelineItem, DraftPullRequestReviewComment } from "./github-protocol";
import * as protocol from "./github-protocol";
import { GitHubRestApi, ReposCompareCommitsResult } from "./github-rest-api";
import { GitHubData } from "./github-data";
import { GitHubFile } from "./github-file";
import { BatchLoader } from "./batch-loader";
import { parsePatch } from "diff";
import { ForksLoader } from "../../githoster/fork/forks-loader";
import { Repository } from "../../githoster/model/types";
import { GitHubError, GitHub } from "./github";
import { github } from "../github-decorators";
import { GitHosterModel } from "../../githoster/model/githoster-model";

export interface CreatePullRequestParams {
    title: string
    body?: string
    maintainerCanModify?: boolean
}

export type AddPendingPullRequestReviewCommentParams = {
    body: string,
    to: PullRequestReviewComment
} | {
    body: string,
    path: string,
    diffPosition: number
}

export interface UpdatePullRequestReviewCommentParams {
    body: string,
    comment: PullRequestReviewComment
}

export interface DeletePullRequestReviewCommentParams {
    comment: PullRequestReviewComment
}

export interface SubmitPullRequestReviewParams {
    event: PullRequestReviewEvent
    body: string
}

export interface AddPullRequestReviewParams {
    event?: PullRequestReviewEvent
    body?: string
    comments?: DraftPullRequestReviewComment[]
}

export interface SubmitPendingPullRequestReviewParams {
    event: PullRequestReviewEvent
    body?: string
}

@injectable()
export class GitHubModel extends GitHosterModel {

    protected static EMPTY_LINE_NUMBER_MAP: ReadonlyMap<number, any> = new Map<number, any>();

    @inject(GitHubRestApi) protected readonly restApi: GitHubRestApi;

    @inject(GitHubEndpoint) protected readonly endpoint: GitHubEndpoint;
    @inject(Git) protected readonly git: Git;
    @inject(GitRepositoryTracker) protected readonly gitRepository: GitRepositoryTracker;

    @inject(ForksLoader) @github protected readonly forks: ForksLoader;
    @inject(MessageService) protected readonly messageService: MessageService;

    get upstreamBranch(): string | undefined {
        const { selectedRepositoryStatus } = this.gitRepository;
        return selectedRepositoryStatus && selectedRepositoryStatus.upstreamBranch;
    }

    // TODO should be part of the data ?
    protected _pullRequest: PullRequest | undefined;
    get pullRequest(): PullRequest | undefined {
        return this._pullRequest;
    }

    // TODO should be part of the data?
    protected _pendingPullRequestReview: PullRequestReview | undefined;
    get pendingPullRequestReview(): PullRequestReview | undefined {
        return this._pendingPullRequestReview;
    }

    protected data = new GitHubData();

    getDiffPosition(kind: GitHubFile.Kind, path: string, lineNumber: number): number | undefined {
        return this.data.getDiffPosition(kind, path, lineNumber);
    }

    get timeline(): ReadonlyArray<PullRequestTimelineItem> {
        return this.data.timeline;
    }
    get pendingComments(): PullRequestReviewComment[] {
        return this.data.pendingComments;
    }

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    async createPullRequest(params: CreatePullRequestParams): Promise<void> {
        const compareParams = this.restCompareParams({
            includeRenamed: true
        });
        if (this.pullRequest || !compareParams) {
            return;
        }
        const result = await this.restApi.run<{ number: number }>(api => api.pulls.create({
            ...compareParams,
            title: params.title,
            body: params.body,
            maintainer_can_modify: params.maintainerCanModify
        }));
        this.refresh({
            kind: 'pr',
            owner: compareParams.owner,
            repository: compareParams.repo,
            pullRequest: result.data.number
        });
    }

    async getMyLogin() {
        return (await this.restApi.getMyLogin()).data.login;
    }

    async getAuthorizedOrganizations(): Promise<string[]> {
        return (await this.restApi.getAuthorizedOrganizations()).data.map(item => item.login);
    }

    async hasWritePermission(owner: string, repo: string): Promise<boolean> {
        return this.restApi.hasWritePermission(owner, repo);
    }

    async addSinglePullRequestReviewComment(params: AddPendingPullRequestReviewCommentParams): Promise<void> {
        await this.doAddPullRequestReview();
        await this.doAddPendingPullRequestReviewComment(params);
        await this.submitPendingPullRequestReview({ event: PullRequestReviewEvent.COMMENT });
    }

    async startPullRequestReview(params: AddPendingPullRequestReviewCommentParams): Promise<void> {
        await this.doAddPullRequestReview();
        await this.addPendingPullRequestReviewComment(params);
    }

    async submitPullRequestReview(params: SubmitPullRequestReviewParams): Promise<void> {
        if (this.pendingPullRequestReview) {
            await this.submitPendingPullRequestReview(params);
        } else {
            await this.addPullRequestReview(params);
        }
    }

    async addPullRequestReview(params: AddPullRequestReviewParams = {}): Promise<void> {
        await this.doAddPullRequestReview(params);
        // FIXME get rid of refresh?
        this.refresh();
    }
    protected async doAddPullRequestReview(params: AddPullRequestReviewParams = {}): Promise<void> {
        if (!this.pullRequest) return;

        const pullRequestId = this.pullRequest.id;
        const query = await this.endpoint.addPullRequestReview({ pullRequestId, ...params });
        if (query.data) {
            const { addPullRequestReview } = query.data;
            const pullRequestReview = addPullRequestReview.pullRequestReview;
            this._pendingPullRequestReview = PullRequestReview.getPending(pullRequestReview);
            this.fireDidChange();
        } else {
            throw GitHubError.create('Failed to add a pull request review\n' + JSON.stringify(query, undefined, 2), query);
        }
    }

    async submitPendingPullRequestReview(params: SubmitPendingPullRequestReviewParams): Promise<void> {
        await this.doSubmitPendingPullRequestReview(params);
        // FIXME get rid of refresh?
        this.refresh();
    }
    protected async doSubmitPendingPullRequestReview(params: SubmitPendingPullRequestReviewParams): Promise<void> {
        if (!this.pendingPullRequestReview) return;
        const pullRequestReviewId = this.pendingPullRequestReview.id;
        const query = await this.endpoint.submitPullRequestReview({ pullRequestReviewId, ...params });
        if (query.data) {
            const { submitPullRequestReview } = query.data;
            const pullRequestReview = submitPullRequestReview.pullRequestReview;
            this._pendingPullRequestReview = PullRequestReview.getPending(pullRequestReview);
            this.fireDidChange();
        } else {
            throw GitHubError.create('Failed to submit a pull request review\n' + JSON.stringify(query, undefined, 2), query);
        }
    }

    async deletePendingPullRequestReview(): Promise<void> {
        await this.doDeletePendingPullRequestReview();
        // FIXME get rid of refresh?
        this.refresh();
    }
    protected async doDeletePendingPullRequestReview(): Promise<void> {
        if (!this.pendingPullRequestReview) return;
        const pullRequestReviewId = this.pendingPullRequestReview.id;
        const query = await this.endpoint.deletePullRequestReview({ pullRequestReviewId });
        if (query.data) {
            const { deletePullRequestReview } = query.data;
            const pullRequestReview = deletePullRequestReview.pullRequestReview;
            this._pendingPullRequestReview = PullRequestReview.getPending(pullRequestReview);
            this.fireDidChange();
        } else {
            throw GitHubError.create('Failed to delete a pull request review\n' + JSON.stringify(query, undefined, 2), query);
        }
    }

    async addPendingPullRequestReviewComment(params: AddPendingPullRequestReviewCommentParams): Promise<void> {
        await this.doAddPendingPullRequestReviewComment(params);
        // FIXME get rid of refresh?
        this.refresh();
    }
    protected async doAddPendingPullRequestReviewComment(params: AddPendingPullRequestReviewCommentParams): Promise<void> {
        if (!this.pendingPullRequestReview) return;
        const pullRequestReviewId = this.pendingPullRequestReview.id;

        const { to, body, path, diffPosition } = {
            to: undefined,
            path: undefined,
            diffPosition: undefined,
            ...params
        };

        const position = diffPosition;
        const inReplyTo = to ? to.id : undefined;
        const query = await this.endpoint.addPullRequestReviewComment({ body, inReplyTo, pullRequestReviewId, path, position });
        if (query.data) {
            this.data.pushComment(query.data.addPullRequestReviewComment.comment);
            this.fireDidChange();
        } else {
            throw GitHubError.create('Failed to add pull request comment\n' + JSON.stringify(query, undefined, 2), query);
        }
    }

    async updatePullRequestReviewComment(params: UpdatePullRequestReviewCommentParams): Promise<void> {
        await this.doUpdatePullRequestReviewComment(params);
        // FIXME get rid of refresh?
        this.refresh();
    }
    protected async doUpdatePullRequestReviewComment(params: UpdatePullRequestReviewCommentParams): Promise<void> {
        const body = params.body;
        const pullRequestReviewCommentId = params.comment.id;
        const query = await this.endpoint.updatePullRequestReviewComment({ body, pullRequestReviewCommentId })
        if (query.data) {
            this.data.pushComment(query.data.updatePullRequestReviewComment.pullRequestReviewComment);
            this.fireDidChange();
        } else {
            throw GitHubError.create('Failed to add pull request comment\n' + JSON.stringify(query, undefined, 2), query);
        }
    }

    async deletePullRequestReviewComment(params: DeletePullRequestReviewCommentParams): Promise<void> {
        await this.doDeletePullRequestReviewComment(params);
        // FIXME get rid of refresh?
        this.refresh();
    }
    protected async doDeletePullRequestReviewComment(params: DeletePullRequestReviewCommentParams): Promise<void> {
        const pullRequest = this.pullRequest;
        const datasetId = params.comment.databaseId;
        if (!pullRequest || !datasetId) {
            return;
        }
        const owner = pullRequest.repository.owner.login;
        const repo = pullRequest.repository.name;
        const comment_id = datasetId;
        await this.restApi.run(api => api.pulls.deleteComment({ owner, repo, comment_id }));

        this.data.deleteComment(params.comment);
        this.fireDidChange();
    }

    get paths(): ReadonlySet<string> {
        return this.data.paths;
    }
    getLineNumbers(path: string): number[] {
        return this.data.getLineNumbers(path);
    }
    getLineConversations(path: string, lineNumber: number): GitHubData.Conversation[] {
        return this.data.getLineConversations(path, lineNumber);
    }
    get conversationCount(): number {
        return this.data.conversationCount;
    }

    get lastCommit(): GitHubData.Commit | undefined {
        return this.data.lastCommit;
    }
    get commitCount(): number {
        return this.pullRequest ? this.pullRequest.commits.totalCount : this.data.commitCount;
    }
    get hasChanges(): boolean {
        return this.data.hasChanges;
    }

    protected refreshParams: GitHubModel.RefreshParams | undefined;
    protected reset(refreshParams?: GitHubModel.RefreshParams): void {
        this.refreshParams = refreshParams;
        this.compareParams = undefined;
        this.revisions = Promise.resolve({});
        this.diffOptions = Promise.resolve(GitHubModel.DiffOptions.create());
    }
    get empty(): boolean {
        return !this.refreshParams && !this.compareParams;
    }
    async clean(): Promise<void> {
        if (this.empty) {
            return;
        }
        this.reset();
        await this.refresh();
    }
    protected _refreshing: number = 0;
    get refreshing(): boolean {
        return !!this._refreshing;
    }
    protected incrementRefreshing(): void {
        this._refreshing++;
        this.onDidRefreshChangedEmitter.fire(undefined);
    }
    protected decrementRefreshing(): void {
        this._refreshing--;
        this.onDidRefreshChangedEmitter.fire(undefined);
    }
    async refresh(params?: GitHubModel.RefreshParams): Promise<void> {
        // FIXME it should be cancellable
        if (params) {
            this.reset(params);
        }
        this.incrementRefreshing();
        try {
            await this.doRefresh();
        } catch (e) {
            console.error(e.message, e);
        } finally {
            this.decrementRefreshing();
        }
        this.fireDidChange();
    }
    protected async doRefresh(): Promise<void> {
        const data = new GitHubData();
        await this.refreshCompareParams();
        await this.refreshPullRequest();
        this.revisions = this.resolveRevisions();
        const diffOptions = this.resolveDiffOptions();

        data.pushCompare(await this.compare());
        const loader = new BatchLoader(this.endpoint);
        this.refreshReviews(data, loader);
        this.refreshTimeline(data, loader);
        await loader.load();

        this.data = data;
        // TODO handle pending pull request as a part of the data
        this._pendingPullRequestReview = ArrayExt.findLastValue(this.data.timeline as any[], PullRequestReview.isPending);

        this.diffOptions = diffOptions;
    }
    protected async refreshPullRequest(): Promise<void> {
        const pullRequest = await this.getPullRequest();
        this._pullRequest = pullRequest;
        if (pullRequest) {
            const { repository, baseRef, headRef, number } = pullRequest;
            this.refreshParams = {
                kind: 'pr',
                owner: repository.owner.login,
                repository: repository.name,
                pullRequest: number
            };
            this.compareParams = GitHubModel.CompareParams.fromProtocol(baseRef, headRef);
        }
    }
    protected async getPullRequest(): Promise<PullRequest | undefined> {
        const options = await this.getPullRequestOptions();
        if (!options) {
            return undefined;
        }
        const { data } = await this.endpoint.getPullRequest(options);
        const pullRequest = data && data.repository && data.repository.pullRequest;
        if (pullRequest && pullRequest.state === protocol.PullRequestState.OPEN) {
            return pullRequest;
        }
        return undefined;
    }
    protected async getPullRequestOptions(): Promise<GitHubEndpoint.GetPullRequestOptions | undefined> {
        if (GitHubModel.PullRequestRefreshParams.is(this.refreshParams)) {
            return this.refreshParams;
        }
        if (this.compareParams) {
            const pullRequest = await this.findPullRequestNumber();
            if (typeof pullRequest === "number") {
                const { owner, name } = this.compareParams.base.repository;
                return { owner, repository: name, pullRequest };
            }
            return undefined;
        }
        return undefined;
    }
    protected async findPullRequestNumber(): Promise<number | undefined> {
        const params = this.restCompareParams({
            includeRenamed: true
        });
        if (!params) {
            return undefined;
        }
        const result = await this.restApi.run<{ number: number }[]>(api => api.pulls.list({ ...params, per_page: 1 }));
        return result.data[0] && result.data[0].number;
    }

    protected refreshTimeline(ghData: GitHubData, loader: BatchLoader): void {
        const pullRequest = this._pullRequest;
        if (!pullRequest) {
            return;
        }
        const batch = (options: GitHubEndpoint.PullRequestOptions) => {
            loader.batch<PullRequest>(this.endpoint.createGetTimelineQuery(options), (result, error) => {
                if (result) {
                    const { timeline } = result;
                    ghData.timeline.push(...timeline.nodes);
                    if (timeline.pageInfo.hasNextPage) {
                        batch({
                            ...options,
                            cursor: timeline.pageInfo.endCursor
                        });
                    }
                }
            });
        }
        batch({ pullRequestId: pullRequest.id });
    }
    protected refreshReviews(ghData: GitHubData, loader: BatchLoader): void {
        const pullRequest = this._pullRequest;
        if (!pullRequest) {
            return;
        }
        const batch = (options: GitHubEndpoint.PullRequestOptions) => {
            loader.batch<PullRequest>(this.endpoint.createGetReviewsQuery(options), (data) => {
                if (!data) {
                    return;
                }
                const { reviews } = data;
                for (const review of reviews.nodes) {
                    this.refreshReviewComments(review, ghData, loader);
                }
                if (reviews.pageInfo.hasNextPage) {
                    batch({
                        ...options,
                        cursor: reviews.pageInfo.endCursor
                    });
                }
            });
        }
        batch({ pullRequestId: pullRequest.id });
    }
    protected refreshReviewComments(review: PullRequestReview, ghData: GitHubData, loader: BatchLoader): void {
        const batch = (options: GitHubEndpoint.ReviewOptions) => {
            loader.batch<PullRequestReview>(this.endpoint.createGetReviewCommentsQuery(options), (data) => {
                if (!data) {
                    return;
                }
                const { comments } = data;
                ghData.pushComments(comments.nodes);
                if (comments.pageInfo.hasNextPage) {
                    batch({
                        ...options,
                        cursor: comments.pageInfo.endCursor
                    });
                }
            });
        }
        batch({ reviewId: review.id });
    }

    getPath(uri: URI): string | undefined {
        return this.gitRepository.getPath(uri);
    }

    getUri(path: string): URI | undefined {
        return this.gitRepository.getUri(path);
    }

    getModifiedPath(originalPath: string): string | undefined {
        const file = this.data.getFile('original', originalPath);
        return file && file.modified!.path;
    }
    getOriginalPath(modifiedPath: string): string | undefined {
        const file = this.data.getFile('modified', modifiedPath);
        return file && file.original!.path;
    }

    async renderMarkdown(text: string): Promise<string> {
        const context = GitHubModel.RefreshParams.getRepository(this.refreshParams);

        const result = await this.restApi.run<string>(api => api.markdown.render({
            text,
            mode: "gfm",
            context
        }));
        return result.data;
    }

    protected compareParams: GitHubModel.CompareParams | undefined;
    /**
     * IMPORTANT
     * - the base ref should be short in the base repository otherwise GH returns nothing
     * - the head ref should be full regardless of the base repository otherwise GH returns everything
     */
    protected restCompareParams({ includeRenamed }: { includeRenamed: boolean } = { includeRenamed: false }): GitHub.ReposCompareCommitsParams | undefined {
        if (this.compareParams) {
            const { owner, name } = this.compareParams.base.repository;
            const base = this.compareParams.base.name;
            const renamed = includeRenamed && this.compareParams.base.repository.name !== this.compareParams.head.repository.name;
            const head = this.compareParams.head.toString({ renamed });
            return { owner, repo: name, base, head };
        }
    }
    get base(): GitHubModel.Ref | undefined {
        return this.compareParams && this.compareParams.base;
    }
    get head(): GitHubModel.Ref | undefined {
        return this.compareParams && this.compareParams.head;
    }
    get commonParentCommit(): string | undefined {
        return this.data.getCommonParentCommit;
    }
    protected async compare(): Promise<ReposCompareCommitsResult> {
        const nullResult: ReposCompareCommitsResult = { files: [], commits: [] };
        try {
            const { repository, baseRevision, headRevision } = await this.revisions;
            if (!repository || !baseRevision || !headRevision) {
                return nullResult;
            }
            const commonParentCommit = await this.checkForCommonParentCommit(repository, baseRevision, headRevision);
            if (!commonParentCommit) {
                // In this case don't compute the diff as it's expensive and rather meaningless.
                // Note: GitHub does similar: it says "master and development are entirely different commit histories."
                // and shows the diff only for files that are present in both branches (TODO?).
                return { commonParentCommit, commits: [], files: [] };
            }

            const files = await this.diff(repository, baseRevision, headRevision);
            const commits = await this.log(repository, baseRevision, headRevision);
            return { commonParentCommit, commits, files };
        } catch (e) {
            console.error('Failed to compare:', e);
            return nullResult;
        }
    }
    protected async checkForCommonParentCommit(repository: GitRepository, baseRevision: string, headRevision: string): Promise<string | undefined> {
        // git merge-base returns the best common ancestor of the given commits. Returns nothing if there is no common ancestor.
        const mergeBase = await this.git.exec(repository, ['merge-base', baseRevision, headRevision]);
        const result = mergeBase.stdout.trim();
        if (result.length === 0) {
            return undefined;
        }
        return result;
    }
    protected async diff(repository: GitRepository, baseRevision: string, headRevision: string): Promise<ReposCompareCommitsResult.File[]> {
        if (baseRevision === headRevision) {
            return [];
        }
        const diff = await this.git.exec(repository, ['diff', '--no-color', '--no-prefix', `${baseRevision}...${headRevision}`]);
        const output = diff.stdout.trim();
        if (output.length === 0) {
            return [];
        }
        return parsePatch(diff.stdout.trim()).map(({ oldFileName, newFileName, hunks }) => ({
            filename: newFileName,
            previous_filename: oldFileName !== '/dev/null' && oldFileName !== newFileName ? oldFileName : undefined,
            hunks
        }));
    }
    protected async log(repository: GitRepository, baseRevision: string, headRevision: string): Promise<ReposCompareCommitsResult.Commit[]> {
        if (baseRevision === headRevision) {
            return [];
        }
        const bodyDelimiter = '<<<GITPOD_RULEZZZZZZ>>>';
        const log = (await this.git.exec(repository, ['log', `--pretty=format:%H%n%B${bodyDelimiter}`, `${baseRevision}..${headRevision}`]));
        const rawCommits = log.stdout.split(bodyDelimiter);
        rawCommits.splice(rawCommits.length - 1, 1)
        return rawCommits.reverse().map(rawCommit => {
            const index = rawCommit.indexOf('\n');
            const sha = rawCommit.substring(0, index);
            const message = rawCommit.substring(index + 1);
            return {
                sha,
                commit: {
                    message
                }
            };
        });
    }

    async resolvePullRequestTemplate(): Promise<string | undefined> {
        if (!this.compareParams) {
            return undefined;
        }
        const base = this.compareParams.base;
        const owner = base.repository.owner;
        const repo = base.repository.name;
        const api = await this.restApi.create({ permissions: undefined, previews: [ "black-panther" ]});
        try {
            const result = await api.repos.retrieveCommunityProfileMetrics({ owner, repo });
            const template = result.data.files && result.data.files.pull_request_template;
            const templateUrl = template && template.url;
            if (!templateUrl) {
                return undefined;
            }
            const path = templateUrl.split("/contents/")[1];
            if (typeof path !== "string") {
                return undefined;
            }
            const contentsResult = await api.repos.getContents({ owner, repo, path });
            if (!Array.isArray(contentsResult.data) && contentsResult.data.content) {
                return atob(contentsResult.data.content);
            } else {
                return undefined;
            }
        } catch {
            // usually no template is found
            return undefined;
        }
    }

    protected async refreshCompareParams(): Promise<void> {
        if (GitHubModel.CompareRefreshParams.is(this.refreshParams)) {
            const base = await this.getBase(this.refreshParams);
            if (base) {
                this.compareParams = GitHubModel.CompareParams.fromRaw(base, this.refreshParams.head);
            }
        }
    }
    protected async getBase({ base, head }: GitHubModel.CompareRefreshParams): Promise<GitHubModel.RawRef | undefined> {
        const headRepo = await this.forks.getRepository(head.owner, head.repository);
        const headParent = headRepo && headRepo.parent || headRepo;
        if (!headParent) {
            return undefined;
        }
        if (base) {
            const headSource = headRepo && headRepo.source || headParent;
            const baseRepo = await this.forks.getRepository(base.owner, base.repository);
            const baseSource = baseRepo && (baseRepo.source || baseRepo.parent) || baseRepo;
            if (baseSource && headSource.id === baseSource.id && this.existBranch(base)) {
                return base;
            }
        }
        return {
            owner: headParent.owner.login,
            repository: headParent.name,
            refName: headParent.default_branch || 'master'
        };
    }
    protected async existBranch(ref: GitHubModel.RawRef): Promise<boolean> {
        try {
            await this.restApi.run(api => api.repos.getBranch({
                owner: ref.owner,
                repo: ref.repository,
                branch: ref.refName
            }));
            return true;
        } catch (e) {
            if (e && 'code' in e && e.code === 404) {
                return false;
            }
            throw e;
        }
    }

    async getForks(acceptor: (fork: Repository) => void, token: CancellationToken): Promise<void> {
        const base = this.compareParams && this.compareParams.base;
        const baseRepository = base && base.repository;
        if (!baseRepository) {
            return;
        }
        const { owner, name } = baseRepository;
        await this.forks.getForks(owner, name, acceptor, token);
    }

    async getBranches(repository: Repository): Promise<string[]> {
        const result: string[] = [];
        await this.endpoint.fetchForward(async cursor => {
            const query = await this.endpoint.getBranches({
                cursor,
                owner: repository.owner,
                repository: repository.name
            });
            if (query.data) {
                const refs = query.data.repository!.refs;
                refs.nodes.forEach(({ name }) => result.push(name));
                return refs.pageInfo;
            } else {
                throw GitHubError.create('Failed to fetch branches\n' + JSON.stringify(query, undefined, 2), query);
            }
        });
        return result;
    }

    protected diffOptions: Promise<GitHubModel.DiffOptions> = Promise.resolve(GitHubModel.DiffOptions.create());
    getDiffOptions(): Promise<GitHubModel.DiffOptions> {
        return this.diffOptions;
    }
    protected async resolveDiffOptions(): Promise<GitHubModel.DiffOptions> {
        const pullRequest = this.pullRequest;
        const mergeBase = await this.findMergeBase();
        return GitHubModel.DiffOptions.create({
            pullRequest,
            mergeBase
        });
    }
    protected async findMergeBase(): Promise<string | undefined> {
        try {
            const { repository, baseRevision } = await this.revisions;
            if (!repository || !baseRevision) {
                return undefined;
            }
            const result = await this.git.exec(repository, ['merge-base', `${baseRevision}`, 'HEAD']);
            return result && result.stdout.trim();
        } catch (e) {
            return undefined;
        }
    }

    protected revisions: Promise<GitHubModel.Fetch> = Promise.resolve({});
    protected async resolveRevisions(): Promise<GitHubModel.Fetch> {
        const base = this.compareParams && this.compareParams.base;
        const head = this.compareParams && this.compareParams.head;
        const repository = this.gitRepository.selectedRepository;
        if (!repository || !base || !head) {
            return {};
        }
        const baseRemote = await this.findRemote(repository, base.repository.fullName);
        if (baseRemote) {
            await this.fetchRef(repository, baseRemote, base.name);
        }
        const headRemote = base.crossRepository ? await this.findRemote(repository, head.repository.fullName) : baseRemote;
        if (headRemote && base.crossRepository) {
            await this.fetchRef(repository, headRemote, head.name);
        }
        const baseRevision = baseRemote && base && `${baseRemote}/${base.name}`;
        const headRevision = headRemote && head && `${headRemote}/${head.name}`;
        return { repository, baseRevision, headRevision };
    }
    protected async findRemote(repository: GitRepository, repositoryName: string): Promise<string | undefined> {
        const remotes = await this.git.remote(repository);
        for (const remote of remotes) {
            try {
                const remoteUrlResult = await this.git.exec(repository, ["remote", "get-url", remote]);
                if (remoteUrlResult.stdout.indexOf(repositoryName) !== -1) {
                    return remote;
                }
            } catch (e) { /*no-op*/ }
        }
        return undefined
    }
    protected async fetchRef(repository: GitRepository, remote: string, refspec: string): Promise<void> {
        try {
            await this.git.exec(repository, ['fetch', remote, refspec]);
        } catch (e) {
            console.error(e);
        }
    }

    async merge({ mergeMethod }: {
        mergeMethod: "merge" | "squash" | "rebase"
    }): Promise<void> {
        const pullRequest = this.pullRequest;
        if (!pullRequest) {
            return;
        }
        const { number, repository } = pullRequest;
        const owner = repository.owner.login;
        const repo = repository.name;
        await this.restApi.run(api => api.pulls.merge({
            number, owner, repo,
            merge_method: mergeMethod
        }));
        this.refresh();
    }

}
export namespace GitHubModel {
    export interface DiffOptions extends Git.Options.Diff {
        kind: 'pullRequest'
        pullRequest?: PullRequest
    }
    export namespace DiffOptions {
        export function create({ pullRequest, mergeBase }: {
            pullRequest?: PullRequest
            mergeBase?: string
        } = {}): DiffOptions {
            return {
                kind: 'pullRequest',
                pullRequest,
                range: typeof mergeBase === 'string' && { fromRevision: mergeBase } || undefined
            };
        }
        export function is(options: Git.Options.Diff): options is DiffOptions {
            return 'kind' in options && (<any>options)['kind'] === 'pullRequest';
        }
    }
    export interface RawRef {
        owner: string
        repository: string
        refName: string
    }
    export interface GitHubIssue {
        nr: number,
        owner: string,
        repository: string
    }
    export type RefreshParams = CompareRefreshParams | PullRequestRefreshParams;
    export namespace RefreshParams {
        export function getOwner(params: RefreshParams | undefined): string | undefined {
            return params && (params.kind === 'compare' ? params.head.owner : params.owner);
        }
        export function getRepository(params: RefreshParams | undefined): string | undefined {
            return params && (params.kind === 'compare' ? params.head.repository : params.repository);
        }
    }
    export interface CompareRefreshParams {
        kind: 'compare',
        head: GitHubModel.RawRef
        base?: GitHubModel.RawRef
    }
    export namespace CompareRefreshParams {
        export function is(params: RefreshParams | undefined): params is CompareRefreshParams {
            return !!params && params.kind === 'compare';
        }
    }
    export interface PullRequestRefreshParams {
        kind: 'pr',
        owner: string
        repository: string
        pullRequest: number
    }
    export namespace PullRequestRefreshParams {
        export function is(params: RefreshParams | undefined): params is PullRequestRefreshParams {
            return !!params && params.kind === 'pr';
        }
    }
    export class Ref {
        constructor(
            readonly name: string,
            readonly repository: Repository,
            readonly crossRepository: boolean
        ) { }
        get fullName() {
            return this.repository.owner + ':' + this.name;
        }
        get shortName() {
            return this.crossRepository ? this.fullName : this.name;
        }
        get raw(): RawRef {
            return {
                repository: this.repository.name,
                owner: this.repository.owner,
                refName: this.name
            }
        }
        toString({ renamed }: { renamed: boolean } = { renamed: false }): string {
            if (renamed) {
                return this.repository.fullName + ':' + this.name;
            }
            return this.fullName;
        }
        static fromRaw(ref: RawRef, crossRepository: boolean): Ref {
            return new Ref(ref.refName, new Repository(ref.repository, ref.owner), crossRepository);
        }
        static fromProtocol(ref: protocol.Ref, crossRepository: boolean): Ref {
            return new GitHubModel.Ref(ref.name, new Repository(ref.repository.name, ref.repository.owner.login), crossRepository);
        }
    }
    export interface CompareParams {
        base: Ref
        head: Ref
    }
    export namespace CompareParams {
        export function fromRaw(base: RawRef, head: RawRef): CompareParams {
            const crossRepository = base.repository !== head.repository || base.owner !== head.owner;
            return {
                base: Ref.fromRaw(base, crossRepository),
                head: Ref.fromRaw(head, crossRepository)
            };
        }
        export function fromProtocol(base: protocol.Ref | null, head: protocol.Ref | null): CompareParams | undefined {
            if (base && head) {
                const crossRepository = base.repository.name !== head.repository.name || base.repository.owner.login !== head.repository.owner.login;
                return {
                    base: Ref.fromProtocol(base, crossRepository),
                    head: Ref.fromProtocol(head, crossRepository)
                };
            }
            return undefined;
        }
    }
    export interface Fetch {
        repository?: GitRepository,
        baseRevision?: string,
        headRevision?: string
    }
}