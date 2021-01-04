/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { Commit } from '../github-model';
import { GitActorAvatarLink } from '../github-views';

export namespace CommitView {
    export interface Props {
        commit: Commit
    }
}
export class CommitView extends React.Component<CommitView.Props> {

    render(): JSX.Element {
        const commit = this.props.commit;
        const authoredByCommitter = Commit.authoredByCommitter(commit);
        return <div className="info" >
            <span className="icon-git-commit" />
            <GitActorAvatarLink actor={commit.author} size='small' />
            {authoredByCommitter ? null : <GitActorAvatarLink actor={commit.committer} size='small' />}

            <span className="header"
                title={commit.message}
                dangerouslySetInnerHTML={{ __html: commit.messageHeadlineHTML }} />
            <span>{commit.abbreviatedOid}</span>
        </div>
    }

}
