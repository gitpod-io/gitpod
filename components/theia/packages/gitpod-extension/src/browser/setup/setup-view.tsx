/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ReactWidget, Message, ApplicationShell } from "@theia/core/lib/browser";
import * as React from 'react';
import { injectable, inject, postConstruct } from "inversify";
import { SetupManager, gitpodSetupBranchName } from "./setup-manager";
import { CommandRegistry } from "@theia/core";
import { GitHubCommand } from "../github";
import { GitHubExtension } from "../github/github-extension";

import '../../../src/browser/setup/setup-view.css';

interface Step {
    title: string;
    completed?: boolean;
    description: React.ReactNode;
    actions: Action[];
    hide?: boolean;
}

interface Action {
    label: string;
    onClick: () => Promise<any>;
    secondary?: boolean,
}


@injectable()
export class SetupView extends ReactWidget {
    static ID = 'SetupView';
    static LABEL = 'Project Setup';

    @inject(SetupManager) protected readonly mnr: SetupManager;
    @inject(CommandRegistry) protected readonly commands: CommandRegistry;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(GitHubExtension) private gitHubExtension: GitHubExtension;

    constructor() {
        super();
        // required to make focus work
        this.node.tabIndex = 0;

        this.id = SetupView.ID;
        this.title.label = SetupView.LABEL;
        this.title.iconClass = 'gitpod-view-icon';
        this.addClass('gitpod-setup-view');
        this.title.closable = true;
    }

    @postConstruct()
    protected async initialize() {
        try {
            this.steps[0].completed = await this.mnr.hasConfig();
            this.steps[1].completed = await this.mnr.hasImageConfig();
            this.steps[2].completed = await this.mnr.hasReadmeConfig();
            for (let i = 0; i < this.steps.length; i++) {
                const step = this.steps[i];
                if (!step.completed) {
                    this.activeStep = i;
                    break;
                }
            }
            await this.gitHubExtension.initialized;
            const isGitHub = this.gitHubExtension.enabled;
            this.steps[3].hide = !isGitHub;
            this.steps[4].hide = !isGitHub;
        } catch (err) {
            console.error(err);
        }
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
        const size = this.shell.rightPanelHandler.state.lastPanelSize;
        if (!size || size < 500) {
            this.shell.rightPanelHandler.resize(500);
        }
    }

    private activeStep: number;
    private skipAction: Action = {
        label: 'Skip',
        secondary: true,
        onClick: async () => {
            this.activeStep++;
            this.update();
        }
    };
    private steps: Step[] = [
        {
            title: 'Create .gitpod.yml',
            description: <React.Fragment>
                <p>
                    Let's start by adding a <code>.gitpod.yml</code> in your project's root.
                </p>
            </React.Fragment>,
            actions: [
                {
                    label: 'Create .gitpod.yml',
                    onClick: async () => {
                        await this.mnr.createAndOpenConfig();
                        this.steps[0].completed = true;
                        this.activeStep++;
                        this.update();
                    }
                }
            ]
        },
        {
            title: 'Change Base Image',
            description: <React.Fragment>
                <p>
                    Need additional tools? Add a <code>.gitpod.Dockerfile</code>.
                </p>
            </React.Fragment>,
            actions: [
                this.skipAction,
                {
                    label: 'Update Docker Configuration',
                    onClick: async () => {
                        await this.mnr.updateDockerConfig();
                        this.steps[1].completed = true;
                        this.activeStep++;
                        this.update();
                    }
                }
            ]
        },
        {
            title: 'Update Readme',
            description: <React.Fragment>
                <p>
                    Let others know this project is <b>Ready-to-Code</b>.
                </p>
            </React.Fragment>,
            actions: [
                this.skipAction,
                {
                    label: 'Update Readme',
                    onClick: async () => {
                        await this.mnr.updateReadme();
                        this.steps[2].completed = true;
                        this.activeStep++;
                        this.update();
                    }
                }
            ]
        },
        {
            title: 'Test Drive Configuration',
            description: <React.Fragment>
                <p>
                    Push your changes to the remote branch “{gitpodSetupBranchName}” and start a fresh workspace.
                </p>
            </React.Fragment>
            ,
            actions: [
                this.skipAction,
                {
                    label: 'Push to Branch & Start Workspace',
                    onClick: async () => {
                        await this.mnr.testSetup();
                        this.steps[3].completed = true;
                        this.activeStep++;
                        this.update();
                    }
                }
            ]
        },
        {
            title: 'Create a Pull-Request',
            description: <React.Fragment>
                <p>
                    Awesome, you seem to be happy with the configuration! 🎉
                </p>
                <p>
                    Let’s propose the change to the project.
                </p>
            </React.Fragment>,
            actions: [
                {
                    label: 'Open Pull Request View',
                    onClick: () => this.commands.executeCommand(GitHubCommand.toggleId)
                }
            ]
        }
    ];

    protected render(): React.ReactNode {
        const items = [];
        const iconStyle: React.CSSProperties = {
            backgroundColor: 'var(--theia-descriptionForeground)',
            borderRadius: 100,
            color: 'var(--theia-sideBar-background)',
            padding: '3px 7px 3px 7px',
            marginRight: 10,
            opacity: 0.6
        };
        const titleStyle: React.CSSProperties = {
            padding: 10,
            display: 'flex',
            alignItems: 'baseline'
        };
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            if (step.hide) {
                break;
            }
            const icon = this.activeStep === i ?
                <div style={{
                    ...iconStyle,
                    opacity: 1,
                }}>{i + 1}</div> :
                <div style={iconStyle}>{i + 1}</div>;
            const title = <div style={{ flexGrow: 2 }}>{step.title}</div>;
            const done = <div style={{ color: 'green' }}>{step.completed ? '✔️' : ''}</div>
            if (this.activeStep === i) {
                const buttons = step.actions.map((b, i) =>
                    <button key={'_' + i} onClick={b.onClick} className={(b.secondary ? 'secondary ' : '') + "theia-button"}>{b.label}</button>);
                items.push(<h3 key={'title_' + i}
                    style={{
                        ...titleStyle,
                        backgroundColor: 'var(--theia-sideBar-background)'
                    }}
                >{icon}{title}{done}</h3>);
                items.push(
                    <div key={'content_' + i} style={{ paddingLeft: 35, paddingRight: 10 }}>
                        {step.description}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}>
                            {buttons}
                        </div>
                    </div>
                );
            } else {
                items.push(<h3 key={'title_' + i}
                    onClick={() => {
                        this.activeStep = i;
                        this.update();
                    }}
                    style={{
                        ...titleStyle,
                        cursor: 'pointer',
                        color: 'var(--theia-descriptionForeground)'
                    }}
                >{icon}{title}{done}</h3>);
            }
        }
        return <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%'
        }}>
            <div>
                {items}
            </div>
            <div>
                <div style={{ paddingLeft: 10, paddingRight: 10 }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'baseline',
                        paddingBottom: 15
                    }}> 
                        <p>Doesn't Work As Expected?</p>
                        <a href='https://www.gitpod.io/docs/configuration/' target='_blank'><button className="secondary theia-button">Go to Docs</button></a>
                        <a href='https://calendly.com/gitpod/onboarding' target='_blank'><button className='secondary theia-button'>Schedule a Call</button></a>
                    </div>
                </div>
            </div>
        </div>;
    }

}