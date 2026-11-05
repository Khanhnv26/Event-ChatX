import {build} from '../frontend/node_modules/vite/dist/node/index.js';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
await build({configFile:path.join(root,'frontend/vite.config.ts'),root:path.join(root,'frontend'),define:{'process.env.NODE_ENV':JSON.stringify('production')},resolve:{dedupe:['react','react-dom','lucide-react']},build:{outDir:path.join(root,'artifacts/videos/film-runtime'),emptyOutDir:false,lib:{entry:path.join(root,'scripts/product-film.tsx'),name:'EventChatFilm',formats:['iife'],fileName:()=> 'product-film.js',cssFileName:'product-film'},minify:false}});


