module github.com/gitpod-io/gitpod/ws-daemon/kubelet-config-fix

go 1.16

require (
	github.com/coreos/go-systemd/v22 v22.3.1
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
)

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway
