/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceConfig } from "@gitpod/gitpod-protocol";

export interface Context {
    config: WorkspaceConfig;
    excludeVsCodeConfig: boolean;
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string | undefined>;
}

export class ConfigInferrer {

    protected contributions: ((ctx: Context) => Promise<void>)[] = [
        this.checkNode.bind(this),
        this.checkJava.bind(this),
        this.checkPython.bind(this),
        this.checkGo.bind(this),
        this.checkRust.bind(this),
        this.checkMake.bind(this),
        this.checkNuget.bind(this),
        this.checkRuby.bind(this),
    ]

    async getConfig(ctx: Context): Promise<WorkspaceConfig> {
        for (const contrib of this.contributions) {
            try {
                await contrib(ctx);
            } catch (e) {
                console.log(e);
            }
        }
        return ctx.config;
    }

    protected async checkNode(ctx: Context): Promise<void> {
        const pckjsonContent = await ctx.read('package.json');
        if (!pckjsonContent) {
            return;
        }
        let command: 'yarn' | 'npm' = 'npm';
        if (await ctx.exists('yarn.lock')) {
            command = 'yarn';
        }
        this.addCommand(ctx.config, command + ' install', 'init');
        try {
            const pckjson = JSON.parse(pckjsonContent);
            if (pckjson.scripts) {
                if (pckjson.scripts.build) {
                    this.addCommand(ctx.config, command + ' run build', 'init');
                } else if (pckjson.scripts.compile) {
                    this.addCommand(ctx.config, command + ' run compile', 'init');
                }
                if (pckjson.scripts.start) {
                    this.addCommand(ctx.config, command + ' run start', 'command');
                } else if (pckjson.scripts.dev) {
                    this.addCommand(ctx.config, command + ' run dev', 'command');
                } else if (pckjson.scripts.watch) {
                    this.addCommand(ctx.config, command + ' run watch', 'command');
                }
            }
        } catch (e) {
            console.log(e, pckjsonContent);
        }
        this.addExtension(ctx, 'dbaeumer.vscode-eslint');
    }

    protected async checkJava(ctx: Context): Promise<void> {
        if (await ctx.exists('build.gradle')) {
            let cmd = 'gradle';
            if (await ctx.exists('gradlew')) {
                cmd = './gradlew';
            }
            this.addCommand(ctx.config, cmd + ' build', 'init');
            this.addExtension(ctx, 'redhat.java');
            this.addExtension(ctx, 'vscjava.vscode-java-debug');
            return;
        }
        if (await ctx.exists('pom.xml')) {
            let cmd = 'mvn';
            if (await ctx.exists('mvnw')) {
                cmd = './mvnw';
            }
            this.addCommand(ctx.config, cmd + ' install -DskipTests=false', 'init');
            this.addExtension(ctx, 'redhat.java');
            this.addExtension(ctx, 'vscjava.vscode-java-debug');
            this.addExtension(ctx, 'vscjava.vscode-maven');
            return;
        }
    }

    protected addExtension(ctx: Context, extensionName: string) {
        if (ctx.excludeVsCodeConfig) {
            return;
        }
        if (!ctx.config.vscode || !ctx.config.vscode.extensions) {
            ctx.config.vscode = {
                extensions: []
            };
        }
        if (ctx.config.vscode.extensions?.indexOf(extensionName) === -1)
            ctx.config.vscode.extensions!.push(extensionName);
    }

    protected async isMake(ctx: Context) {
        return await ctx.exists('Makefile') || await ctx.exists('makefile');
    }

    protected async checkMake(ctx: Context) {
        if (await ctx.exists('CMakeLists.txt')) {
            this.addCommand(ctx.config, 'cmake .', 'init');
        } else if (await this.isMake(ctx)) {
            this.addCommand(ctx.config, 'make', 'init');
        }
    }

    protected async checkPython(ctx: Context) {
        if (await this.isMake(ctx)) {
            // https://docs.python-guide.org/writing/structure/#makefile
            return;
        }
        if (await ctx.exists('requirements.txt')) {
            this.addCommand(ctx.config, 'pip install -r requirements.txt', 'init');
            this.addExtension(ctx, 'ms-python.python');
        } else if (await ctx.exists('setup.py')) {
            this.addCommand(ctx.config, 'pip install .', 'init');
            this.addExtension(ctx, 'ms-python.python');
        }
        if (await ctx.exists('main.py')) {
            this.addCommand(ctx.config, 'python main.py', 'command');
            this.addExtension(ctx, 'ms-python.python');
        } else if (await ctx.exists('app.py')) {
            this.addCommand(ctx.config, 'python app.py', 'command');
            this.addExtension(ctx, 'ms-python.python');
        } else if (await ctx.exists('runserver.py')) {
            this.addCommand(ctx.config, 'python runserver.py', 'command');
            this.addExtension(ctx, 'ms-python.python');
        }
    }

    protected async checkGo(ctx: Context) {
        if (await ctx.exists('go.mod')) {
            this.addCommand(ctx.config, 'go get', 'init');
            this.addCommand(ctx.config, 'go build ./...', 'init');
            this.addCommand(ctx.config, 'go test ./...', 'init');
            this.addCommand(ctx.config, 'go run', 'command');
            this.addExtension(ctx, 'golang.go');
        }
    }

    protected async checkRust(ctx: Context) {
        if (await ctx.exists('Cargo.toml')) {
            this.addCommand(ctx.config, 'cargo build', 'init');
            this.addCommand(ctx.config, 'cargo watch -x run', 'command');
            this.addExtension(ctx, 'matklad.rust-analyzer');
        }
    }

    protected async checkNuget(ctx: Context) {
        if (await ctx.exists('packages.config')) {
            this.addCommand(ctx.config, 'nuget install', 'init');
        }
    }

    protected async checkRuby(ctx: Context) {
        if (await ctx.exists('bin/setup')) {
            this.addCommand(ctx.config, 'bin/setup', 'init');
        } else if (await ctx.exists('Gemfile')) {
            this.addCommand(ctx.config, 'bundle install', 'init');
        }
        if (await ctx.exists('bin/startup')) {
            this.addCommand(ctx.config, 'bin/startup', 'command');
        } else if (await ctx.exists('bin/rails')) {
            this.addCommand(ctx.config, 'bin/rails server', 'command');
        }
    }

    protected addCommand(config: WorkspaceConfig, command: string, phase: 'before' | 'init' | 'command', unless?: string): void {
        if (!config.tasks) {
            config.tasks = [];
        }
        if (!config.tasks[0]) {
            config.tasks.push({});
        }
        const existing = config.tasks[0][phase];
        if (unless && existing && existing.indexOf(unless) !== -1) {
            // skip
            return;
        }
        config.tasks[0][phase] = (existing ? existing + ' && ' : '') + command;
    }

    toYaml(config: WorkspaceConfig): string {
        const i = '  ';
        let tasks = '';
        if (config.tasks) {
            tasks = `tasks:\n${i}- ${config.tasks.map(task => Object.entries(task).map(([phase, command]) => `${phase}: ${command}`).join('\n    ')).join('\n  - ')}`
        }
        let vscode = '';
        if (config.vscode?.extensions) {
            vscode = `vscode:\n${i}extensions:\n${config.vscode.extensions.map(extension => `${i + i}- ${extension}`).join('\n')}`
        }
        return `${tasks}
${vscode}
`;
    }
}
