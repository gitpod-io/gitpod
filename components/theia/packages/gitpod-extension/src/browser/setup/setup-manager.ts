/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import URI from "@theia/core/lib/common/uri";
import * as YAML from "yaml";
import { Git } from "@theia/git/lib/common";
import { injectable, inject } from "inversify";
import { EditorManager, EditorWidget, EditorOpenerOptions } from "@theia/editor/lib/browser";
import { ConfigInferrer, FS } from "./config-inferrer";
import { GitpodInfoService } from "../../common/gitpod-info";
import { Path, CommandContribution, Command, CommandRegistry, MessageService, Progress, CancellationToken, CancellationTokenSource } from "@theia/core";
import { GitRepositoryProvider } from "@theia/git/lib/browser/git-repository-provider";
import { QuickPickService } from "@theia/core/lib/common/quick-pick-service";
import { MiniBrowserOpenHandler } from "@theia/mini-browser/lib/browser/mini-browser-open-handler";
import { GitHubModel } from "../github";
import { QuickOpenItem, QuickOpenService, QuickOpenOptions, QuickInputService } from "@theia/core/lib/browser";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { GitHosterCommand } from "../githoster/githoster-frontend-contribution";
import { GitHubExtension } from "../github/github-extension";
import { github } from "../github/github-decorators";
import { GitState } from "../githoster/git-state";
import { GitHosterModel } from "../githoster/model/githoster-model";
import { FileService } from "@theia/filesystem/lib/browser/file-service";

export const SetupManager = Symbol('SetupManager');
export interface SetupManager {
    hasConfig(): Promise<boolean>;
    hasReadmeConfig(): Promise<boolean>;
    hasImageConfig(): Promise<boolean>;

    createAndOpenConfig(): Promise<EditorWidget>;
    updateDockerConfig(): Promise<EditorWidget | undefined>;
    updateReadme(): Promise<EditorWidget>;
    testSetup(): Promise<void>;
}

export const gitpodSetupBranchName = "gitpod-setup"

@injectable()
export class SetupManagerImpl implements SetupManager, FS, CommandContribution {

    static SETUP_PROJECT: Command = {
        id: 'setup-project',
        label: 'Gitpod: Setup Project',
    };

    static ADD_BADGE: Command = {
        id: 'add-badge',
        label: 'Gitpod: Add Ready-To-Code Badge to README',
    };

    static CHANGE_DOCKER_IMAGE: Command = {
        id: 'change-image',
        label: 'Gitpod: Change Image Configuration in .gitpod.yml'
    }

    static TEST_RUN_SETUP: Command = {
        id: 'test-run-setup',
        label: 'Gitpod: Test the Setup'
    }

    @inject(FileService) private readonly fs: FileService;
    @inject(GitpodInfoService) private readonly infoService: GitpodInfoService;
    @inject(EditorManager) private readonly editors: EditorManager;
    @inject(Git) private readonly git: Git;
    @inject(GitRepositoryProvider) private repoProvider: GitRepositoryProvider;
    @inject(MessageService) private readonly messageService: MessageService;
    @inject(QuickPickService) private readonly quickPick: QuickPickService;
    @inject(QuickOpenService) private readonly quickOpenService: QuickOpenService;
    @inject(QuickInputService) private readonly quickInputService: QuickInputService;
    @inject(GitHosterModel) @github private readonly gitHubModel: GitHubModel;
    @inject(GitState) @github private readonly gitState: GitState;
    @inject(MiniBrowserOpenHandler) private miniBrowserOpenHandler: MiniBrowserOpenHandler;
    @inject(GitHubExtension) private gitHubExtension: GitHubExtension;
    @inject(CommandRegistry) private commands: CommandRegistry;

    private gitpodYml = '.gitpod.yml';
    private dockerFileName = '.gitpod.Dockerfile';

    protected standardDockerImages: { label: string, name: string, description: string }[] = [
        {
            label: "Default",
            name: 'gitpod/workspace-full',
            description: `Provides support for Python, Node.js, Java, C/C++, Go, Ruby, Rust, etc.`
        },
        {
            label: "Default + VNC",
            name: 'gitpod/workspace-full-vnc',
            description: `Allows to run native GUI applications.`
        },
        {
            label: "Default + MySQL",
            name: 'gitpod/workspace-mysql',
            description: `The workspace-full image with a MySQL database.`
        },
        {
            label: "Default + MongoDB",
            name: 'gitpod/workspace-mongodb',
            description: `The workspace-full image plus MongDB.`
        },
        {
            label: "Default + PostgreSQL",
            name: 'gitpod/workspace-postgres',
            description: `The workspace-full image plus PostgreSQL.`
        },
    ]

    async registerCommands(commands: CommandRegistry): Promise<void> {
        commands.registerCommand(SetupManagerImpl.SETUP_PROJECT, {
            execute: async () => {
                try {
                    return this.createAndOpenConfig();
                } catch (err) {
                    console.error(err);
                    this.messageService.error(err.toString());
                }
            }
        });
        commands.registerCommand(SetupManagerImpl.ADD_BADGE, {
            execute: async () => {
                try {
                    return await this.updateReadme();
                } catch (err) {
                    console.error(err);
                    this.messageService.error(err.toString());
                }
            }
        });
        commands.registerCommand(SetupManagerImpl.CHANGE_DOCKER_IMAGE, {
            execute: async () => {
                try {
                    return this.updateDockerConfig();
                } catch (err) {
                    console.error(err);
                    this.messageService.error(err.toString());
                }
            }
        });
        await this.gitHubExtension.initialized;
        commands.registerCommand(SetupManagerImpl.TEST_RUN_SETUP, {
            execute: async () => {
                try {
                    await this.testSetup();
                } catch (err) {
                    console.error(err);
                    this.messageService.error(err.toString());
                }
            },
            isVisible: () => this.gitHubExtension.enabled,
        });
    }

    async testSetup(): Promise<void> {
        await this.withProgress('Test Setup',
            async (progress, cancellationToken) => {
                if (!this.exists(this.gitpodYml)) {
                    this.messageService.error('Cannot test run the configuration. No .gitpod.yml found.');
                    return;
                }
                const myLogin = await this.gitHubModel.getMyLogin();
                const testbranch = myLogin + '/' + gitpodSetupBranchName;
                const total = 6;
                let done = 1;
                const repo = this.repoProvider.selectedRepository;
                if (!repo) {
                    throw new Error('No Git repository');
                }
                try {
                    await this.git.branch(repo, { toCreate: testbranch, });
                    progress.report({
                        message: `Branching to ${testbranch}`,
                        work: {
                            done: done++,
                            total
                        }
                    });
                } catch (err) {
                    // ignore, probably exists already
                }
                await this.git.checkout(repo, { branch: testbranch });
                const gpUri = await this.toURI(this.gitpodYml);
                const dockerUri = await this.toURI(this.dockerFileName);
                const filesToAdd = [gpUri.toString()];
                if (await this.exists(this.dockerFileName)) {
                    filesToAdd.push(dockerUri.toString());
                }
                const readme = await this.getReadMe().catch(() => "");
                if (readme != "" && await this.exists(readme)) {
                    filesToAdd.push((await this.toURI(readme)).toString());
                }
                try {
                    await this.git.add(repo, filesToAdd);
                } catch (err) {
                   this.messageService.error(`Error running "git add ${filesToAdd.join(' ')} "`);
                }
                try {
                    await this.git.commit(repo, 
`Fully automate dev setup with Gitpod

This commit implements a fully-automated development setup using Gitpod.io, an
online IDE for GitLab, GitHub, and Bitbucket that enables Dev-Environments-As-Code.
This makes it easy for anyone to get a ready-to-code workspace for any branch,
issue or pull request almost instantly with a single click.
`);
                    progress.report({
                        message: `Committing changes.`,
                        work: {
                            done: done++,
                            total
                        }
                    });
                } catch (err) {
                    progress.report({
                        message: `No changes to commit.`,
                        work: {
                            done: done++,
                            total
                        }
                    });
                }
                const currentOriginUrl = await this.gitState.getRemoteUrl("origin");
                if (!currentOriginUrl) {
                    throw new Error("Couldn't read `origin` remote url.");
                }
                const parsedRemoteUrl = this.gitState.parseRemoteUrl(currentOriginUrl);
                if (!parsedRemoteUrl) {
                    throw new Error("Couldn't parse owner/repo from `origin` remote url.");
                }
                const canWrite = await this.gitHubModel.hasWritePermission(parsedRemoteUrl.owner, parsedRemoteUrl.name);
                if (!canWrite) {
                    progress.report({
                        message: `Need to fork the project.`,
                        work: {
                            done: done++,
                            total
                        }
                    });
                    await this.commands.executeCommand(GitHosterCommand.fork.id);
                }

                progress.report({
                    message: `Pushing changes to remote`,
                    work: {
                        done: done++,
                        total
                    }
                });
                try {
                    await this.git.push(repo, {
                        remote: 'origin',
                        localBranch: testbranch,
                        setUpstream: true
                    });
                } catch (error) {
                    const forcePush = await this.quickPick.show<boolean>([
                        {
                            label: 'Force push branch "' + testbranch + '"',
                            value: true
                        },
                        {
                            label: 'Abort',
                            value: false
                        },
                    ],{
                        title: 'Push failed with: ' + error.toString()
                    })
                    if (!forcePush) {
                        this.messageService.info("Aborted test run.");
                        return;
                    }
                    await this.git.push(repo, {
                        remote: 'origin',
                        localBranch: testbranch,
                        setUpstream: true,
                        force: true
                    });
                }

                progress.report({
                    message: `Starting fresh workspace in preview`,
                    work: {
                        done: total,
                        total
                    }
                });
                const uri = `${await this.getContextUrl('origin')}/tree/${testbranch}`;
                // HACK minibrowser doesn't refresh if the url hasn't changed. So we set a different one first.
                await this.miniBrowserOpenHandler.openPreview(window.location.href);
                await this.miniBrowserOpenHandler.openPreview(uri);
            }
        );
    }

    private async getContextUrl(remote: string): Promise<string> {
        const repo = this.repoProvider.selectedRepository;
        if (!repo) {
            throw new Error('No git repository');
        }
        const info = await this.infoService.getInfo();
        const remoteUrlResult = await this.git.exec(repo, ["remote", "get-url", remote]);
        let remoteUrl = remoteUrlResult.stdout.trim();
        if (remoteUrl.endsWith('.git')) {
            remoteUrl = remoteUrl.slice(0, -4);
        }
        return `${info.host}/#${remoteUrl}`;
    }

    async hasConfig(): Promise<boolean> {
        const existsConfig = await this.exists(this.gitpodYml);
        return existsConfig;
    }

    async hasImageConfig(): Promise<boolean> {
        if (!await this.hasConfig()) {
            return false;
        }
        const config = await this.read(this.gitpodYml);
        const parsedDoc = YAML.parseDocument(config!);
        return (parsedDoc as any).has('image');
    }

    async createAndOpenConfig(): Promise<EditorWidget> {
        return await this.withProgress('Create .gitpod.yml',
            async (progress, cancellationToken) => {
                progress.report({
                    message: 'Inferring setup ...',
                    work: {
                        done: 20,
                        total: 50
                    }
                });
                const config = await new ConfigInferrer().getConfig(this);
                if (!config.tasks || config.tasks.length === 0) {
                    progress.report({
                        message: 'Waiting for user input ...',
                        work: {
                            done: 30,
                            total: 50
                        }
                    });
                    const initTask = await this.quickInputService.open({
                        prompt: 'How to initialize project? (e.g. \'npm install\', \'make\'...)'
                    });
                    const commandTask = await this.quickInputService.open({
                        prompt: 'How to start project? (e.g. \'npm start\', \'yarn watch\'...)'
                    });
                    config.tasks = [{
                        init: initTask || 'echo "TODO: Replace with init/build command"',
                        command: commandTask || 'echo "TODO: Replace with command to start project"'
                    }];
                }
                progress.report({
                    message: 'Updating .gitpod.yml ...',
                    work: {
                        done: 40,
                        total: 50
                    }
                });
                let shouldWrite: boolean | undefined = ! await this.exists(this.gitpodYml);
                if (!shouldWrite) {
                    shouldWrite = await this.quickPick.show<boolean>([
                        {
                            label: 'Overwrite existing .gitpod.yml',
                            value: true
                        },
                        {
                            label: 'Abort',
                            value: false
                        }
                    ], {
                        title: 'A .gitpod.yml file already exists. Do you want to overwrite?'
                    });
                }
                if (shouldWrite) {
                    await this.write(this.gitpodYml, YAML.stringify(config));
                }
                progress.report({
                    message: 'Opening editor ...',
                    work: {
                        done: 50,
                        total: 50
                    }
                });
                this.messageService.info('Sucessfully created an initial .gitpod.yml.');
                return this.open(this.gitpodYml, { mode: 'activate' });
            }
        );
    }

    async updateDockerConfig(): Promise<EditorWidget | undefined> {
        let result = await this.quickPick.show<string>([... this.standardDockerImages.map(i => ({
            value: i.name,
            label: i.label,
            description: i.name,
            detail: i.description
        })),
        {
            value: 'custom',
            label: 'Custom Docker Image',
            detail: `Provide any Docker base image.`
        }
        ], { title: 'Pick a base image' });
        if (result === undefined) {
            return undefined;
        }
        if (result === 'custom') {
            const wait = new Deferred<void>();
            this.quickOpenService.open({
                onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                    acceptor([
                        new QuickOpenItem({
                            label: `Use docker image with name: "${lookFor || 'gitpod/workspace-full'}". Press 'Enter' to confirm or 'Escape' to cancel.`,
                            run: () => {
                                result = lookFor || 'gitpod/workspace-full';
                                return true;
                            }
                        })
                    ]);
                }
            }, QuickOpenOptions.resolve({
                placeholder: 'The Docker image name to use as a base (defaults to \'gitpod/workspace-full\')',
                fuzzySort: false,
                onClose: () => {
                    wait.resolve();
                }
            }));
            await wait.promise;
        }
        const customDocker = await this.quickPick.show<boolean>([{
            label: 'No, thanks',
            value: false
        }, {
            label: 'Yes, generate a .gitpod.Dockerfile',
            value: true
        }], {
            title: 'Do you want to install additional tools (i.e. generate a .gitpod.Dockerfile)?'
        })
        if (customDocker === undefined) {
            return undefined;
        }
        return this.changeDockerImage(result, customDocker);
    }

    private async changeDockerImage(baseImage: string = 'gitpod/workspace-full', dockerFile: boolean = false): Promise<EditorWidget> {
        if (!await this.hasConfig()) {
            await this.createAndOpenConfig();
        }
        if (baseImage === 'gitpod/workspace-full' && !dockerFile) {
            this.messageService.info('You picked the default. No need to update .gitpod.yml.');
            await this.open(this.gitpodYml, { mode: 'activate' });
        }
        return await this.withProgress('Change Docker',
            async (progress, cancellationToken) => {
                progress.report({
                    message: 'Updating Docker config ...',
                    work: {
                        done: 20,
                        total: 50
                    }
                });
                const config = await this.read(this.gitpodYml);
                const parsedDoc = YAML.parseDocument(config!);
                if (!parsedDoc || !parsedDoc.contents) {
                    throw new Error("Couldn't parse " + this.gitpodYml);
                }
                if (dockerFile) {
                    const imageConfig = { "file": this.dockerFileName };
                    if ((parsedDoc as any).get('image')) {
                        (parsedDoc as any).set('image', imageConfig);
                        await this.write(this.gitpodYml, parsedDoc.toString());
                    } else {
                        await this.write(this.gitpodYml, YAML.stringify({image: imageConfig}) + '\n' + parsedDoc.toString());
                    }
                    const gitpodEditor = await this.open(this.gitpodYml);

                    if (!await this.exists(this.dockerFileName)) {
                        progress.report({
                            message: 'Creating Dockerfile ...',
                            work: {
                                done: 40,
                                total: 50
                            }
                        });
                        await this.write(this.dockerFileName,
                            `FROM ${baseImage}

# Install custom tools, runtimes, etc.
# For example "bastet", a command-line tetris clone:
# RUN brew install bastet
#
# More information: https://www.gitpod.io/docs/config-docker/
`);
                    }
                    progress.report({
                        message: 'Opening Dockerfile ...',
                        work: {
                            done: 50,
                            total: 50
                        }
                    });
                    this.messageService.info('Sucessfully created .gitpod.Dockerfile. Please customize it to your needs.');
                    return await this.open(this.dockerFileName, { mode: 'activate', widgetOptions: { mode: 'split-right', ref: gitpodEditor } });
                } else {
                    if ((parsedDoc as any).get('image')) {
                        (parsedDoc as any).set('image', baseImage);
                        await this.write(this.gitpodYml, parsedDoc.toString());
                    } else {
                        await this.write(this.gitpodYml, YAML.stringify({image: baseImage}) + '\n' + parsedDoc.toString());
                    }
                    this.messageService.info('Sucessfully updated .gitpod.yml.');
                    return await this.open(this.gitpodYml, { mode: 'activate' });
                }
            });
    }

    private async getReadMe(): Promise<string> {
        const toTest = ['README.md', 'readme.md', 'README.adoc', 'readme.adoc'];
        for (const candidate of toTest) {
            if (await this.exists(candidate)) {
                return candidate;
            }
        }
        throw new Error('No README.md found in repository root.');
    }

    async hasReadmeConfig(): Promise<boolean> {
        const file = await this.getReadMe().catch(() => "");
        if (file == "") {
            return false;
        }
        const contents = await this.read(file);
        const info = await this.infoService.getInfo();
        if (!contents) {
            return false;
        }
        return contents.indexOf(info.host + '/#') !== -1 ||
            contents.indexOf(info.host + '/from-referrer/') !== -1
    }

    async updateReadme(): Promise<EditorWidget> {
        const fileName = await this.getReadMe().catch(() => "README.md");
        const repo = this.repoProvider.selectedRepository;
        if (!repo) {
            throw new Error('no repository selected');
        }
        const remotes = await this.git.remote(repo);
        const remote = remotes.indexOf('upstream') === -1 ? 'origin' : 'upstream';
        const content = await this.read(fileName) || "";
        const contextUrl = await this.getContextUrl(remote);

        await this.write(fileName,
            `[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](${contextUrl})

${content}`);
        this.messageService.info('A badge was added to the top of the readme. Please review and move where appropriate.');
        return this.open(fileName, { mode: 'activate' });
    }

    // utility methods 

    protected async withProgress<T>(
        text: string,
        cb: (progress: Progress, token: CancellationToken) => Promise<T>
    ): Promise<T> {
        const cancellationSource = new CancellationTokenSource();
        const { token } = cancellationSource;
        const progress = await this.messageService.showProgress({ text, options: { cancelable: true } }, () => cancellationSource.cancel());
        try {
            return await cb(progress, token);
        } finally {
            progress.cancel();
        }
    }

    async getFullPath(path: Path | string): Promise<Path> {
        const uri = await this.toURI(path);
        return uri.path;
    }

    protected async toURI(path: Path | string): Promise<URI> {
        const root = await this.root();
        return root.resolve(path);
    }

    protected async root(): Promise<URI> {
        const info = await this.infoService.getInfo();
        return new URI('file://' + info.repoRoot);
    }

    async exists(path: Path | string): Promise<boolean> {
        const uri = await this.toURI(path);
        const exists = await this.fs.exists(uri);
        return exists;
    }

    async read(path: Path | string): Promise<string | undefined> {
        if (!await this.exists(path)) {
            return undefined;
        }
        const result = await this.fs.read((await this.toURI(path)));
        return result.value;
    }

    async write(path: Path | string, content: string): Promise<void> {
        const uri = await this.toURI(path);
        await this.fs.write(uri, content);
    }

    async list(folderPath: Path | string): Promise<Path[]> {
        const root = await this.root();
        const result = await this.fs.resolve((await this.toURI(folderPath)), { resolveMetadata: true });
        if (!result || !result.children) {
            return [];
        }
        return result.children.map(fs => fs.resource.path.relative(root.path)!).filter(p => p !== undefined);
    }

    async open(path: Path | string, options?: EditorOpenerOptions): Promise<EditorWidget> {
        const uri = await this.toURI(path);
        return this.editors.open(uri, options);
    }
}
