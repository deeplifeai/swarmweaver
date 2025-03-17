import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor (core libraries)
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router-dom')) {
            return 'vendor';
          }
          
          // App code
          if (id.includes('/src/services/')) {
            return 'services';
          }
          
          if (id.includes('/src/utils/')) {
            return 'utils';
          }

          // Additional chunking for large dependencies
          if (id.includes('node_modules')) {
            // Group all other node_modules by first letter to avoid too many chunks
            const match = id.match(/node_modules\/([^/]+)/);
            if (match) {
              return `vendor-${match[1].charAt(0)}`;
            }
          }
        },
        // Optimize chunk naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Enable source maps for better debugging
    sourcemap: true,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Optimize dependencies
    optimizeDeps: {
      exclude: ['@slack/bolt', 'ioredis', 'winston', 'express']
    },
    // Handle Node.js built-in modules
    commonjsOptions: {
      include: [/node_modules/],
      exclude: [/@slack\/bolt/, /ioredis/, /winston/, /express/]
    }
  }
}));
