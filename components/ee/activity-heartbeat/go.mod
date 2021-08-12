module github.com/gitpod-io/gitpod/ee/activity-heartbeat

go 1.16

require (
	github.com/cilium/ebpf v0.6.2
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/prometheus/client_golang v1.11.0
	golang.org/x/sys v0.0.0-20210630005230-0f9fa26af87c
)

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway
