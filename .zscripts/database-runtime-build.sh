#!/bin/bash

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"
BUILD_DIR="${BUILD_DIR:?BUILD_DIR is required}"
SOURCE_DB_DIR="$PROJECT_DIR/db"
SOURCE_DB_PATH="$SOURCE_DB_DIR/custom.db"
TARGET_DB_DIR="$BUILD_DIR/db"
TARGET_DB_PATH="$TARGET_DB_DIR/custom.db"

mkdir -p "$TARGET_DB_DIR"

# Task 60 数据保全：工作区 db/custom.db 缺失但存在 git 快照时（工作区重建后
# 的首次打包），用快照作为打包种子，不再初始化空库。
if [ ! -f "$SOURCE_DB_PATH" ] && [ -f "$SOURCE_DB_DIR/sync/rah-latest.db" ]; then
    echo "🗄️  db/custom.db 缺失，使用 git 快照 db/sync/rah-latest.db 作为种子"
    cp -a "$SOURCE_DB_DIR/sync/rah-latest.db" "$SOURCE_DB_PATH"
fi

if [ -f "$SOURCE_DB_PATH" ]; then
    echo "🗄️  复制 Preview 数据库到构建产物..."
    # 逐项复制数据库及同目录附属文件，但排除部署管线自身的产物（回拉备份、
    # 统计 json、快照临时文件）——它们只属于工作区，不应该被打进部署包。
    ( shopt -s dotglob nullglob
      for entry in "$SOURCE_DB_DIR"/*; do
        base="$(basename "$entry")"
        case "$base" in
          backups) continue ;;
          sync) continue ;;
          pre-pull-*.db|post-pull-*.db) continue ;;
          *.stats.json) continue ;;
          *.snapshot-*.tmp) continue ;;
        esac
        cp -a "$entry" "$TARGET_DB_DIR/"
      done )
else
    echo "ℹ️  未找到 Preview 数据库 db/custom.db，将初始化空的生产数据库"
fi

echo "🗄️  同步构建产物中的数据库结构..."
(
    cd "$PROJECT_DIR"
    DATABASE_URL="file:$TARGET_DB_PATH" bun run db:push
)

if [ ! -f "$TARGET_DB_PATH" ]; then
    echo "❌ 数据库初始化命令执行成功，但未生成 $TARGET_DB_PATH"
    exit 1
fi

echo "✅ 构建产物数据库已准备完成"
ls -lah "$TARGET_DB_DIR"
