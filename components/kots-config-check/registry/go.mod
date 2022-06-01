module github.com/gitpod-io/gitpod/kots-config-check/registry

go 1.18

require (
	github.com/docker/distribution v0.0.0-20171011171712-7484e51bf6af // indirect
	github.com/docker/libtrust v0.0.0-20160708172513-aabc10ec26b7 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/klauspost/compress v1.11.13 // indirect
	github.com/konsorten/go-windows-terminal-sequences v1.0.1 // indirect
	github.com/moby/locker v1.0.1 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.3-0.20211202183452-c5a74bcca799 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	golang.org/x/net v0.0.0-20211216030914-fe4d6282115f // indirect
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c // indirect
	golang.org/x/sys v0.0.0-20220114195835-da31bd327af9 // indirect
	google.golang.org/genproto v0.0.0-20211208223120-3a66f561d7aa // indirect
	google.golang.org/grpc v1.45.0 // indirect
	google.golang.org/protobuf v1.28.0 // indirect
)

replace github.com/gitpod-io/gitpod/image-builder => ../../image-builder-mk3 // leeway

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

require (
	github.com/containerd/containerd v1.6.4
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/heroku/docker-registry-client v0.0.0-20211012143308-9463674c8930
	github.com/spf13/cobra v1.3.0
)
