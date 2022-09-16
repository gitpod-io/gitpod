/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import CheckBox from "../CheckBox";

export default {
    title: "Components/CheckBox",
    component: CheckBox,
    argTypes: { onChange: { action: 'clicked' } },
};

const Template = args => <CheckBox {...args} />;

export const Checked = Template.bind({})
Checked.args = {
    title: "",
    desc: "",
    disabled: false,
    checked: true
}
Checked.parameters = {
    design: {
        type: "figma",
        url: "https://www.figma.com/file/BvrUZLXz4miGFd7oiQtyve/Component-Library?node-id=1044%3A257",
      },
}

export const Unchecked = Template.bind({})
Unchecked.args = {
    title: "",
    desc: "",
    disabled: false,
    checked: false
}

export const Disabled = Template.bind({})
Disabled.args = {
    title: "",
    desc: "",
    checked: false,
    disabled: true
}
