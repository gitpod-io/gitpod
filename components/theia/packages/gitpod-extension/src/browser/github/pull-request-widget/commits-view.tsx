/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { Commit } from '../github-model';
import { GitActorLink, ActorLink, Timeago } from '../github-views';
import { CommitView } from './commit-view';

export namespace CommitsView {
    export interface Props {
        commits: Commit[]
    }
}
export class CommitsView extends React.Component<CommitsView.Props> {

    render(): JSX.Element {
        return <div className="timeline-item">
            {this.renderSummary()}
            {this.renderCommits()}
        </div>
    }

    protected renderSummary(): JSX.Element {
        const time = this.props.commits[0].committedDate;
        return <div className="info summary">
            <span className="icon-repo-push" />

            <span className="header">
                {CommitsView.renderAuthors(this.props.commits)} added some commits {Timeago({ time })}
            </span>
        </div>
    }

    protected renderCommits(): JSX.Element | JSX.Element[] {
        return this.props.commits.map(commit =>
            <CommitView key={commit.id} commit={commit} />
        );
    }

    static renderAuthors(commits: Commit[]) {
        const authros = this.renderAuthorLinks(commits);
        const first = authros.next();
        if (first.done) {
            return ['Someone'];
        }
        const second = authros.next();
        if (second.done) {
            return first.value;
        }
        const third = authros.next();
        if (third.done) {
            return [first.value, ' and ', second.value];
        }
        return [first.value, ', ', second.value, ' and others'];
    }

    static * renderAuthorLinks(commits: Commit[]): IterableIterator<JSX.Element> {
        const names = new Set();
        for (const { author, committer } of commits) {
            for (const actor of [author, committer]) {
                if (actor) {
                    if (actor.user) {
                        if (!names.has(actor.user.login)) {
                            names.add(actor.user.login);
                            yield <ActorLink key={actor.user.login} actor={actor.user} />;
                        }
                    } else if (actor.name && !names.has(actor.name)) {
                        names.add(actor.name);
                        yield <GitActorLink key={actor.name} actor={actor} />;
                    }
                }
            }
        }
    }

}
