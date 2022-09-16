/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Arrow from "../Arrow";

export default {
    title: "Components/Arrow",
    component: Arrow,
};

const Template = args => <Arrow {...args} />;

export const Up = Template.bind({})
Up.args = {
    direction: "up"
}

export const Down = Template.bind({})
Down.args = {
    direction: "down"
}

export const Left = Template.bind({})
Left.args = {
    direction: "left"
}

export const Right = Template.bind({})
Right.args = {
    direction: "right"
}
