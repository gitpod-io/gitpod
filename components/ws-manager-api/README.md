## Overview
The ws-manager-api component hosts the api component of ws-manager.

## Making changes to the api
First, make sure those changes are really neccesary. We want to keep the interface as trim as possible.
To make changes, edit `core.proto` ideally in a backwards compatible manner. Then run `./generate.sh` in this directory to re-generate the GO and TypeScript protocol implementations.
