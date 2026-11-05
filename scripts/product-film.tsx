import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MessageSquareCode, ArrowUpRight, Check, Sun, Moon } from 'lucide-react';
import '../frontend/src/index.css';
import './product-film.css';
import { Navbar } from '../frontend/src/components/layout/Navbar';
import { RoomWorkspaceView } from '../frontend/src/components/room/RoomWorkspaceView';
import { ChatMessageList } from '../frontend/src/components/room/ChatMessageList';
import { PollCard } from '../frontend/src/components/room/workspace/PollCard';
import { DecisionPanel } from '../frontend/src/components/room/workspace/DecisionPanel';
import type { ChatMessage, Poll, DecisionCard } from '../frontend/src/types/room';

const noop=()=>{};
const messages:ChatMessage[]=[
 {id:'m1',senderId:'host',senderName:'Khánh',senderRole:'HOST',avatarColor:'#6155ed',content:'Workshop tới, mình chọn chủ đề gì?',createdAt:'09:41',isMe:true},
 {id:'m2',senderId:'linh',senderName:'Mai Linh',senderRole:'PARTICIPANT',avatarColor:'#3486df',content:'Design Thinking nhé. Mọi người thấy sao?',createdAt:'09:41'},
 {id:'m3',senderId:'host',senderName:'Khánh',senderRole:'HOST',avatarColor:'#6155ed',content:'Hay đấy. Cùng bình chọn nào!',createdAt:'09:42',isMe:true},
];
const poll:Poll={id:'p1',question:'Chủ đề workshop tiếp theo?',createdBy:'host',totalVotes:3,isClosed:true,options:[{id:'a',text:'Design Thinking',votes:2,votedByMe:true},{id:'b',text:'Kỹ năng thuyết trình',votes:1}]};
const decision:DecisionCard={id:'d1',title:'Chọn chủ đề Design Thinking',details:'Được chọn qua bình chọn của nhóm.',status:'CONFIRMED',creatorNickname:'Khánh',confirmedBy:'Khánh',confirmedAt:'2026-10-30T02:42:00Z',approveCount:2,evidenceType:'POLL'};
function Brand({large=false}:{large?:boolean}){return <div className={`film-brand ${large?'large':''}`}><span className="film-logo"><MessageSquareCode/></span><span>EventChat</span></div>}
function Workspace({dark=true}:{dark?:boolean}){return <div className="native-room" data-project-ui="RoomWorkspaceView"><Navbar isDarkMode={dark}/><RoomWorkspaceView roomTitle="Workshop sáng tạo" roomCode="workshop" roomStatus="ACTIVE" participants={[{id:'host',nickname:'Khánh',role:'HOST',isOnline:true,avatarColor:'#6155ed'},{id:'linh',nickname:'Mai Linh',role:'PARTICIPANT',isOnline:true,avatarColor:'#3486df'},{id:'an',nickname:'An',role:'PARTICIPANT',isOnline:true,avatarColor:'#438676'}]} createdAt="2026-10-30T02:42:00Z" expiresAt="2026-10-31T02:42:00Z" poll={poll} polls={[poll]} decisions={[decision]} messages={messages} isHost currentGuestId="host" onSendMessage={async()=>true} onVotePoll={noop} onOpenWheelModal={noop} onConfirmDecision={noop} onAddDecision={noop} onCloseRoom={noop} onOpenExport={noop}/></div>}
function ThemeContent({light=false}:{light?:boolean}){return <><div className="theme-heading"><span>GIAO DIỆN CỦA BẠN</span><h2>Sáng hay tối.<br/><em>Luôn rõ ràng.</em></h2></div><div className="theme-mode-label">{light?<Sun/>:<Moon/>}{light?"Light Mode":"Dark Mode"}</div><div className="workspace-window theme-workspace"><Workspace dark={!light}/></div><div className="theme-switch-ring"/></>}
function Film(){return <div id="film" className="dark">
 <div className="ambient"/><div className="light-line"/><div className="film-signature"><MessageSquareCode/><span>EventChat</span></div>
 <section className="scene" id="hero"><div className="hero-lockup"><Brand large/><div className="hero-copy">Bàn nhanh.<span>Chốt rõ.</span></div><p className="hero-sub">Một cuộc trò chuyện. Những quyết định tốt hơn.</p></div><div className="hero-orbit"/></section>
 <section className="scene" id="overview"><div className="overview-heading"><span>CẢ NHÓM, CÙNG MỘT NƠI.</span><h2>Từ cuộc trò chuyện<br/>đến <em>đồng thuận.</em></h2></div><div className="workspace-window"><Workspace/></div></section>
 <section className="scene" id="conversation"><div className="chat-heading"><span>THẢO LUẬN</span><h2>Ý tưởng hay.<br/><em>Bắt đầu ở đây.</em></h2></div>{messages.map((message,index)=><div className={`message-layer message-${index}`} key={message.id} data-project-ui="ChatMessageList"><ChatMessageList messages={[message]} onOpenDecisions={noop}/></div>)}<div className="thread-trace"><i/><i/><i/></div></section>
 <section className="scene" id="poll"><div className="poll-heading"><span>BÌNH CHỌN</span><h2>Cả nhóm.<br/><em>Cùng chọn.</em></h2><p>Mỗi ý kiến đều được ghi nhận.</p><div className="voters"><b>K</b><b>L</b><b>A</b><small>3 người đã bình chọn</small></div></div><div className="native-poll" data-project-ui="PollCard"><PollCard poll={poll} roomStatus="ACTIVE" onVotePoll={noop}/></div><div className="poll-echo"/></section>
 <section className="scene" id="result"><div className="result-heading"><span>QUYẾT ĐỊNH</span><h2>Đã thống nhất.<br/><em>Đã sẵn sàng.</em></h2></div><div className="native-decision" data-project-ui="DecisionPanel"><DecisionPanel decisions={[decision]} roomStatus="ACTIVE" isHost onConfirmDecision={noop} onAddDecision={noop}/></div><div className="report-window"><img src="launch-assets/report.png" alt="Biên bản EventChat"/></div><div className="export-confirmation"><Check/>Biên bản đã sẵn sàng để chia sẻ<ArrowUpRight/></div></section>
 <section className="scene" id="theme"><ThemeContent/></section>
 <section className="scene" id="end"><div className="end-lockup"><Brand large/><h2>Ít loay hoay.<br/><em>Nhiều đồng thuận.</em></h2><p>Tạo phòng. Mời cả nhóm. Bắt đầu ngay.</p><div className="end-rule"/></div></section>
 </div>}
flushSync(()=>createRoot(document.getElementById('root')!).render(<><Film/><div id="light-theme" className="theme-light"><div className="film-signature"><MessageSquareCode/><span>EventChat</span></div><ThemeContent light/></div></>));
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const ease=(x:number)=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
const out=(x:number)=>1-Math.pow(1-clamp(x),4);
const intervals=[[0,2.8],[2.5,5.8],[5.5,9.8],[9.5,14.2],[13.9,19.8],[19.5,23.8],[23.5,28]];
function el(selector:string){return document.querySelector<HTMLElement>(selector)!}
function transform(selector:string,x=0,y=0,scale=1,opacity=1,rotation=0){const node=el(selector);node.style.transform=`translate(${x}px,${y}px) scale(${scale}) rotate(${rotation}deg)`;node.style.opacity=String(opacity)}
// Keep the camera on the product planes so film typography stays stable.
function depth(selector:string,rx:number,ry:number,z:number){if(Math.abs(rx)+Math.abs(ry)+Math.abs(z)<.0001)return;const node=el(selector);node.style.transform+=` perspective(1800px) translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg)`}
function seek(t:number){t=Math.max(0,Math.min(28,t));
 document.querySelectorAll<HTMLElement>('.scene').forEach((scene,i)=>{const [start,end]=intervals[i],u=t-start,duration=end-start;const alpha=ease((u+.1)/.5)*(i===6?1:1-ease((u-duration+.35)/.55));scene.style.opacity=String(alpha);scene.style.visibility=alpha<.001?'hidden':'visible'});
 const a=out(t/1.15);transform('.hero-lockup',0,(1-a)*32,.965+.035*a);el('.hero-sub').style.opacity=String(ease((t-.55)/.7));el('.hero-orbit').style.transform=`translate(-50%,-50%) rotate(${t*2}deg)`;
 let u=t-2.5,p=out(u/1.0);transform('.overview-heading',0,(1-p)*24,1,p);transform('.workspace-window',0,(1-p)*130,.94+.06*p);el('.workspace-window').style.clipPath=`inset(0 0 ${7*(1-p)}% 0 round 16px)`;
 u=t-5.5;p=out(u/.9);transform('.chat-heading',(1-p)*-30,0,1,p);messages.forEach((_,j)=>{const q=out((u-.3-j*.52)/.9);transform(`.message-${j}`,(1-q)*(j===1?-80:80),(1-q)*22,1.35,q)});transform('.thread-trace',0,0,1,ease((u-1.5)/.7));
 u=t-9.5;p=out(u/.95);transform('.poll-heading',(1-p)*-30,0,1,p);transform('.native-poll',(1-p)*115,(1-p)*22,1.13,p);el('.poll-echo').style.opacity=String(p*.4);const progress=ease((u-.65)/1.5);document.querySelectorAll<HTMLElement>('.native-poll label > span[aria-hidden="true"]').forEach((bar,j)=>bar.style.transform=`scaleX(${progress*(j===0?2/3:1/3)})`);el('.voters').style.opacity=String(ease((u-1.2)/.7));
 u=t-13.9;p=out(u/.95);const q=out((u-.6)/1.25);transform('.result-heading',(1-p)*-35,0,1,p);transform('.native-decision',(1-p)*-60,(1-p)*20,1.22,p);transform('.report-window',(1-q)*190,(1-q)*20,.92+.08*q,q,(1-q)*4);transform('.export-confirmation',0,(1-ease((u-2)/.7))*15,1,ease((u-2)/.7));
 u=t-19.5;const lightProgress=ease((u-1.0)/.8)*(1-ease((u-2.8)/.8));const themeAlpha=ease((u+.1)/.5)*(1-ease((u-4.3+.35)/.55));el('#light-theme').style.clipPath=`circle(${lightProgress*1450}px at 1190px 257px)`;el('#light-theme').style.opacity=String(themeAlpha);el('#light-theme').style.visibility=lightProgress>.0001&&themeAlpha>.0001?'visible':'hidden';document.querySelectorAll<HTMLElement>('.theme-switch-ring').forEach(r=>{const pulse=clamp((u-.65)/.65);r.style.transform=`translate(-50%,-50%) scale(${1+pulse*2})`;r.style.opacity=String((1-pulse)*ease((u-.65)/.12))});
 u=t-23.5;p=out(u/1.25);transform('.end-lockup',0,(1-p)*30,.97+.03*p);el('.end-lockup p').style.opacity=String(ease((u-.8)/.8));el('.end-rule').style.transform=`scaleX(${ease((u-.5)/1.5)})`;
 const overviewCamera=1-ease((t-2.5)/1.5);el('#overview .workspace-window').style.transform+=` scale(${1+.008*ease((t-2.5)/3.1)})`;depth('#overview .workspace-window',2.5*overviewCamera,7*overviewCamera,8*overviewCamera);
 messages.forEach((_,j)=>{const camera=1-ease((t-5.5-j*.52)/1.4);depth(`.message-${j}`,camera*1.8,(j===1?4:-4)*camera,[8,22,34][j]*camera)});
 const pollCamera=1-ease((t-9.5)/1.6);el('.native-poll').style.transform+=` scale(${1+.007*ease((t-9.5)/4.3)})`;depth('.native-poll',2.3*pollCamera,-6*pollCamera,8*pollCamera);
 const resultCamera=1-ease((t-13.9)/2.4);depth('.native-decision',1.3*resultCamera,3*resultCamera,6*resultCamera);depth('.report-window',3.5*resultCamera,-8*resultCamera,12*resultCamera);
 // Both theme layers share the same pose, settling before the circular reveal.
 const themeCamera=1-ease((t-19.5)/.85);document.querySelectorAll<HTMLElement>('.theme-workspace').forEach(node=>node.style.transform=themeCamera<.0001?"none":`perspective(1800px) rotateX(${3*themeCamera}deg) rotateY(${6*themeCamera}deg)`);
 el('.ambient').style.transform=`translateX(${Math.sin(t*.17)*42}px)`;window.currentIntroTime=t;return{time:t};
}
declare global{interface Window{intro:{duration:number;seek:typeof seek;play:()=>void;pause:()=>void};currentIntroTime:number}}
let animation=0;function play(){cancelAnimationFrame(animation);const start=performance.now();function tick(now:number){const time=(now-start)/1000;seek(time);if(time<28)animation=requestAnimationFrame(tick)}animation=requestAnimationFrame(tick)}
function resize(){for(const film of [document.getElementById('film'),document.getElementById('light-theme')])if(film)film.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1280,innerHeight/720)})`}
requestAnimationFrame(()=>{resize();seek(0);window.intro={duration:28,seek,play,pause(){cancelAnimationFrame(animation)}};if(!new URLSearchParams(location.search).has('render'))play()});addEventListener('resize',resize);
