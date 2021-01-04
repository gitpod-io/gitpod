/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable } from "@theia/core";

export class GitHubEditorViewZone implements monaco.editor.IViewZone, Disposable {

    protected id: string;
    readonly domNode = document.createElement('div');

    constructor(
        protected readonly host: HTMLElement,
        protected readonly editor: monaco.editor.ICodeEditor,
        protected readonly getLineNumber: () => number
    ) { }

    dispose(): void {
        this.hide();
    }

    show(): void {
        this.host.style.top = `-${Number.MAX_VALUE}px`;
        this.editor.changeViewZones(accessor => {
            this.id = accessor.addZone(this);
            this.doLayout();
        });
    }

    hide(): void {
        this.editor.changeViewZones(accessor => accessor.removeZone(this.id));
    }

    get afterLineNumber(): number {
        return this.getLineNumber();
    }

    get heightInPx(): number {
        return this.host.offsetHeight;
    }

    onDomNodeTop(top: number): void {
        this.host.style.top = top + 'px';
    }

    autoLayout(): void {
        const actual = this.domNode.style.height;
        const expected = this.heightInPx + 'px';
        if (actual !== expected) {
            this.layout();
        }
    }

    layout(info?: monaco.editor.EditorLayoutInfo): void {
        this.editor.changeViewZones(accessor => {
            accessor.layoutZone(this.id);
            this.doLayout(info);
        });
    }

    protected doLayout(info: monaco.editor.EditorLayoutInfo = this.editor.getLayoutInfo()): void {
        this.host.style.width = this.getWidth(info) + 'px';
    }

    protected getWidth(info: monaco.editor.EditorLayoutInfo): number {
        return info.width - info.minimapWidth - info.verticalScrollbarWidth;
    }

}
