/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Link } from "react-router-dom";
import Header from "../components/Header";
import projectsEmpty from '../images/projects-empty.svg';

export default function() {
    return <>
        <Header title="Projects" subtitle="Manage recently added projects." />
        <div>
            <img alt="Projects (empty)" className="h-44 mt-24 mx-auto" role="presentation" src={projectsEmpty} />
            <h3 className="text-center text-gray-500 mt-8">No Recent Projects</h3>
            <p className="text-center text-base text-gray-500 mt-4">Add projects to enable and manage Prebuilds.<br/><a className="learn-more" href="https://www.gitpod.io/docs/prebuilds/">Learn more about Prebuilds</a></p>
            <div className="flex space-x-2 justify-center mt-7">
                <button>New Project</button>
                <Link to="./members"><button className="secondary">Invite Members</button></Link>
            </div>
        </div>
    </>;
}