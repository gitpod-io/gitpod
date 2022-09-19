module github.com/gitpod-io/gitpod/docker-up

go 1.18

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/opencontainers/runtime-spec v1.0.3-0.20220601164019-72c1f0b44f79
	github.com/rootless-containers/rootlesskit v1.0.1
	github.com/sirupsen/logrus v1.9.0
	github.com/spf13/pflag v1.0.5
	github.com/vishvananda/netlink v1.1.1-0.20210330154013-f5de75959ad5
	golang.org/x/sys v0.0.0-20220919091848-fb04ddd9f9c8
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
)

require (
	github.com/cilium/ebpf v0.9.0 // indirect
	github.com/containerd/cgroups v1.0.4 // indirect
	github.com/coreos/go-systemd/v22 v22.3.2 // indirect
	github.com/docker/go-units v0.4.0 // indirect
	github.com/godbus/dbus/v5 v5.1.0 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/google/go-cmp v0.5.8 // indirect
	github.com/stretchr/testify v1.8.0 // indirect
	github.com/vishvananda/netns v0.0.0-20211101163701-50045581ed74 // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway
