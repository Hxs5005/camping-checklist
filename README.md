# 露營裝備清單

6 人・2 帳的露營裝備分工網頁：公共裝備和炊具認領、依成員篩選、個人行李打勾，用分享連結把分工傳給大家。
純 HTML／CSS／JavaScript，不需要後端、不用安裝或建置，放上 GitHub Pages 就能用。

![預覽圖](og-image.png)

## 功能

- **公共裝備 16 項、炊具 5 項**：打勾代表已備妥；「認領」可以選一個人、好幾個人，或「全員各自帶」
- **成員頭像篩選**：只看某個人負責的項目，或還沒人認領的項目
- **出發前先問營區**：插座位置、能不能用吹風機、飲水設備
- **個人行李 12 項**：每個人自己打勾，全部勾完會有慶祝動畫
- **分享連結**：成員名單、認領和備妥狀態都帶在網址裡，朋友打開就看到同一份分工
- **複製成文字**：分工總表或個人行李清單，可以直接貼到 LINE 群組

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 頁面骨架、字型、分享預覽設定 |
| `style.css` | 樣式與動畫 |
| `data.js` | 清單內容（要改項目就改這個） |
| `app.js` | 互動邏輯 |
| `og-image.png` | 在 LINE、Facebook 分享網址時的預覽圖 |
| `apple-touch-icon.png` | iPhone「加入主畫面」的圖示 |

所有檔案放在同一層，不需要資料夾。

## 部署到 GitHub Pages

1. 在 GitHub 建立新的 repository，例如 `camping-checklist`，設成 **Public**
   （免費方案的 GitHub Pages 只支援 Public repository）
2. 在 repository 頁面按 **Add file → Upload files**，把上面 6 個檔案拖進去，按 **Commit changes**
3. 到 **Settings → Pages**，在 **Build and deployment** 的 **Source** 選 **Deploy from a branch**
4. Branch 選 `main`，資料夾選 `/ (root)`，按 **Save**
5. 等一到兩分鐘，網址會是 `https://你的帳號.github.io/camping-checklist/`

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

**主揪**

1. 按「編輯成員名單」，填 6 個人的名字
2. 每一項按「認領」選誰帶，打勾代表已備妥
3. 改完後按底部的「傳分享連結給大家」，貼到 LINE 群組

**朋友**

1. 打開群組裡的分享連結，分工會自動載入
2. 點自己的頭像，只看自己要帶的東西
3. 個人行李自己打勾

有人改了分工，就再傳一次新的連結；最後傳出的那個就是最新版本。

## 資料存在哪裡

- 分工和個人勾選都存在瀏覽器的 localStorage，只在那一台裝置、那一個瀏覽器裡
- 分享連結把分工編碼在網址 `#` 後面；`#` 後面的內容不會傳到伺服器，GitHub Pages 只提供靜態檔案
- 在 LINE 內建瀏覽器和在 Safari 打開，紀錄是分開的；換手機或清除瀏覽資料後，重新打開分享連結即可
- 沒有即時同步：兩個人同時修改，各自的版本不會自動合併
- 打開分享連結時，如果這台裝置已經有不同的分工，會先詢問要保留哪一份

## 修改清單內容

編輯 `data.js`：

- `title`、`subtitle`：標題與副標
- `people`：人數（1～10），決定成員名單有幾格；`tents`：帳篷數，只用在標題文字
- `stickers`、`tags`：開場貼紙與跑馬燈文字
- `shared`、`cook`、`me`：三段清單；每項有 `id`、`name`、`note`，炊具另外有 `tag`
- `asks`：出發前要問營區的事

注意：

- 每個 `id` 不可以重複，分享連結靠 `id` 對應項目
- `**文字**` 會顯示成粗體
- 刪除或改了某項的 `id`，舊分享連結裡對應的認領會被略過

## 本機預覽

直接用瀏覽器打開 `index.html` 就能使用；分享連結也能在本機測試。

## 技術說明

- 沒有使用框架或外部程式庫
- 字型：Google Fonts 的 Huninn（粉圓體）與 Bricolage Grotesque
- 系統開啟「減少動態效果」時，會關閉動畫
