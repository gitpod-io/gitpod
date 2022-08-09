# StructDoc script

This directory contains a small script that would automatically generate a
markdown documentation for the supported parameters in the config file. The
script is intended to serve as an easy way to enable the creation of this doc
considering the heavily changing nature of the config. The script lets one also
create documentation for different versions of the Config file as well.

This script essentially parses the AST of the `config` package to aquire the
structure names, fields and docs associated to them. The script is highly
customized for parsing the `Config` struct, so cannot be applied for any other
structs for generic doc generation.

## Usage

This script is intended to be run from the root directory of the installer

``` sh
$ go run ./scripts/structdoc.go --version "v1"
INFO[0000] Generating doc for config version v1
INFO[0000] The doc is written to the file pkg/config/v1/config.md

# Alternatively one can also use the make target
# to create the doc for current version
$ make config-doc
Building doc from Config struct for current version
go run ./scripts/structdoc.go
INFO[0000] Generating doc for config version v1
INFO[0000] The doc is written to the file pkg/config/v1/config.md
```
