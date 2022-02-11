https://minio.{{.Domain}} {
    import enable_log
    import remove_server_header
    import ssl_configuration

    reverse_proxy {{.ReverseProxy}} {
        flush_interval -1
    }
}