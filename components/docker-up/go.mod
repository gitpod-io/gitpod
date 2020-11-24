module github.com/gitpod-io/gitpod/docker-up

go 1.15

require (
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/opencontainers/runtime-spec v1.0.2
	github.com/rootless-containers/rootlesskit v0.10.1
	github.com/sirupsen/logrus v1.6.0
	github.com/spf13/pflag v1.0.5
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.33.2
)

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway
