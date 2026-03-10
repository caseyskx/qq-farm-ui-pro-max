FROM golang:1.24-bookworm AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN GOPROXY=https://goproxy.cn,direct go mod download
COPY . .

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o /app/main main.go

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates tzdata && \
    ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/main .
COPY 08sae.dat rqtx.dat ./
COPY lib/libv08.so lib/libz.so ./lib/
COPY lib/key ./lib/
COPY conf/ ./conf/
COPY swagger/ ./swagger/

ENV LD_LIBRARY_PATH=/app:/app/lib

EXPOSE 8058

ENTRYPOINT ["./main"]
