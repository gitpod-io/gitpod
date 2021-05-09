module github.com/gitpod-io/local-app

go 1.16

require (
	github.com/armon/consul-api v0.0.0-20180202201655-eb2c6b5be1b6 // indirect
	github.com/coreos/go-etcd v2.0.0+incompatible // indirect
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/jpillora/chisel v1.7.6
	github.com/kevinburke/ssh_config v1.1.0
	github.com/nirasan/go-oauth-pkce-code-verifier v0.0.0-20170819232839-0fbfe93532da // indirect
	github.com/sirupsen/logrus v1.7.0
	github.com/skratchdot/open-golang v0.0.0-20200116055534-eef842397966 // indirect
	github.com/spf13/viper v1.7.1 // indirect
	github.com/ugorji/go/codec v0.0.0-20181204163529-d75b2dcb6bc8 // indirect
	github.com/urfave/cli/v2 v2.3.0
	github.com/xordataexchange/crypt v0.0.3-0.20170626215501-b2862e3d0a77 // indirect
	github.com/zalando/go-keyring v0.1.1
	golang.org/x/oauth2 v0.0.0-20210427180440-81ed05c6b58c // indirect
	golang.org/x/sys v0.0.0-20210403161142-5e06dd20ab57 // indirect
	google.golang.org/grpc v1.37.0
)

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway
