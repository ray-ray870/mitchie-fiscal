# 年次データ更新の手順（毎年10月20日頃）

## ① 総務省サイトで新年度のExcelを探す（Claudeに手伝ってもらう）

Claudeに「今年のデータに更新して」と声をかければ、以下6種類のExcelのURLを一緒に探してくれます：

1. 全市町村・全都道府県の主要財政指標一覧
2. 基金残高等一覧（財政調整基金）
3. 住民基本台帳人口・人口動態
4. 市町村別・都道府県別決算状況調（歳出歳入）
5. 目的別歳出内訳
6. 住民基本台帳年齢階級別人口

## ② `scripts/config.json` を書き換える

GitHubアプリで `scripts/config.json` を開き、鉛筆アイコンで編集。
各URLを新しいものに書き換えて、一番上の `fiscal_year_label` と `population_year_label` も新年度に更新してコミット。

```json
{
  "fiscal_year_label": "令和7年度",     ← ここを書き換え
  "population_year_label": "令和8年",   ← ここを書き換え
  "fiscal_indicators": {
    "muni": "https://www.soumu.go.jp/main_content/新しい番号.xlsx",
    ...
