# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.
FROM node:18 as builder

ARG CODE_EXTENSION_COMMIT

RUN apt update -y \
    && apt install jq --no-install-recommends -y

RUN mkdir /gitpod-code-web \
    && cd /gitpod-code-web \
    && git init \
    && git remote add origin https://github.com/gitpod-io/gitpod-code \
    && git fetch origin $CODE_EXTENSION_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /gitpod-code-web
RUN yarn --frozen-lockfile --network-timeout 180000

# update package.json
RUN cd gitpod-web && \
    setSegmentKey="setpath([\"segmentKey\"]; \"untrusted-dummy-key\")" && \
    jqCommands="${setSegmentKey}" && \
    cat package.json | jq "${jqCommands}" > package.json.tmp && \
    mv package.json.tmp package.json
RUN yarn build:gitpod-web && yarn --cwd gitpod-web/ inject-commit-hash


FROM scratch

COPY --from=builder --chown=33333:33333 /gitpod-code-web/gitpod-web/out /ide/extensions/gitpod-web/out/
COPY --from=builder --chown=33333:33333 /gitpod-code-web/gitpod-web/public /ide/extensions/gitpod-web/public/
COPY --from=builder --chown=33333:33333 /gitpod-code-web/gitpod-web/resources /ide/extensions/gitpod-web/resources/
COPY --from=builder --chown=33333:33333 /gitpod-code-web/gitpod-web/package.json /gitpod-code-web/gitpod-web/package.nls.json /gitpod-code-web/gitpod-web/README.md /gitpod-code-web/gitpod-web/LICENSE.txt /ide/extensions/gitpod-web/
