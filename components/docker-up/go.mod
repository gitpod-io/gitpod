module github.com/gitpod-io/gitpod/docker-up

go 1.20

require (
	github.com/opencontainers/runtime-spec v1.1.0
	github.com/rootless-containers/rootlesskit v1.1.0
	github.com/sirupsen/logrus v1.9.3
	github.com/spf13/pflag v1.0.5
	github.com/vishvananda/netlink v1.1.0
	golang.org/x/sys v0.11.0
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
)

require (
	github.com/stretchr/testify v1.8.1 // indirect
	github.com/vishvananda/netns v0.0.0-20191106174202-0a2b9b5464df // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway
