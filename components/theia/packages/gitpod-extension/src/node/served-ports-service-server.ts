/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ILogger } from "@theia/core/lib/common";
import { inject, injectable, postConstruct } from "inversify";
import { ServedPortsServiceClient, ServedPortsServiceServer, ServedPort, PortServedState } from "../common/served-ports-service";
import { exec, spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

const PORT_READY = "port-ready";

@injectable()
export class ServedPortsServiceServerImpl implements ServedPortsServiceServer {
    @inject(ILogger) protected readonly logger: ILogger;

    protected clients: ServedPortsServiceClient[] = [];
    protected forwardedPorts = new Map<number, ChildProcess>();
    protected readyPorts = new Map<number, boolean>();
    protected portEmitter = new EventEmitter();

    @postConstruct()
    init(): void {
        this.start();
    }

    dispose(): void {
    }

    setClient(client: ServedPortsServiceClient): void {
        this.clients.push(client);
    }

    disposeClient(client: ServedPortsServiceClient): void {
        const idx = this.clients.indexOf(client);
        if (idx > -1) {
            this.clients.splice(idx, 1);
        }

        if (this.clients.length == 0) {
            this.dispose();
        }
    }

    async getOpenPorts(): Promise<ServedPort[]> {
        try {
            return this.correctLocalGlobal(await this.internalGetOpenPorts());
        } catch (error) {
            console.log(error);
        }
        return [];
    }

    /**
     * A port is ready once it was forwarded successfully
     * @param port 
     */
    async isPortReady(port: number): Promise<boolean> {
        return this.readyPorts.has(port);
    }

    /**
     * Waits until a port has become ready (@method isPortReady) and returns true. If timeout occurs first it returns false.
     * @param port
     * @param timeoutMillis
     */
    async waitUntilPortIsReady(port: number, timeoutMillis: number = 5000): Promise<boolean> {
        const isPortReady = await this.isPortReady(port);
        if (isPortReady) {
            return true;
        }

        return new Promise((resolve) => {
            let timer: NodeJS.Timer | undefined = undefined;
            const listener = async (servedPort: ServedPort) => {
                if (port === servedPort.portNumber) {
                    this.portEmitter.removeListener(PORT_READY, listener);
                    if (timer) {
                        clearTimeout(timer);
                    }
                    resolve(true);
                }
            };
            this.portEmitter.on(PORT_READY, listener);
            timer = setTimeout(() => {
                this.portEmitter.removeListener(PORT_READY, listener);
                resolve(false);
            }, timeoutMillis)
        });
    }

    protected correctLocalGlobal(ports: ServedPort[]): ServedPort[] {
        return ports.map(p => {
            const res = { ...p };
            if (res.served == 'locally' && res.internalPort != res.portNumber) {
                // the process itself is actually local, but we're forwarding it, thus making it global
                res.served = 'globally';
            }
            return res;
        });
    }

    protected async internalGetOpenPorts(): Promise<ServedPort[]> {
        const ports = await this.internalGetPorts();
        return ports.publicPorts;
    }

    protected async internalGetPorts(): Promise<{ allPorts: ServedPort[], publicPorts: ServedPort[], forwardedPorts: ServedPort[] }> {
        const rawProcInfo = await this.execute('cat /proc/net/tcp /proc/net/tcp6');
        const allPorts = this.findListeningPorts(rawProcInfo);
        const publicPorts = this.filterInternalPorts(allPorts);
        const forwardedPorts = this.filterForwardedPorts(allPorts);
        return {
            allPorts,
            publicPorts,
            forwardedPorts
        };
    }

    protected async forwardPort(port: ServedPort): Promise<void> {
        if (port.portNumber === port.internalPort) {
            this.readyPorts.set(port.portNumber, false);
            this.portEmitter.emit(PORT_READY, port);    // Ports that don't need any forwarding are instantly ready
            return;
        }

        const args = ["forward-port"];
        if (port.served == 'locally') {
            args.push("-r");
        }
        args.push(port.portNumber.toString());
        args.push(port.internalPort.toString());

        const proc = spawn("gp", args, { stdio: 'ignore', detached: true });
        this.forwardedPorts.set(port.portNumber, proc);
        proc.on('error', (err) => this.logger.warn(`gp forward-port error: ${err}`))
        proc.on('exit', () => this.forwardedPorts.delete(port.portNumber));

        this.logger.debug(`started gp forward port for ${port.internalPort} -> ${port.portNumber}`);
    }

    protected start(): void {
        setInterval(async () => {
            try {
                await this.checkPorts();
            } catch (err) {
                const message = err ? "Served ports check: " + err.message : "Served ports check failed.";
                this.logger.info(message);
            }
        }, 1000);
    }

    protected previouslyOpenPorts: ServedPort[] = [];
    protected async checkPorts(): Promise<void> {
        if (this.clients.length == 0) {
            return;
        }

        let openPorts: ServedPort[];
        let forwardedPorts: ServedPort[];
        try {
            const ports = await this.internalGetPorts();
            openPorts = ports.publicPorts;
            forwardedPorts = ports.forwardedPorts;
        } catch (e) {
            console.error("Error while retrieving ports. There's no port autodiscovery.", e);
            return;
        }

        // Emit PORT_READY for all ports that already have been forwarded successfully (e.g., the internal port was bound successfully)
        forwardedPorts.map(p => {
            if (!this.readyPorts.has(p.portNumber)) {
                this.readyPorts.set(p.portNumber, true);
                this.portEmitter.emit(PORT_READY, p);
            }
        });

        const portDiff = this.setMinus(this.previouslyOpenPorts, openPorts);
        if (!portDiff.hasDifference) {
            return;
        }

        console.log("Ports changed: ", this.previouslyOpenPorts, openPorts);
        this.previouslyOpenPorts = openPorts;
        const rawOpened = portDiff.bSubA;
        const ports = this.correctLocalGlobal(openPorts);
        const didOpen = this.correctLocalGlobal(rawOpened);
        const didClose = this.correctLocalGlobal(portDiff.aSubB);
        this.clients.forEach(c => c.onServedPortsChanged({ ports, didOpen, didClose }));

        try {
            didClose.map(p => this.forwardedPorts.get(p.portNumber)).filter(p => !!p).forEach(p => p!.kill());
            didClose.map(p => this.readyPorts.delete(p.portNumber));
        } catch (e) {
            console.error("Error while stopping gp forward-port.", e);
        }
        try {
            await Promise.all(rawOpened.map(p => this.forwardPort(p)));
        } catch (e) {
            console.error("Error while starting gp forward-port.", e);
        }
    }

    protected filterInternalPorts(ports: ServedPort[]) {
        /* We have a few ports which we use internally, specifically:
         *   23000 for Theia
         *   44444 for ws-syncd
         *
         * Those ports must not be exposed by the user.
         */
        return ports.filter(p => p.portNumber != 22999 && p.portNumber != 23000 && p.portNumber != 23222 && p.portNumber != 44444)
            .filter(p => !this.forwardedPorts.has(p.portNumber - 30000));
    }

    protected filterForwardedPorts(ports: ServedPort[]): ServedPort[] {
        return ports.filter(p => this.forwardedPorts.has(p.portNumber));
    }

    protected setMinus(a: ServedPort[], b: ServedPort[]) {
        /* In the worst case: this is quadradtic, but considering the low number of ports (< 10)
         * users will have open, it doesn't really matter.
         */
        const aSubB = a.filter(pa => !b.find(pb => pa.portNumber == pb.portNumber));
        const bSubA = b.filter(pb => !a.find(pa => pb.portNumber == pa.portNumber));

        return {
            hasDifference: aSubB.length != 0 || bSubA.length != 0,
            aSubB,
            bSubA
        };
    }

    protected async execute(cmd: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const term = exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    resolve(stdout);
                }
            });
            term.stdin.write(`${cmd}; exit\n`);
        });
    }

    protected findListeningPorts(rawProcInfo: string): ServedPort[] {
        const result: ServedPort[] = [];
        const unfiltered = rawProcInfo.trim()
            // row by row
            .split('\n')
            // split into segments (whitespace separated)
            .map(l => l.split(' ').filter(i => i.length > 0))
            // make sure the line is "valid", i.e. at least has enough segments
            .filter(l => l.length > 4)
            // extract the segments we care about
            .map(l => {
                return {
                    address: l[1],
                    status: l[3]
                }
            })
            // see https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/include/net/tcp_states.h?id=HEAD, TCP_LISTEN
            .filter(e => e.status == '0A')
            // take apart the address
            .map(e => e.address.split(':'))
            // filter for open ports listening on 0.0.0.0
            // parse the port which is in hex and the part after the last ':'
            .map(px => {
                const portNumber = parseInt(px[px.length - 1], 16);
                const isGlobal = px[0] == '00000000' || px[0] == '00000000000000000000000000000000';
                let served: PortServedState = isGlobal ? 'globally' : 'locally';
                let internalPort = 30000 + portNumber;
                if (internalPort > 65535) {
                    internalPort = portNumber;
                }

                return { served, portNumber, internalPort };
            });

        // create distinct result
        const set = new Set();
        for (const candidate of unfiltered) {
            const key = JSON.stringify(candidate);
            if (!set.has(key)) {
                result.push(candidate);
            }
            set.add(key);
        }
        return result;
    }

}
