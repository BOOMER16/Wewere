import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {sites} from './build/sites-vite-plugin';
import path from 'node:path';
export default defineConfig({plugins:[react(),sites({mockAuth:false})],resolve:{alias:{'@':path.resolve(process.cwd())}},build:{outDir:'dist/client',emptyOutDir:true},server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:5174'}}});
