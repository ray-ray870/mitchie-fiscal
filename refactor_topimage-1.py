"""
images.js の top 画像（base64データ）を新しいものに差し替えるスクリプト。

使い方:
    python scripts/refactor_topimage.py preview   # preview/ フォルダに書き出す（本番は無傷）
    python scripts/refactor_topimage.py apply      # 本番の images.js を直接書き換える

検証に1つでも失敗した場合は、ファイルを一切書き込まずに異常終了する。
"""
import sys
import os
import re
import shutil
import base64

MODE = sys.argv[1] if len(sys.argv) > 1 else ""
if MODE not in ("preview", "apply"):
    print("::error::実行モードは preview か apply のどちらかを指定してください。")
    sys.exit(1)

B64_PATH = "scripts/new_top_b64.txt"
IMAGES_JS = "images.js"

# --- 1. 必要なファイルがあるか確認 ---
if not os.path.exists(B64_PATH):
    print(f"::error::{B64_PATH} が見つかりません。")
    sys.exit(1)

if not os.path.exists(IMAGES_JS):
    print(f"::error::{IMAGES_JS} が見つかりません。")
    sys.exit(1)

# --- 2. 新しい画像データを検証 ---
new_b64 = open(B64_PATH, encoding="utf-8").read().strip()
if not new_b64:
    print("::error::新しい画像データが空です。")
    sys.exit(1)

try:
    decoded = base64.b64decode(new_b64, validate=True)
except Exception as e:
    print(f"::error::新しい画像データがbase64として不正です: {e}")
    sys.exit(1)

if not decoded.startswith(b"\x89PNG"):
    print("::error::新しい画像データがPNG形式ではありません。")
    sys.exit(1)

if len(decoded) < 1000:
    print("::error::新しい画像データが小さすぎます（壊れている可能性）。")
    sys.exit(1)

# --- 3. images.js の中の top: を差し替え ---
content = open(IMAGES_JS, encoding="utf-8").read()
m = re.search(r'(top:\s*")([^"]+)(")', content)
if not m:
    print("::error::images.js の中に top: のデータが見つかりません。")
    sys.exit(1)

old_b64 = m.group(2)

# --- 4. 二重適用ガード ---
if old_b64 == new_b64:
    print("::error::新旧の画像データが同一です。既に適用済みの可能性があるため中止します。")
    sys.exit(1)

new_content = content[: m.start(2)] + new_b64 + content[m.end(2):]

# --- 5. 簡易な構文バランス確認 ---
if new_content.count("{") != new_content.count("}"):
    print("::error::images.js の中括弧の数が一致しません。書き込みを中止します。")
    sys.exit(1)

if new_content.count('"') % 2 != 0:
    print("::error::images.js のダブルクォートの数が奇数です。書き込みを中止します。")
    sys.exit(1)

# --- 6. 書き込み ---
if MODE == "preview":
    if os.path.exists("preview"):
        print("::error::preview フォルダが既に存在します。先に削除してから実行してください（二重実行防止）。")
        sys.exit(1)

    os.makedirs("preview", exist_ok=True)

    # preview ページがそのまま動くよう、必要なファイル一式をコピーする
    # （パス書き換えではなくコピー方式にすることで ../ 対応を不要にしている）
    copy_targets = ["index.html", "style.css", "app.js", "manifest.json"]
    copy_targets += sorted(f for f in os.listdir(".") if f.startswith("data-") and f.endswith(".json"))

    for f in copy_targets:
        if os.path.exists(f):
            shutil.copy(f, os.path.join("preview", f))
        else:
            print(f"::warning::{f} が見つからなかったのでpreviewにコピーしませんでした。")

    with open(os.path.join("preview", "images.js"), "w", encoding="utf-8") as f:
        f.write(new_content)

    print("preview/images.js に書き出しました。本番の images.js は変更していません。")
    print(f"旧データ: {len(old_b64)}文字 → 新データ: {len(new_b64)}文字")

else:  # apply
    with open(IMAGES_JS, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("images.js を更新しました。")
    print(f"旧データ: {len(old_b64)}文字 → 新データ: {len(new_b64)}文字")
