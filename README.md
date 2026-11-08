# 露營裝備清單

6 人・2 帳的露營裝備確認清單：出發倒數、公共裝備、炊具和個人行李打勾，進度列固定在畫面最上方。
純 HTML／CSS／JavaScript，不需要後端、不用安裝或建置，放上 GitHub Pages 就能用。

![預覽圖](og-image.png)

## 功能

- **出發倒數**：上方和開場都會顯示 D-幾天；出發前 9 天內會多一排日期，標出今天和出發日
- **固定在上方的進度列**：往下捲動時，「公共」和「行李」兩條進度一直看得到，點一下會跳到該區
- **公共裝備 16 項、炊具 5 項**：打勾代表已備妥，全部勾完會有慶祝動畫
- **出發前先問營區**：插座位置、能不能用吹風機、飲水設備
- **個人行李 12 項**：全部勾完會有慶祝動畫
- **貼到群組**：把公共清單或個人行李的勾選狀態複製成文字，貼到 LINE 群組；手機上也能用分享選單直接傳

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 頁面、清單內容和出發日期（`CAMP_DATA` 那一段）、互動程式 |
| `style.css` | 樣式與動畫 |
| `og-image.png` | 在 LINE、Facebook 分享網址時的預覽圖 |
| `apple-touch-icon.png` | iPhone「加入主畫面」的圖示 |

所有檔案放在同一層，不需要資料夾。舊版的 `data.js`、`app.js` 已經併進 `index.html`，repository 裡如果還有，可以刪除。

## 部署到 GitHub Pages

1. 在 GitHub 建立新的 repository，例如 `camping-checklist`，設成 **Public**
   （免費方案的 GitHub Pages 只支援 Public repository）
2. 在 repository 頁面按 **Add file → Upload files**，把上面 4 個檔案拖進去，按 **Commit changes**
3. 到 **Settings → Pages**，在 **Build and deployment** 的 **Source** 選 **Deploy from a branch**
4. Branch 選 `main`，資料夾選 `/ (root)`，按 **Save**
5. 等一到兩分鐘，網址會是 `https://你的帳號.github.io/camping-checklist/`

更新檔案時，一樣用 **Add file → Upload files** 上傳同名檔案就會覆蓋，幾分鐘後網站自動更新。

### （選用）讓分享預覽圖穩定顯示

LINE、Facebook 抓預覽圖時通常需要完整網址。部署完成後，把 `index.html` 裡這一行：

```html
<meta property="og:image" content="og-image.png">
```

改成：

```html
<meta property="og:image" content="https://你的帳號.github.io/camping-checklist/og-image.png">
```

## 使用方式

1. 打開網址，往下捲到各區一項一項打勾
2. 上方進度列隨時看得到還差幾樣
3. 需要回報時，到「貼到群組」複製文字貼到 LINE

工作分配請在群組裡自行討論，這個網頁只負責清單確認。

## 資料存在哪裡

- 勾選紀錄存在瀏覽器的 localStorage，只在那一台裝置、那一個瀏覽器裡，不會傳到任何伺服器
- 每個人打開網址，看到的都是自己的勾選
- 在 LINE 內建瀏覽器和在 Safari 打開，紀錄是分開的；清除瀏覽資料後紀錄會消失

## 修改清單內容

編輯 `index.html` 裡 `window.CAMP_DATA = { … }` 那一段（檔案中間，上方有「清單內容」註解）：

- `startDate`：出發日期，格式 `年-月-日`，例如 `2026-11-14`
- `title`、`subtitle`：標題與副標
- `people`、`tents`：人數與帳篷數，只用在標題文字
- `stickers`、`tags`：開場貼紙與跑馬燈文字
- `shared`、`cook`、`me`：三段清單；每項有 `id`、`name`、`note`，炊具另外有 `tag`
- `asks`：出發前要問營區的事

注意：

- 每個 `id` 不可以重複，勾選紀錄靠 `id` 記住
- `**文字**` 會顯示成粗體
- 改了某項的 `id`，那一項原本的勾選紀錄就會消失

## 本機預覽

直接用瀏覽器打開 `index.html` 就能使用。

## 技術說明

- 沒有使用框架或外部程式庫
- 字型：Google Fonts 的 Huninn（粉圓體）與 Bricolage Grotesque
- 系統開啟「減少動態效果」時，會關閉動畫
