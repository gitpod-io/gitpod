module github.com/gitpod-io/gitpod/docker-up

go 1.20

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/opencontainers/runtime-spec v1.1.0-rc.1
	github.com/rootless-containers/rootlesskit v1.1.0
	github.com/sirupsen/logrus v1.9.0
	github.com/spf13/pflag v1.0.5
	github.com/vishvananda/netlink v1.1.0
	golang.org/x/sys v0.5.0
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
)

require (
	github.com/cilium/ebpf v0.4.0 // indirect
	github.com/containerd/cgroups v1.0.4 // indirect
	github.com/coreos/go-systemd/v22 v22.3.2 // indirect
	github.com/docker/go-units v0.4.0 // indirect
	github.com/godbus/dbus/v5 v5.0.4 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/vishvananda/netns v0.0.0-20191106174202-0a2b9b5464df // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway
