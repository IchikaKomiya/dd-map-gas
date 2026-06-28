import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" にすることで GitHub Pages の /<repo>/ サブパス配信でも
// 相対パスでアセットを解決できる（クライアントルーティングは使わない構成）。
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
  },
});
