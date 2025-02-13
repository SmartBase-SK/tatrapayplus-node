# Tatrapay+ node SDK

Source repository for npm package for Tatrapay+ payment gateway.

Types of application are generated automatically from swagger structure via [openapi-typescript](https://openapi-ts.dev/introduction).

# Type generation

To generate new types after OpenAPI structure has been changed please run
```
npx openapi-typescript ./tatrapayplus_api_sandbox.json -o ./src/paths.d.ts
```