/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import Button from '@material-ui/core/Button';
import { browserExtension } from '../browser-extension-detection';
import { createGitpodService } from '../service-factory';
import { UserPlatform } from '@gitpod/gitpod-protocol';

const ctrlCmd = is('Mac') ? '⌘' : 'Ctrl';
// linux
let historyShortcut = <span><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>-</kbd></span>;
if (is('Mac')) {
    historyShortcut = <span><kbd>Ctrl</kbd> + <kbd>-</kbd></span>;
} else if (is('Win')) {
    historyShortcut = <span><kbd>Alt</kbd> + <kbd>Left</kbd></span>;
}

function is(os: ('Win'|'Mac'|'X11'|'Linux')): boolean {
    if (typeof navigator !== 'undefined') {
        if (navigator.userAgent && navigator.userAgent.indexOf(os) >= 0) {
            return true;
        }
    }
    return false;
}

const tips = [
    <span>Press <kbd>{ctrlCmd}</kbd> + <kbd>P</kbd> to search and open any file by name.</span>,
    <span>Press <kbd>Ctrl</kbd> + <kbd>`</kbd> to open a new terminal.</span>,
    <span>Press <kbd>{ctrlCmd}</kbd> + <kbd>/</kbd> to toggle code comments.</span>,
    <span>Prefix a pull request URL with <strong>gitpod.io/#</strong> to do a deep code review.</span>,
    <span>You can open every GitHub, GitLab, or Bitbucket project by prefixing the URL with <strong>gitpod.io/#</strong>.</span>,
    <span>To fork a repository, press <kbd>F1</kbd> and search for <strong>Git: Fork...</strong>.</span>,
    <span>Press <kbd>F1</kbd> to open the command palette.</span>,
    <span>To rename a variable, highlight it then press <kbd>F2</kbd>.</span>,
    <span>Press {historyShortcut} to jump to the previous editor location.</span>,
    <span>Click your avatar and choose '<strong>Share Workspace Snapshot</strong>' to take a snapshot.</span>,
    <span>Click your avatar and choose '<strong>Share Running Workspace</strong>' to share your work.</span>,
    <span>To <strong>share a code snippet</strong> right-click on code and choose '<strong>Copy GitHub link</strong>'.</span>,
    <span>Run <strong>gp open &lt;file&gt;</strong> to open a file from the terminal.</span>,
    <span>Run <strong>gp init</strong> in the terminal to create a <strong>.gitpod.yml</strong> for your project.</span>,
    <span>Run <strong>gp url 8080</strong> in the terminal to print the preview URL for that port.</span>,
    <span>Manage all your environment variables <a href="https://gitpod.io/settings/" target="_blank" rel="noopener">here</a>.</span>,
    <span>Questions? Find us in the <a href="https://community.gitpod.io/" target="_blank" rel="noopener noreferrer">Gitpod Community</a>.</span>,
    <span>Check <a href="https://www.gitpod.io/docs/" target="_blank" rel="noopener">www.gitpod.io/docs/</a> to learn more.</span>,
    <span>See more tips &amp; tricks <a href="https://www.gitpod.io/docs/tips-and-tricks/" target="_blank" rel="noopener">here</a>.</span>,
    <span>Please submit bugs and feature requests <a href="https://github.com/gitpod-io/gitpod/issues" target="_blank" rel="noopener noreferrer">on GitHub</a>.</span>,
    <span>Install any VS Code extension with a simple drag-and-drop. <a href="https://www.gitpod.io/docs/vscode-extensions/" target="_blank" rel="noopener">See how</a>.</span>
];

export class ProductivityTips extends React.Component<{userHasCreatedWorkspaces?: boolean}, { platform?: UserPlatform }> {
    private _productivityTip: JSX.Element | null;
    private extensionCheckDelayed: boolean = false;

    constructor(props: {userHasCreatedWorkspaces?: boolean, shouldRenderTips: boolean}) {
        super(props);
        setTimeout(() => this.extensionCheckDelayed = true, 500);
        browserExtension.getUserPlatform(createGitpodService()).then(
            platform =>
            this.setState({
                platform
            })
        );
    }

    get productivityTip() {
        if (this._productivityTip != null) {
            return this._productivityTip;
        }
        // Pick a random tip of the day.
        this._productivityTip = tips[Math.floor(Math.random() * tips.length)];
        return this._productivityTip;
    }

    render() {
        let message = <div className='warning message'></div>;
        let isChrome = !!(window as any).chrome;
        const isFirefox = !!(window as any).InstallTrigger;
        if (!isChrome && !isFirefox) {
            message = (
                <div className='pro-tip message'>
                    Gitpod runs best on <a href='https://www.google.com/chrome/' target='_blank' rel='noopener noreferrer'>Chrome</a> and <a href='https://www.mozilla.org/firefox/' target='_blank' rel='noopener noreferrer'>Firefox</a>.
				</div>
            );
        } else if (this.props.userHasCreatedWorkspaces !== undefined && !this.props.userHasCreatedWorkspaces) {
            message = <React.Fragment>
                <div className='pro-tip message'>
                    <div className='background'>
                        <div>
                            Prefix any GitHub, GitLab, or Bitbucket URL with <strong>gitpod.io/#</strong> to open pull requests, issues or branches in Gitpod
                        </div>
                        <div className='image'>
                            <UrlAnimation></UrlAnimation>
                            <img width='600' height='27' src={`/images/tip-gitpod-url-blank2.png`} />
                        </div>
                    </div>
                </div>
            </React.Fragment>;
        } else if (this.hasGitpodExtension() === false) {
            const extensionButton = isChrome ?
                <Button className='button' variant='outlined' color='secondary'
                    href='https://chrome.google.com/webstore/detail/gitpod-online-ide/dodmmooeoklaejobgleioelladacbeki' target='_blank' rel='noopener noreferrer'>
                    Get Chrome Extension
				</Button> :
                <Button className='button' variant='outlined' color='secondary'
                    href='https://addons.mozilla.org/firefox/addon/gitpod/' target='_blank' rel='noopener noreferrer'>
                    Get Firefox Extension
			    </Button>;
            message = (
                <div className='pro-tip message'>
                    Install the browser extension for the one-click experience.
					{extensionButton}
                </div>
            );
        } else if(this.extensionCheckDelayed) {
            message = <div className='pro-tip message'>
                {this.productivityTip}
            </div>
        }

        return message;
    }

    protected hasGitpodExtension(): boolean | undefined {
        if (!this.state || !this.state.platform) {
            return undefined;
        }
        return this.state.platform.browserExtensionInstalledSince !== undefined
            && this.state.platform.browserExtensionUninstalledSince === undefined
    }
}

class UrlAnimation extends React.Component<{}, { url: string }>{

    protected start: number;
    protected prefix: string;
    protected stepTime: number;
    protected initialStepTime: number;
    protected startDelay: number;
    protected gitpodUrl: string;
    protected githubUrl: string;

    constructor(p: {}) {
        super(p);
        this.githubUrl = 'https://github.com/my-org/my-project';
        this.gitpodUrl = 'https://gitpod.io/#';
        this.prefix = '';
        this.startDelay = 2000;
        this.initialStepTime = 80;
        this.stepTime = this.initialStepTime;
        this.state = { url: '' };
    }

    protected writeALetter = ((timestamp: number) => {
        if (!this.start) this.start = timestamp;
        var progress = timestamp - this.start;

        if ((this.prefix === '' && progress > this.startDelay) || (this.prefix !== '' && progress > this.stepTime)) {
            this.prefix = this.gitpodUrl.substring(0, this.prefix.length+1);
            this.setState({ url: this.prefix });
            this.start = timestamp;
            this.stepTime = this.initialStepTime + (100 * Math.random());
        }
        if (this.prefix !== this.gitpodUrl) {
            window.requestAnimationFrame(this.writeALetter);
        }
    }).bind(this);

    componentDidMount() {
        window.requestAnimationFrame(this.writeALetter);
    }

    render() {
        return <div className='url-animation'>{this.state.url}<span className='cursor'></span><span style={{color:'#898989'}}>{this.githubUrl}</span></div>;
    }
}
