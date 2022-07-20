module github.com/gitpod-io/gitpod/docker-up

go 1.18

require (
	github.com/opencontainers/runtime-spec v1.0.2
	github.com/rootless-containers/rootlesskit v1.0.1
	github.com/sirupsen/logrus v1.9.0
	github.com/spf13/pflag v1.0.5
	github.com/vishvananda/netlink v1.1.0
	golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
)

require github.com/vishvananda/netns v0.0.0-20211101163701-50045581ed74 // indirect
