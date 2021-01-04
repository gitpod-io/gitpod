/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require("../../../styles/port-view.css");

import { PortsStatus, PortVisibility } from "@gitpod/supervisor-api-grpc/lib/status_pb";
import { Message } from "@phosphor/messaging";
import { ReactWidget } from "@theia/core/lib/browser/widgets/react-widget";
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { MiniBrowserOpenHandler } from "@theia/mini-browser/lib/browser/mini-browser-open-handler";
import { inject, injectable } from "inversify";
import * as React from 'react';
import { GitpodPortsService } from "./gitpod-ports-service";


export const PORT_WIDGET_FACTORY_ID = 'ports';

@injectable()
export class GitpodPortViewWidget extends ReactWidget {
    @inject(MiniBrowserOpenHandler) private readonly miniBrowserOpenHandler: MiniBrowserOpenHandler;
    @inject(GitpodPortsService) private readonly portsService: GitpodPortsService;
    @inject(WindowService) private readonly windowService: WindowService;

    static LABEL = 'Open Ports';

    constructor() {
        super();
        this.node.tabIndex = 0;

        this.id = PORT_WIDGET_FACTORY_ID;
        this.title.label = GitpodPortViewWidget.LABEL;
        this.title.iconClass = 'fa fa-superpowers';
        this.title.closable = true;

        this.update();
    }

    protected onBeforeAttach(msg: Message): void {
        super.onBeforeAttach(msg);
        this.update();
        this.toDisposeOnDetach.push(this.portsService.onDidChange(() => this.update()));
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }

    protected render(): React.ReactNode {
        let nodes: React.ReactNode[] | undefined;
        for (const port of this.portsService.ports) {
            (nodes = nodes || []).push(<GitpodPortComponent {...{
                port,
                service: this.portsService,
                onOpenBrowser: this.openInBrowser,
                onOpenPreview: this.openInMiniBrowser,
            }} />);
        }
        return (<div className="portlist">
            {nodes || <div style={{ padding: "var(--theia-ui-padding)" }}>There are no services listening on any ports.</div>}
        </div>);
    }

    protected openInBrowser = (url: string) => {
        this.windowService.openNewWindow(url, { external: true });
    }

    protected openInMiniBrowser = async (url: string) => {
        await this.miniBrowserOpenHandler.openPreview(url);
    }

}

export interface GitpodPortComponentProps {
    port: PortsStatus.AsObject
    service: GitpodPortsService;
    onOpenBrowser: (url: string) => void;
    onOpenPreview: (url: string) => void;
}
class GitpodPortComponent extends React.Component<GitpodPortComponentProps> {

    render(): JSX.Element {
        const port = this.props.port;

        let label;
        const actions = [];
        if (!port.served) {
            label = 'not served';
        } else if (!port.exposed) {
            // This is an intermediate state now as we auto-open ports
            label = 'detecting...'
        } else {
            // TODO: extract serving process name (e.g. use netstat instead of /proc/net/tcp) and show here, i.e. don't override the label
            label = `open ${port.exposed.visibility === PortVisibility.PUBLIC ? '(public)' : '(private)'}`;

            actions.push(<button className="theia-button" onClick={this.onOpenPreview}>Open Preview</button>);
            actions.push(<button className="theia-button" onClick={this.onOpenBrowser}>Open Browser</button>);
        }

        if (port.exposed) {
            actions.push(<button className="theia-button" onClick={this.toggleVisiblity}>Make {port.exposed.visibility === PortVisibility.PUBLIC ? 'Private' : 'Public'}</button>);
        }

        const useIndicatorClass = `status-${port.served ? 'ib' : 'nb'}-${port.exposed ? 'ie' : 'ne'}`;
        return <div className="row exposedPort" id={"port-" + port.localPort}>
            <span className="useindicator"><i className={"fa " + useIndicatorClass}></i></span>
            <span className="number">{port.localPort}</span>
            <span className="name"> – {label}</span>
            <span className="actions">
                {actions}
            </span>
        </div>
    }

    private readonly onOpenPreview = () => {
        if (this.props.port.exposed) {
            this.props.onOpenPreview(this.props.port.exposed.url);
        }
    }

    private readonly onOpenBrowser = () => {
        if (this.props.port.exposed) {
            this.props.onOpenBrowser(this.props.port.exposed.url);
        }
    }

    private readonly toggleVisiblity = () => {
        if (this.props.port.exposed) {
            this.props.service.setVisibility(this.props.port, this.props.port.exposed.visibility === PortVisibility.PUBLIC ? 'private' : 'public');
        }
    }
}
