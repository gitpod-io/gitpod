/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import Typography from '@material-ui/core/Typography';

export default class IconDetail extends React.Component<{
    text?: string,
    iconSrc: string,
    link?: string
}, {}> {

    render() {
        if (!this.props.text) {
            return <div />;
        }
        const contents = (
            <div style={{ flexGrow: 1 }}>
                <Typography>
                    {this.props.text}
                </Typography>
            </div>
        );
        return (
            <div className='iconed-detail'>
                <div className='icon' dangerouslySetInnerHTML={{ __html: this.props.iconSrc }}>
                </div>
                {this.props.link ?
                    <a href={this.props.link}>{contents}</a>
                    : contents
                }
            </div>
        );
    }
}