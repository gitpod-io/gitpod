/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from 'react';
import RepositoryFinder from '../components/RepositoryFinder';

export default function Open() {
    const [initialQuery, setInitialQuery] = useState<string | undefined>();

    // Support pre-filling the search bar via the URL hash
    useEffect(() => {
        const onHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (hash) {
                setInitialQuery(hash);
            }
        };
        onHashChange();
        window.addEventListener('hashchange', onHashChange, false);
        return () => {
            window.removeEventListener('hashchange', onHashChange, false);
        };
    }, []);

    return (
        <div className="mt-24 mx-auto w-96 flex flex-col items-stretch">
            <h1 className="text-center">Open in Gitpod</h1>
            <div className="mt-8">
                <RepositoryFinder initialQuery={initialQuery} />
            </div>
        </div>
    );
}
