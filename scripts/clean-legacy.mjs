import {rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
// Fixed allowlist: no environment files, exported data, or new server files.
for(const name of ['backend','tests/backend.test.mjs','vite.config.js','index.html','public/config.js','scripts/configure-dist.mjs']){
 rmSync(join(root,name),{recursive:true,force:true});console.log('Đã dọn: '+name);
}
