# Panel iOS Free Fire

Ban dau la mot panel phong cach iOS, hien tai duoc don dep de san sang bo sung chuc nang toi uu theo yeu cau tiep theo.

## Cach chay

- Mo file `index.html` trong thu muc `panel` la co the xem giao dien ngay.
- Tat ca tac vu chi chay client-side, nen chi can mo trang la co the bat/tat cac muc tren menu ngay lap tuc.

## Build / Minify (tuy chon)

Ma chay hoan toan client-side nen nguoi dung luon xem duoc; minify chi lam source kho doc hon.

Vi du lenh minify:

```bash
npm install --save-dev terser cssnano-cli
npx terser java/app.js --compress --mangle --output dist/app.min.js
npx cssnano color/theme.css dist/theme.min.css
```

Neu dung file minify, nhap duong dan moi trong `index.html`.
