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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // UI Components
          if (id.includes('@radix-ui/react-')) {
            return 'ui-components';
          }
          
          // Charts
          if (id.includes('recharts') || id.includes('@xyflow/react')) {
            return 'charts';
          }
          
          // Form libraries
          if (id.includes('react-hook-form') || 
              id.includes('@hookform/resolvers') || 
              id.includes('zod')) {
            return 'form-libs';
          }
          
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
        }
      }
    }
  }
}));
