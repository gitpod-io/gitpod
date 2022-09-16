/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

//@ts-nocheck
import Card from "../Card";

export default {
    title: "Components/Card",
    component: Card,
};

export const Default = (args) => {
    return <Card {...args} />;
};

export const Something = Default.bind({});
Something.args = {
    className: "w-72 h-64",
};
