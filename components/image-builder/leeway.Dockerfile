# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:latest

RUN apk add --no-cache git bash ca-certificates
COPY components-image-builder--app/image-builder /app/
RUN chmod +x /app/image-builder

COPY components-image-builder-workspace-image-layer--pack/pack.tar /app/workspace-image-layer.tar.gz

ENTRYPOINT [ "/app/image-builder" ]
CMD [ "-v", "help" ]