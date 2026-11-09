/* Elenca i testi italiani usati con T.tr(...) che non hanno traduzione EN o DE.
   Uso: node tests/traduzioni-mancanti.js   (stampa [] se e' tutto tradotto; esce con 1 se manca qualcosa) */
const fs=require('fs'), path=require('path'), dir=process.argv[2]||path.join(__dirname,'..');
global.T={}; eval(fs.readFileSync(dir+'/src/js/03-dict.js','utf8'));
const D=T.DICT, keys=new Set();
const lit='"((?:[^"\\\\]|\\\\.)*)"';
const res=[new RegExp('T\\.tr\\(\\s*'+lit,'g'), new RegExp('T\\.tr\\([^"()]*\\?\\s*'+lit+'\\s*:\\s*'+lit,'g'), new RegExp('T\\.confirm\\([^;]*?'+lit,'g')];
for(const f of fs.readdirSync(dir+'/src/js').filter(f=>f.endsWith('.js')&&f!=='03-dict.js')){
  const s=fs.readFileSync(dir+'/src/js/'+f,'utf8');
  for(const re of res){ let m; re.lastIndex=0; while((m=re.exec(s))){ for(const g of m.slice(1)) if(g!==undefined) keys.add(JSON.parse('"'+g+'"')); } }
}
const fz=fs.readFileSync(dir+'/src/js/07-fire.js','utf8'); const zr=/name: "([^"]+)",\s+c: "[^"]+", text: "([^"]+)"/g; let m; while((m=zr.exec(fz))){keys.add(m[1]);keys.add(m[2]);}
const miss=[...keys].filter(k=>/[a-zA-Z\u00c0-\u00ff]{3}/.test(k)&&(D.en[k]===undefined||D.de[k]===undefined));
console.log(JSON.stringify(miss,null,1));
process.exitCode = miss.length ? 1 : 0;
