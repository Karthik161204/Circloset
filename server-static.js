// Zero-dependency static server for CIRCLOSET (no npm install needed)
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'public'),port=process.env.PORT||3000;
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
http.createServer((req,res)=>{
  let f=path.normalize(path.join(root,decodeURIComponent(req.url.split('?')[0])));
  if(!f.startsWith(root)){res.writeHead(403);return res.end('Forbidden')}
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(200,{'Content-Type':types['.html']});return fs.createReadStream(path.join(root,'index.html')).pipe(res)}
    res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(d)});
}).listen(port,()=>console.log('CIRCLOSET running at http://localhost:'+port));
