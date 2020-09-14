/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "../../../styles/port-view.css";

import { ReactWidget } from "@theia/core/lib/browser/widgets/react-widget";
import React = require("react");
import { injectable, inject, postConstruct } from "inversify";
import { ExposedPort, ServedPort } from "../../common/served-ports-service";
import { GitpodServiceProvider } from "../gitpod-service-provider";
import { PortConfig, PortVisibility } from "@gitpod/gitpod-protocol";
import { MiniBrowserOpenHandler } from "@theia/mini-browser/lib/browser/mini-browser-open-handler";
import { GitpodPortsService } from "./gitpod-ports-service";
import { Message } from "@phosphor/messaging";
import { DisposableCollection } from "@theia/core";

import "../../../styles/port-view.css";
import { getWorkspaceID } from "../utils";
export const PORT_WIDGET_FACTORY_ID = 'ports';

interface PortCache {
    [idx: string] : ExposedPort
}

@injectable()
export class GitpodPortViewWidget extends ReactWidget {
    @inject(MiniBrowserOpenHandler) protected miniBrowserOpenHandler: MiniBrowserOpenHandler;
    @inject(GitpodPortsService) protected portsService: GitpodPortsService;
    @inject(GitpodServiceProvider) protected serviceProvider: GitpodServiceProvider;

    static LABEL = 'Open Ports';

    constructor() {
        super();
        // required to make focus work
        this.node.tabIndex = 0;

        this.id = PORT_WIDGET_FACTORY_ID;
        this.title.label = GitpodPortViewWidget.LABEL;
        this.title.iconClass = 'fa fa-superpowers';
        this.title.closable = true;
        // call update() at the end of postConstruct()
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }

    protected workspaceId: string;
    protected isWorkspaceOwner: boolean;

    @postConstruct()
    protected async initialize() {
        this.workspaceId = getWorkspaceID();
        this.isWorkspaceOwner = await (this.serviceProvider.getService()).server.isWorkspaceOwner({ workspaceId: this.workspaceId });
        this.update();
    }

    protected render(): React.ReactNode {
        return (<GitpodPortViewComponent portsService={this.portsService} openInBrowser={this.openInBrowser} openInMiniBrowser={this.openInMiniBrowser} userOwnsWorkspace={this.isWorkspaceOwner} />);
    }

    protected openInBrowser = (url: string) => {
        // TODO: use open handler!
        window.open(url, `_blank`, 'noopener');
    }

    protected openInMiniBrowser = async (url: string) => {
        await this.miniBrowserOpenHandler.openPreview(url);
    }

}

interface GitpodPortViewState {
    instancePorts: PortConfig[];
    servedPorts: ServedPort[];
}
interface GitpodPortViewProps {
    userOwnsWorkspace: boolean;
    portsService: GitpodPortsService;
    openInBrowser: (url: string) => void;
    openInMiniBrowser: (url: string) => void;
}
class GitpodPortViewComponent extends React.Component<GitpodPortViewProps, GitpodPortViewState> {
    constructor(props: GitpodPortViewProps) {
        super(props);
        this.state = {
            instancePorts: [],
            servedPorts: []
        }
    }
    protected readonly toDisposeOnUnmount = new DisposableCollection();
    async componentDidMount(): Promise<void> {
        this.toDisposeOnUnmount.push(
            this.props.portsService.onPortsChanged(e => {
                if (e.exposed || e.served) {
                    this.setState(oldState => {
                        return {
                            instancePorts: e.exposed ? e.exposed.ports : oldState.instancePorts,
                            servedPorts: e.served ? e.served.ports : oldState.servedPorts
                        };
                    });
                }
            })
        );
        this.setState({
            instancePorts: await this.props.portsService.instancePorts,
            servedPorts: await this.props.portsService.servedPorts
        });
    }
    componentWillUnmount(): void {
        this.toDisposeOnUnmount.dispose();
    }
    render(): React.ReactNode {
        const ports : PortCache = {};
        this.state.instancePorts.forEach(ep => {
            const name = `port-${ep.port}`;
            ports[name] = {
                port: ep.port,
                served: 'not-served',
                exposed: true,
                visibility: ep.visibility
            };
        });
        this.state.servedPorts.forEach(sp => {
            const name = `port-${sp.portNumber}`;

            if (ports[name]) {
                ports[name].served = sp.served;
            } else {
                ports[name] = {
                    port: sp.portNumber,
                    served: sp.served,
                    exposed: false,
                    visibility: undefined   // This should only be the case if 1) we did not receive the instance port yet 2) we missed it
                }
            }
        });

        let portlist;
        if (Object.keys(ports).length > 0) {
            portlist = Object.keys(ports).map(idx => this.renderPort(ports[idx]));
        } else {
            portlist = <div style={{ padding: "var(--theia-ui-padding)" }}>There are no services listening on any ports.</div>;
        }

        return (<div className="portlist">
            { portlist }
        </div>);
    }

    protected renderPort(port: ExposedPort): JSX.Element {
        const portStateToCssClass = {
            'globally': 'ib',
            'locally': 'lb',
            'not-served': 'nb',
        }
        const useIndicatorClass = `status-${portStateToCssClass[port.served]}-${port.exposed ? 'ie' : 'ne'}`;

        let label;
        const actions = [];
        if (port.exposed) {
            if (port.served == 'globally') {
                actions.push(<button className="theia-button" data-port={port.port} onClick={this.onOpenPreview}>Open Preview</button>);
                actions.push(<button className="theia-button" data-port={port.port} onClick={this.onOpenBrowser}>Open Browser</button>);

                // TODO: extract serving process name (e.g. use netstat instead of /proc/net/tcp) and show here, i.e. don't override the label
                label = 'open';
            } else if (port.served == 'locally') {
                label = 'served on localhost only, thus cannot be exposed';
            } else {
                label = 'not served';
            }

            if (port.visibility === 'private') {
                actions.push(<button className="theia-button" onClick={() => this.onSwitchVisibility(port, 'public')}>Make Public</button>);
            } else if (port.visibility === 'public' ) {
                actions.push(<button className="theia-button" onClick={() => this.onSwitchVisibility(port, 'private')}>Make Private</button>);
            } else if (port.visibility === undefined) {
                // In case we missed a WorkspaceInstanceUpdate: as served ports default to private visibility, get them a "Make Public" button
                actions.push(<button className="theia-button" onClick={() => this.onSwitchVisibility(port, 'public')}>Make Public</button>);
            }
        } else {
            if (port.served == 'globally') {
                // This is an intermediate state now as we auto-open ports
                label = 'detecting...';
            } else if (port.served == 'locally') {
                label = 'served on localhost only, thus cannot be exposed';
            }
        }

        return <div className="row exposedPort" id={"port-"+port.port}>
            <span className="useindicator"><i className={"fa " + useIndicatorClass}></i></span>
            <span className="number">{ port.port }</span>
            <span className="name"> – { label }</span>
            <span className="actions">
                { actions }
            </span>
        </div>
    }

    protected onOpenPreview = (event: React.MouseEvent) => {
        if (event.target instanceof HTMLElement) {
            const port = event.target.dataset.port;
            if (!port) {
                return;
            }

            const url = this.props.portsService.getPortURL(parseInt(port));
            if (!url) {
                console.warn(`Port ${port} has no URL associated with it`)
                return;
            }

            this.props.openInMiniBrowser(url);
        }
    }

    protected onOpenBrowser = (event: React.MouseEvent) => {
        if (event.target instanceof HTMLElement) {
            const port = event.target.dataset.port;
            if (!port) {
                return;
            }

            const url = this.props.portsService.getPortURL(parseInt(port));
            if (!url) {
                console.warn(`Port ${port} has no URL associated with it`)
                return;
            }
            
            this.props.openInBrowser(url);
        }
    }

    protected onSwitchVisibility = (port: ExposedPort, newVisibility: PortVisibility) => {
        this.props.portsService.openPort(port, newVisibility);
    }
}
