import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import { defineConfig, type PluginOption } from "vite"

export default defineConfig({
  base: "/data/",
  plugins: [
    solidStart() as PluginOption,
    // SAFETY: Nitro supports Vite 7, but Windows hoisting resolves its plugin types against Vite 8.
    nitro({
      compatibilityDate: "2024-09-19",
      preset: "cloudflare-module",
      cloudflare: {
        nodeCompat: true,
      },
    }) as PluginOption,
  ],
  server: {
    allowedHosts: true,
  },
  build: {
    minify: "esbuild",
    cssMinify: true,
  },
})
