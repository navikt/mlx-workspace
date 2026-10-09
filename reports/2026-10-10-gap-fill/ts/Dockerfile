# Q3 runner image, navikt/copilot benchmark/realistic/typescript pattern: deps vendored at build, runs offline.
# Build: docker build --secret id=npm_token,env=NPM_AUTH_TOKEN -t melosys-web-bench .
FROM node:22.23.2-bookworm
ARG REF=881771a0c1483ea287f94ef57dc264311fc862ba
WORKDIR /repo
RUN git init -q . && git fetch -q --depth 1 https://github.com/navikt/melosys-web.git $REF && git checkout -q FETCH_HEAD
RUN --mount=type=secret,id=npm_token \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/npm_token)" >> .npmrc \
 && corepack enable && pnpm install --frozen-lockfile --ignore-scripts \
 && git checkout -q .npmrc
