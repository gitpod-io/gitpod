https://*.{{.Domain}} {
    import enable_log
    import remove_server_header
    import ssl_configuration
    import debug_headers

    @kedge header_regexp host Host ^kedge-([a-z0-9]+).{{.Domain}}
    handle @kedge {
        reverse_proxy {{.ReverseProxy}} {
            import upstream_headers
            import upstream_connection
        }
    }

    respond "Not found" 404
}