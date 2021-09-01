/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceConfig } from "@gitpod/gitpod-protocol";

export interface Context {
    config: WorkspaceConfig;
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
    }

    protected async checkJava(ctx: Context): Promise<void> {
        if (await ctx.exists('build.gradle')) {
            let cmd = 'gradle';
            if (await ctx.exists('gradlew')) {
                cmd = './gradlew';
            }
            this.addCommand(ctx.config, cmd + ' build', 'init');
            return;
        }
        if (await ctx.exists('pom.xml')) {
            let cmd = 'mvn';
            if (await ctx.exists('mvnw')) {
                cmd = './mvnw';
            }
            this.addCommand(ctx.config, cmd + ' install -DskipTests=false', 'init');
            return;
        }
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
        } else if (await ctx.exists('setup.py')) {
            this.addCommand(ctx.config, 'pip install .', 'init');
        }
        if (await ctx.exists('main.py')) {
            this.addCommand(ctx.config, 'python main.py', 'command');
        } else if (await ctx.exists('app.py')) {
            this.addCommand(ctx.config, 'python app.py', 'command');
        } else if (await ctx.exists('runserver.py')) {
            this.addCommand(ctx.config, 'python runserver.py', 'command');
        }
    }

    protected async checkGo(ctx: Context) {
        if (await ctx.exists('go.mod')) {
            this.addCommand(ctx.config, 'go get', 'init');
            this.addCommand(ctx.config, 'go build ./...', 'init');
            this.addCommand(ctx.config, 'go test ./...', 'init');
            this.addCommand(ctx.config, 'go run', 'command');
        }
    }

    protected async checkRust(ctx: Context) {
        if (await ctx.exists('Cargo.toml')) {
            this.addCommand(ctx.config, 'cargo build', 'init');
            this.addCommand(ctx.config, 'cargo watch -x run', 'command');
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
}
