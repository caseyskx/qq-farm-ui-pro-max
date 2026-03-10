Drop extracted item icon files into this directory.

Import command:
- `pnpm import:item-icons -- --source /path/to/extracted/assets`
- `pnpm import:item-icons -- --source /dir/a --source /dir/b --dry-run`
- `pnpm import:item-icons -- --wechat-cache --dry-run`

Useful flags:
- `--force` overwrite existing files in this directory
- `--dest /tmp/item_icons` import into another directory first
- `--report /tmp/item-icon-report.json` write the match report to a custom path
- `--wechat-cache` scan the default macOS WeChat mini program cache directory

Default behavior:
- real import writes a report to `core/src/gameConfig/item_icons/import-report.json`
- dry run only prints summary unless `--report` is provided

Mini program cache support:
- if a source directory contains `.wxapkg`, the importer will scan image entries inside the package directly
- this works well with macOS WeChat cache: `~/Library/Containers/com.tencent.xinWeChat/Data/.wxapplet/packages`
- for cached mini programs, you do not need to unpack `.wxapkg` manually

Supported naming:
- `<itemId>.png`
- `<itemId>.webp`
- `<normalized-icon-res>.png`
- `<normalized-icon-res>.webp`

Normalization rule for `icon_res` / `asset_name`:
- remove trailing `/spriteFrame`
- replace non-alphanumeric chars with `_`
- lowercase

Examples:
- `gui/texture/icon/icon_feterlize1/spriteFrame` -> `gui_texture_icon_icon_feterlize1.png`
- `gui/texture/icon/dogFood1/spriteFrame` -> `gui_texture_icon_dogfood1.webp`

Resolution priority:
1. seed/fruit images from `seed_images_named`
2. exact item ID match in this directory
3. normalized `icon_res` / `asset_name` match in this directory
4. generated cached SVG in `data/asset-cache/item-icons`
