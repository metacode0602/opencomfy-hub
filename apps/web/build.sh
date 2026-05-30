#!/bin/bash

rm -rf .next
# 定义内存限制大小，单位为MB
NODE_MEMORY_LIMIT=4096

# 执行带有内存限制的pnpm构建命令
NODE_OPTIONS="--max-old-space-size=$NODE_MEMORY_LIMIT" pnpm build

# pnpm 的 standalone 里常见符号链接（如 apps/web/node_modules/next -> ../../node_modules/.pnpm/...）。
# 部署时若未跟随链接复制，目标机上会出现 Cannot find module 'next'。用 cp -aL 物化为真实文件。
STANDALONE=".next/standalone"
if [ -d "$STANDALONE" ]; then
  # Next.js + pnpm 的 standalone 可能留下指向未打包版本的断链（如 semver@6.3.1），
  # cp -aL 跟随链接时会失败；实际依赖（如 semver@7.x）已在输出中，删除断链即可。
  find "$STANDALONE" -type l ! -exec test -e {} \; -delete

  STAND_TMP="${STANDALONE}_materialized_$$"
  rm -rf "$STAND_TMP"
  cp -aL "$STANDALONE" "$STAND_TMP" || exit 1
  rm -rf "$STANDALONE"
  mv "$STAND_TMP" "$STANDALONE" || exit 1
fi

cp ./bin/* .next/standalone/
cp -rf public .next/standalone/apps/web/

cp -rf ./.next/static .next/standalone/apps/web/.next/

# 检查上一条命令的退出状态
if [ $? -eq 0 ]; then
  echo "构建成功完成。"
else
  echo "构建失败。"
fi


