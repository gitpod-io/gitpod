/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Event, Emitter } from '@theia/core';
import { GitHubError } from '../github-model/github';

export class CommentForm {

    protected readonly state = {
        ...CommentForm.defaultState
    }

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

    protected readonly options: CommentForm.Props;
    constructor(options?: Partial<CommentForm.Props>) {
        this.options = {
            defaultBody: '',
            isValid: () => this.body.trim().length !== 0,
            ...options
        }
        this.reset();
    }

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    get valid(): boolean {
        return this.visible && !this.submitting && this.options.isValid();
    }

    get body(): string {
        return this.state.body;
    }
    set body(body: string) {
        this.state.body = body;
        this.fireDidChange();
    }

    get errors(): string[] {
        return this.state.errors;
    }
    protected setErrors(errors: string[]) {
        this.state.errors = errors;
        this.fireDidChange();
    }
    get submitting(): boolean {
        return this.state.submitting;
    }
    protected setSubmitting(submitting: boolean) {
        this.state.submitting = submitting;
        this.fireDidChange();
    }
    async submit(request: (body: string) => Promise<void>): Promise<void> {
        if (!this.valid) return;

        this.setSubmitting(true);
        try {
            await request(this.body);
            this.close();
        } catch (e) {
            const errors = GitHubError.getErrors(e);
            this.setErrors(errors ? errors.map(e => e.message) : ['Failed to submit']);
            throw e;
        } finally {
            this.setSubmitting(false);
        }
    }

    get visible(): boolean {
        return this.state.visible;
    }
    open(): void {
        if (this.visible) return;

        this.reset();
        this.state.visible = true;
        this.fireDidChange();
    }
    close(): void {
        if (!this.visible) return;

        this.state.visible = false;
        this.fireDidChange();
    }
    protected reset(): void {
        Object.assign(this.state, CommentForm.defaultState);
        this.state.body = this.options.defaultBody;
    }

}
export namespace CommentForm {
    export interface Props {
        defaultBody: string
        isValid: () => boolean
    }
    export interface State {
        body: string
        visible: boolean
        submitting: boolean
        errors: string[]
    }
    export const defaultState: Readonly<State> = Object.freeze({
        body: '',
        visible: false,
        selected: false,
        submitting: false,
        errors: []
    });
} 
