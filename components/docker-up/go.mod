module github.com/gitpod-io/gitpod/docker-up

go 1.22.0

toolchain go1.23.3

require (
	github.com/opencontainers/runtime-spec v1.2.0
	github.com/rootless-containers/rootlesskit v1.1.1
	github.com/sirupsen/logrus v1.9.3
	github.com/spf13/pflag v1.0.6
	github.com/vishvananda/netlink v1.3.0
	golang.org/x/sys v0.30.0
	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da
)

require (
	github.com/google/go-cmp v0.6.0 // indirect
	github.com/vishvananda/netns v0.0.4 // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway
