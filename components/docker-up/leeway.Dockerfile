FROM scratch

LABEL skip-n.registry-facade.gitpod.io="1"
WORKDIR /usr/bin

COPY components-docker-up--app/* ./