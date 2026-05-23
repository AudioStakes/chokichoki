# ちょきちょきおりがみ prototype

5歳児向けの「折る → 図形で切る → ひらく → 模様を見る」体験プロトタイプです。

## ファイル名

メイン実装は以下です。

```txt
prototype/src/ChokiChokiOrigamiPrototype.jsx
```

この名前にしておくと、後で本実装へ移すときも「これは試作版」と分かりやすいです。

## 起動方法

```bash
cd prototype
npm install
npm run dev
```

表示されたURLをブラウザで開いてください。
スマホで試す場合は、同じWi-Fi上の端末からViteが表示するNetwork URLへアクセスします。

## ビルド

```bash
npm run build
npm run preview
```

## このプロトタイプに入っているもの

- 文字なしUI
- スマホ縦画面優先
- 水色の正方形折り紙
- 折るボタン
- 最大3回折り
- 図形選択：○・△・□・♡・☆
- タップ位置への切り抜き
- 最大10個までの切り抜き
- 端の切り抜きは紙内だけ見えるようにクリップ
- ひらくボタン
- 展開時の鏡写し配置
- 色変更
- 音ON/OFF
- 完成時のキラキラ
- 新しい紙ボタン

## 注意

この版はThree.js本実装前のCanvas用プロトタイプです。
立体表現はFramer MotionとSVGによる「軽めの3D風」です。
将来の本実装では、React Three Fiber / Three.jsへ移行し、内部の2D幾何モデルを維持する想定です。
