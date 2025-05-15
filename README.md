# Tatrapay+ Node.js SDK

[![Release](https://img.shields.io/github/v/release/SmartBase-SK/tatrapayplus-node)](https://img.shields.io/github/v/release/SmartBase-SK/tatrapayplus-node)
[![Build status](https://img.shields.io/github/actions/workflow/status/SmartBase-SK/tatrapayplus-node/node.js.yml?branch=main)](https://github.com/SmartBase-SK/tatrapayplus-node/actions/workflows/node.js.yml?query=branch%3Amain)
[![codecov](https://codecov.io/gh/SmartBase-SK/tatrapayplus-node/branch/main/graph/badge.svg)](https://codecov.io/gh/SmartBase-SK/tatrapayplus-node)
[![Commit activity](https://img.shields.io/github/commit-activity/m/SmartBase-SK/tatrapayplus-node)](https://img.shields.io/github/commit-activity/m/SmartBase-SK/tatrapayplus-node)
[![License](https://img.shields.io/github/license/SmartBase-SK/tatrapayplus-node)](https://img.shields.io/github/license/SmartBase-SK/tatrapayplus-node)

Node.js SDK for Tatrapay+ payment gateway.

- **Github repository**: <https://github.com/SmartBase-SK/tatrapayplus-node/>
- **Documentation** <https://sdk.tatrabanka.sk/docs/libraries/node/v1.0.0>

Types of application are generated automatically from swagger structure via [openapi-typescript](https://openapi-ts.dev/introduction).

# Type generation

To generate new types after OpenAPI structure has been changed please run
```
npx openapi-typescript ./tatrapayplus_api_sandbox.json -o ./src/paths.d.ts
```