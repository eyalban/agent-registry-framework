# Contributing

Thanks for the interest. The framework aims for a small, stable surface — the goal is that downstream apps can depend on it for years without breaking — so all changes should be made with that in mind.

## Reporting issues

Open an issue with:

- A short title describing the problem
- Steps to reproduce (including chain, block, tx hash if on-chain)
- What you expected vs what happened
- Environment: Node version, pnpm version, OS, browser if relevant

For suspected security issues in the contracts, **do not** open a public issue. Email the maintainers directly (see repo description for contact) or use GitHub's private advisory feature.

## Proposing a change

Before writing code, open an issue describing the change and tag it `proposal`. For anything that affects the contract ABI or the SDK's public API, expect a round or two of discussion — these are load-bearing.

Non-controversial changes (bug fixes, doc improvements, test additions) can skip the proposal step.

## Development setup

```bash
git clone https://github.com/eyalban/agent-blockchain-registry.git
cd agent-registry
pnpm install

# Contracts
cd packages/contracts
forge build
forge test                    # 62 tests should pass

# SDK / subgraph / shared
cd ../..
pnpm typecheck
pnpm lint
pnpm test
```

## Pull request checklist

Before opening a PR:

- [ ] `pnpm typecheck` passes (strict TS across all packages)
- [ ] `pnpm lint` passes (no new warnings, please)
- [ ] `forge test` passes in `packages/contracts/` (62/62)
- [ ] New contract functions have Foundry tests
- [ ] New SDK methods have Vitest tests
- [ ] `docs/` is updated if you changed a public primitive
- [ ] Commit messages are imperative mood, under 72 chars

## Code conventions

The full conventions are in [CLAUDE.md](CLAUDE.md) at the repo root. Highlights:

**TypeScript**

- No `any`. Use `unknown` + narrowing.
- No `as` casts except from `unknown` after a runtime check.
- No `@ts-ignore` / `@ts-expect-error`.
- 2-space indentation, single quotes, no semicolons, trailing commas (ES5).
- Imports sorted: external deps → internal `@agent-registry/*` → relative.
- Type-only imports use `import type { X }`.

**Solidity**

- `^0.8.24`, optimizer runs=200, `via_ir=true`.
- 4-space indent. `forge fmt` before commit.
- Custom errors, not `require` strings.
- NatSpec (`@dev`, `@param`, `@return`) on every public/external function.
- Every state-changing function emits an event.

**Files**

- Component files: kebab-case (`company-card.tsx`).
- Hook files: `use-*.ts`.
- Lib files: kebab-case.
- Solidity contracts: PascalCase matching the contract name.

## Scope discipline

The framework is intentionally minimal. These things are **in scope** for PRs:

- Bug fixes in existing contracts
- Additional Foundry tests (coverage gaps are always welcome)
- SDK ergonomics (better typing, docstrings, error messages)
- Subgraph improvements (new indexed fields derived from existing events)
- Docs (especially for non-experts)
- New tokens or chains in `packages/shared/src/constants/*.ts`
- Off-chain accounting library improvements (`apps/web/src/lib/` — reference implementations we're moving toward publishing)

These things are **out of scope** and will be closed:

- Framework opinions on UI/UX
- Non-EVM chain ports (keep as a fork)
- Advanced tax modeling (progressive brackets, credits) — belongs in a separate package
- Multi-sig on the `CompanyRegistry` owner slot — planned, but as a separate proposal thread

## Release process

We version `packages/sdk`, `packages/subgraph`, and `packages/shared` independently using semver. Contracts are versioned by deployment address (new deployment = new version; old deployments keep working forever).

Before a release:

1. Ensure all tests pass on `main`.
2. Bump the version in the relevant `package.json`.
3. Write a CHANGELOG entry.
4. Tag the release (`git tag sdk@v0.2.0 && git push --tags`).

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
