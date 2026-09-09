import {cp,mkdir} from 'node:fs/promises';
for(const folder of ['cmaps','standard_fonts','wasm']){
 const target=new URL('../public/pdfjs/'+folder,import.meta.url);
 await mkdir(target,{recursive:true});
 await cp(new URL('../node_modules/pdfjs-dist/'+folder,import.meta.url),target,{recursive:true});
}
