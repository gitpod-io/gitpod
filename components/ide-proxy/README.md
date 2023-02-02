# IDE-proxy

IDE proxy is a simple Caddy application that currently only serve static files e.g. the IDE logo

Attention: All files in the static folder should be immutable, if you need to change them you have to add new files and change the references

For example, to change the IDE logo you must upload a new file and change the `ide-config` configmap
