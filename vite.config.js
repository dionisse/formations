import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        connexion: fileURLToPath(new URL('./connexion.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
        perfecto: fileURLToPath(new URL('./perfecto.html', import.meta.url))
      }
    }
  }
});
