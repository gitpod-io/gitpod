# addlicense

Fork of https://github.com/google/addlicense

The program ensures source code files have copyright license headers
by scanning directory patterns recursively.

It modifies all source files in place and avoids adding a license header
to any file that already has one.

## install

    go get -u github.com/google/addlicense

## usage

    addlicense [flags] pattern [pattern ...]

    -c copyright holder (defaults to "Google LLC")
    -f custom license file (no default)
    -l license type: apache, bsd, mit, mpl (defaults to "apache")
    -y year (defaults to current year)
    -check check only mode: verify presence of license headers and exit with non-zero code if missing

The pattern argument can be provided multiple times, and may also refer
to single files.

## license

Apache 2.0

This is not an official Google product.
