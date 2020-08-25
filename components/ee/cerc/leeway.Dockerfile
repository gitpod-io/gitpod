# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.

FROM alpine:latest
COPY components-ee-cerc--app/cerc /cerc
ENTRYPOINT [ "/cerc" ]
CMD [ "-h" ]
