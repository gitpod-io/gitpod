https://registry.{{.Domain}} {
    import enable_log
    import remove_server_header
    import ssl_configuration

    basicauth bcrypt "Docker Registry" {
        {{.Username }} {{.Password}}
    }

    reverse_proxy {{.ReverseProxy}} {
        flush_interval -1
        transport http {
            tls_trusted_ca_certs /etc/caddy/registry-certs/ca.crt
        }
    }
}