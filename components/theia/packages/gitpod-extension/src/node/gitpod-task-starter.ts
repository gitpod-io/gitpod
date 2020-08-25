/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as fs from 'fs-extra';
import * as path from 'path';
import { ILogger } from "@theia/core/lib/common";
import { TerminalProcess, ProcessManager } from "@theia/process/lib/node";
import { IShellTerminalServer } from '@theia/terminal/lib/common/shell-terminal-protocol';
import { WorkspaceServer } from '@theia/workspace/lib/common/workspace-protocol';
import { TaskConfig } from '@gitpod/gitpod-protocol/lib/protocol';
import { WorkspaceReadyMessage, WorkspaceInitSource } from '@gitpod/gitpod-protocol/lib/wsready';
import { TerminalProcessInfo } from "../common/gitpod-info";
import { BackendApplicationContribution } from "@theia/core/lib/node";
import { GitpodFileParser } from '@gitpod/gitpod-protocol/lib/gitpod-file-parser';
import { FileUri } from '@theia/core/lib/node/file-uri';
import URI from "@theia/core/lib/common/uri";
import { TheiaHeadlessLogType } from '@gitpod/gitpod-protocol/lib/headless-workspace-log';
import { Transform } from "stream";
import * as moment from 'moment';
import { ContentReadyServiceServer } from "../common/content-ready-service";

import * as jsoncparser from 'jsonc-parser';
import { UTF8 } from "@theia/core/lib/common/encodings";

interface TaskConfigWithPrebuild extends TaskConfig {
    printlogs?: string
}

export type StartPhase = 'init' | 'restart' | 'prebuild' | 'prebuilt';

@injectable()
export class GitpodTaskStarter {
    @inject(ILogger) protected readonly logger: ILogger;
    @inject(ProcessManager) protected readonly processManager: ProcessManager;
    @inject(IShellTerminalServer) protected readonly shellTerminalServer: IShellTerminalServer;
    @inject(WorkspaceServer) protected readonly workspaceServer: WorkspaceServer;
    readonly terminalProcessInfos: TerminalProcessInfo[] = [];
    @inject(GitpodFileParser) protected readonly gitpodFileParser: GitpodFileParser;

    async start(startPhase: StartPhase) {
        const headlessTasks: Promise<number>[] = [];
        try {
            const previousUri = await this.workspaceServer.getMostRecentlyUsedWorkspace();
            const workspaceRoot = previousUri && FileUri.fsPath(new URI(previousUri)) || process.env.THEIA_WORKSPACE_ROOT;
            const rootPath = await this.resolveWorkspacePath(workspaceRoot);
            const workspaceTasks = await this.getWorkspaceTasks(rootPath);
            const isHeadless = process.env.GITPOD_HEADLESS === 'true';
            if (isHeadless) {
                this.logger.info(`Running headless and thus ignoring original start phase: ${JSON.stringify(startPhase)}. Using 'prebuild' instead.`);
                startPhase = 'prebuild';
            }

            let idx = 0;
            this.logger.info(`Starting tasks in ${JSON.stringify(startPhase)} from ${JSON.stringify(workspaceTasks)}`);
            for (const task of workspaceTasks) {
                const path = rootPath;
                const taskcfg = this.addPrebuiltTasks(task, idx);

                const taskCommand = await this.buildCmdStr(taskcfg, startPhase, idx);
                if (isHeadless && !taskCommand) {
                    // we have nothing to do here
                    continue;
                }

                const term = await this.startTerminalWith(path, taskCommand, task.env || {});
                this.terminalProcessInfos.push({
                    processId: term.id,
                    task
                });

                if (isHeadless) {
                    this.logger.info(`Running ${taskCommand}`)
                    headlessTasks.push(this.watchHeadlessTask(term, rootPath));
                }
                idx += 1;
            }

            if (isHeadless) {
                this.publishHeadlessTaskState(headlessTasks);
            }
        } catch (err) {
            this.logger.info(err.message);
        }

    }

    protected async resolveWorkspacePath(workspaceRoot?: string): Promise<string> {
        if (!workspaceRoot) {
            console.error('No workspace root');
        } else {
            try {
                const stat = await fs.stat(workspaceRoot)
                if (stat.isDirectory()) {
                    return workspaceRoot;
                } else {
                    const path = await this.getWorkspacePathFromFile(FileUri.create(workspaceRoot).toString());
                    if (path) {
                        return path;
                    }
                }
            } catch (err) {
                console.error("Couldn't load workspace root", err);
            }
        }
        return "/workspace";
    }

    protected async getWorkspacePathFromFile(fileUri: string): Promise<string | undefined> {
        const content = await fs.readFile(FileUri.fsPath(fileUri), UTF8);
        const strippedContent = jsoncparser.stripComments(content);
        const data = jsoncparser.parse(strippedContent);
        if (data && Array.isArray(data['folders'])) {
            for (const candidate of data['folders']) {
                if (typeof candidate['path'] === 'string') {
                    const configPath = candidate['path'];
                    const relativeUri = new URI(fileUri).parent.resolve(configPath);
                    try {
                        const folderStat = await fs.stat(FileUri.fsPath(relativeUri));
                        if (folderStat.isDirectory()) {
                            return relativeUri.toString();
                        }
                    } catch {
                        /* no-op */
                    }
                }
            }
        }
        console.error(`Workspace config doesn't contain a valid workspace root.`, JSON.stringify(data));
        return undefined;
    }

    protected addPrebuiltTasks(task: TaskConfig, index: number): TaskConfigWithPrebuild {
        const legacyFilename = `/workspace/.prebuild-log-${index}`;
        const fileName = `/workspace/.gitpod/prebuild-log-${index}`;
        return {
            ...task,
            printlogs: `[ -r ${legacyFilename} ] && cat ${legacyFilename}; [ -r ${fileName} ] && cat ${fileName}; true`,
        }
    }

    protected async getWorkspaceTasks(rootPath: string): Promise<TaskConfig[]> {
        try {
            try {
                const gitpodFile = path.join(rootPath, '.gitpod.yml');
                if (fs.existsSync(gitpodFile)) {
                    const contents = await fs.readFile(gitpodFile);
                    const parseResult = this.gitpodFileParser.parse(contents.toString());
                    if (!parseResult.validationErrors || parseResult.validationErrors.length === 0) {
                        if (parseResult.config.tasks) {
                            return parseResult.config.tasks;
                        }
                    }
                }
            } catch (err) {
                this.logger.info("Failed to parse tasks from local .gitpod.yml.", { err });
            }
            const values = JSON.parse(process.env.GITPOD_TASKS || '');
            if (Array.isArray(values)) {
                return values.filter(v => TaskConfig.is(v));
            }
        } catch (err) {
            this.logger.info("Failed to parse workspace tasks.", { err });
        }
        return [];
    }

    protected async startTerminalWith(cwd: string, command: string | undefined, env: { [env: string]: string }): Promise<TerminalProcess> {
        const terminalId = await this.shellTerminalServer.create({
            rootURI: cwd,
            env
        });
        const termProcess = this.processManager.get(terminalId) as TerminalProcess;
        if (command) {
            // let's wait for data (prompt), before sending the command.
            const out = termProcess.createOutputStream();
            out.once('data', () => termProcess.write(command + '\n'));
        }

        this.logger.info("Started terminal %s with command '%s'.", terminalId, command);
        return termProcess;
    }

    protected getCommands(task: TaskConfigWithPrebuild, startPhase: StartPhase | 'mock-prebuilt'): string[] {
        function isCommand(cmd?: string): cmd is string {
            return !!(cmd && cmd.trim().length > 0);
        }

        const phaseToTask: { [P in (StartPhase | "mock-prebuilt")]: string[] } = {
            'init': ['before', 'init', 'command'],

            'restart': ['before', 'command'],

            // we're starting a new prebuild
            'prebuild': ['before', 'init', 'prebuild'],

            // this workspace was initialized from a previously run prebuild
            'prebuilt': ['before', 'printlogs', 'command'],

            // this workspace was initialized from a prebuild and we need the commands as if we ran all of them at once
            'mock-prebuilt': ['before', 'init', 'prebuild', 'command'],
        };

        const commands = phaseToTask[startPhase]
            .map(t => (task as any)[t])
            .filter(isCommand);
        return commands;
    }

    protected async buildCmdStr(task: TaskConfigWithPrebuild, startPhase: StartPhase, index: number): Promise<string | undefined> {
        const commands = this.getCommands(task, startPhase);
        let command = commands
            .map(c => `{\n${c}\n}`)
            .join(" && ");
        if (startPhase === "prebuild") {
            // it's important that prebuild tasks exit eventually
            // also, we need to save the log output in the workspace
            if (command.trim().length > 0) {
                command += '; exit';
            } else {
                command = 'exit';
            }
        } else if (command.trim().length > 0) {
            const fn = `/workspace/.gitpod/cmd-${index}`;
            await fs.writeFile(fn, this.getCommands(task, startPhase == 'prebuilt' ? 'mock-prebuilt' : startPhase).join("\r\n") + "\r\n");

            // the space at beginning of the HISTFILE command prevents the HISTFILE command itself from appearing in
            // the bash history.
            const histcmd = ` HISTFILE=${fn} history -r`;
            command = histcmd + '; ' + command;
        }

        if (command.trim().length === 0) {
            return undefined;
        } else {
            return command;
        }
    }

    /**
     * This function listens on the tasks and forwards its output/events to the logger.
     * The ws-monitor listens to this log output and interpretes it using the HeadlessWorkspaceLog labels.
     */
    protected watchHeadlessTask(term: TerminalProcess, rootPath: string): Promise<number> {
        // at this point we're already running. Let's not wait for the file to open, but buffer what's
        // been output before.
        const logFile = `/workspace/.gitpod/prebuild-log-${term.id}`;
        this.logger.info(`Writing build output to ${logFile}`);
        let logfileStream = fs.createWriteStream(logFile, { flags: 'w' });

        const start = Date.now();
        const output = term.createOutputStream();
        output.
            pipe(new PrebuiltExitTransform(() => {
                const now = Date.now();
                if (now - start < 60 * 1000) {
                    return "";
                }

                return `🎉 You just saved ${moment(start).to(now, true)} of watching your code build.\n`;
            })).
            pipe(logfileStream);
        output.on('data', async data => {
            this.logger.info({ type: TheiaHeadlessLogType.TaskLogLabel, data: data.toString() });
        });

        return new Promise<number>((resolve, reject) => {
            term.onExit(async (e) => {
                /* Not sure that's such a brilliant idea. I don't know how the term output
                * stream pipe behaves when we close the underlying stream. The rationale is
                * that I want ensure that the log file is synced to disk before taking the
                * snapshot.
                */
                logfileStream.close();

                this.logger.info(`Terminal process exited with code ${e.code}`);
                resolve(e.code);
            });
        })
    }

    protected async publishHeadlessTaskState(tasks: Promise<number>[]) {
        try {
            /* TODO: here we could decide if we want to publish a snapshot even if one of
             *       of the tasks returned with a non-zero exit code (i.e. the promise
             *       resolves to false).
             */
            const taskExitCodes = await Promise.all(tasks);
            const hasMonZeroExitCodes = !!taskExitCodes.find(s => s !== 0);

            this.logger.info({ type: TheiaHeadlessLogType.TaskLogLabel, data: "🚛 uploading prebuilt workspace" });
            if (hasMonZeroExitCodes) {
                this.logger.info({ type: TheiaHeadlessLogType.TaskFailedLabel, error: "one of the tasks failed with non-zero exit code" });
            } else {
                this.logger.info({ type: TheiaHeadlessLogType.TaskSuccessfulLabel });
            }
        } catch (err) {
            this.logger.info({ type: TheiaHeadlessLogType.TaskFailedLabel, error: `Tasks failed: ${err}` });
        }
    }
}

@injectable()
export class TheiaLocalTaskStarter implements BackendApplicationContribution {

    @inject(GitpodTaskStarter) starter: GitpodTaskStarter;
    onStart() {
        this.starter.start((process.env.GITPOD_START_MODE || "init") as StartPhase);
    }
}

@injectable()
export class WorkspaceReadyTaskStarter implements BackendApplicationContribution {
    @inject(GitpodTaskStarter) starter: GitpodTaskStarter;
    @inject(ILogger) protected readonly logger: ILogger;
    @inject(ContentReadyServiceServer) protected readonly contentReadyService: ContentReadyServiceServer;

    async onStart() {
        const readyFilename = "/workspace/.gitpod/ready";

        this.logger.info("waiting for workspace content to become available");
        const readyFileExists = () => new Promise((resolve, reject) => {
            this.logger.debug(`checking if ready file (${readyFilename}) exists`);
            try {
                fs.exists(readyFilename, resolve);
            } catch (err) {
                reject(err);
            }
        });
        while (true) {
            if (await readyFileExists()) {
                break
            }

            // we really do this polling forerver (or until the workspace content gets ready), as we do not
            // want to impose another workspace startup timeout. Some repositories can really take up to 30-45 minutes
            // to check out. Worst case do we poll this file until the workspace is stopped again by wsman
            // because the content did not get ready in time.
            await new Promise<void>(tryAgain => setTimeout(() => tryAgain(), 1000));
        }

        let message: WorkspaceReadyMessage = {
            source: WorkspaceInitSource.WorkspaceInitFromOther
        };
        try {
            message = await fs.readJson(readyFilename);
        } catch (err) {
            this.logger.error(`cannot read workspace ready file: ${err}`);
        }

        let phase: StartPhase;
        if (message.source == "from-backup") {
            phase = "restart";
        } else if (message.source == "from-prebuild") {
            phase = "prebuilt";
        } else {
            phase = "init";
        }

        this.logger.info("workspace content is ready - starting tasks", { phase, message });
        this.starter.start(phase);
        this.contentReadyService.markContentReady();
    }

}


class PrebuiltExitTransform extends Transform {

    constructor(protected readonly durationProvider: () => string) {
        super();
    }

    // this is a poor mans version of this transformation. It assumes that the chuck contains
    // all the lines required to detect the exit condition. That's not neccesarily true.
    // A better implementation would buffer lines if required. Let' see how well this one works
    // in practice though.
    _transform(chunk: any, encoding: string, callback: Function): void {
        const rows: string[] = chunk.toString().split("\n");

        for (let i = 0; i < rows.length - 1; i++) {
            if (rows[i].trim() == "exit" && rows[i + 1].trim() == "") {
                rows[i] = `\n🍌 This task ran as part of a workspace prebuild.\n${this.durationProvider()}\n`
            }
        }
        this.push(rows.join("\n"));
        callback();
    }

}