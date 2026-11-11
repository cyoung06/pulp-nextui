# pulp-nextui: the Next.js export of web/, built from its lockfile and embedded into a static Go
# binary on distroless. Whatever a local build left in internal/web/ui is discarded first.
FROM node:24 AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.25 AS build
WORKDIR /src
COPY go.mod ./
COPY cmd/ cmd/
COPY internal/ internal/
RUN find internal/web/ui -mindepth 1 ! -name .gitignore -delete
COPY --from=web /web/out/ internal/web/ui/
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/pulp-nextui ./cmd/pulp-nextui

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/pulp-nextui /usr/local/bin/pulp-nextui
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/pulp-nextui"]
