const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../ecv-analytics.js'),'utf8');
function setup(path='/quanto-falta-premier-league/', parentWindow=null){
 let now=0,seq=0;const timers=new Map(),events=[],listeners={},wl={},els={};
 const doc={visibilityState:'visible',getElementById:id=>els[id]||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(type,cb)=>(listeners[type]??=[]).push(cb),head:{append(){}}};
 const win={gtag:(...e)=>events.push(e),addEventListener:(type,cb)=>wl[type]=cb};
 const context={window:win,parent:parentWindow||win,document:doc,location:{pathname:path,search:'',origin:'https://test.local',href:'https://test.local'+path},URL,URLSearchParams,innerHeight:800,setTimeout:(cb,ms)=>{timers.set(++seq,{cb,due:now+ms});return seq},clearTimeout:id=>timers.delete(id)};
 function advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.due<=now){timers.delete(id);t.cb()}}
 function emit(type,target,trusted=true){for(const cb of listeners[type]||[])cb({type,target,isTrusted:trusted})}
 function field(id,value){return els[id]={id,value:String(value),tagName:'INPUT',checkValidity:()=>true,closest:()=>null}}
 return {context,win,doc,events,els,advance,emit,field,wl,start:()=>vm.runInNewContext(source,context)};
}
const s=setup();for(const [id,value]of Object.entries({points:20,played:15,target:45,total:38}))s.field(id,value);s.els.selection={textContent:'Arsenal'};s.start();
assert.equal(s.events.length,0,'automatic initial selection must not count as use');
s.emit('input',s.els.points,false);s.advance(1000);assert.equal(s.events.length,0,'synthetic inputs ignored');
s.emit('input',s.els.points);s.advance(500);assert.equal(s.events.length,0);s.emit('input',s.els.points);s.advance(1000);
assert.deepEqual(s.events.map(e=>e[1]),['ecv_use_tool','ecv_simulate']);assert.equal(s.events[1][2].ecv_league,'premier_league');assert.equal(s.events[1][2].ecv_team,'Arsenal');
s.emit('input',s.els.points);s.advance(1000);assert.equal(s.events.length,2,'identical simulation deduplicated');
s.els.points.value='999';s.emit('input',s.els.points);s.advance(1000);assert.equal(s.events.length,2,'invalid simulation ignored');
const f={id:'gc-venue',value:'home',type:'select-one',closest:selector=>selector==='section[id]'?{id:'relogio-dos-gols'}:null};s.emit('change',f);assert.equal(s.events.at(-1)[1],'ecv_filter_change');assert.equal(s.events.at(-1)[2].ecv_option,'home');
// Embedded pages delegate and never initialize a second tag.
let delegated=0;const child=setup('/quanto-falta-premier-league/projetor.html',{ECVAnalytics:{attach:(d,t)=>{assert.equal(t,'projetor');delegated++}}});child.start();assert.equal(delegated,1);assert.equal(child.events.length,0);
// Continuous section visibility cancels on backgrounding and counts once.
const v=setup('/calculadora-45-pontos/');v.els['quanto-falta']={getBoundingClientRect:()=>({top:0,bottom:300,height:300})};v.start();v.advance(1500);v.doc.visibilityState='hidden';v.emit('visibilitychange',{});v.advance(1000);assert.equal(v.events.length,0);v.doc.visibilityState='visible';v.emit('visibilitychange',{});v.advance(2000);assert.equal(v.events[0][1],'ecv_view_tool');v.wl.scroll();v.advance(3000);assert.equal(v.events.length,1);
console.log('PASS: initial/synthetic events, debounce, validation, deduplication, filter context, iframe delegation, visibility and once-per-page views');
