https://open-vsx.{{.Domain}} {
    import enable_log_debug
    import remove_server_header
    import ssl_configuration

    reverse_proxy  {
        to {{.RepoURL}}
    }
}