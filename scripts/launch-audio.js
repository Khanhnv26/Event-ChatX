// Original, deterministic electronic bed and scene accents. No sampled music.
window.recordLaunchAudio=async function(duration=24){
 if(!MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))throw Error('Opus recording is unavailable');
 const sampleRate=48000,offline=new OfflineAudioContext(2,sampleRate*duration,sampleRate);
 const master=offline.createGain(),compressor=offline.createDynamicsCompressor();
 compressor.threshold.value=-18;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.01;compressor.release.value=.2;
 master.connect(compressor);compressor.connect(offline.destination);
 master.gain.setValueAtTime(0,0);master.gain.linearRampToValueAtTime(.8,.5);master.gain.setValueAtTime(.8,duration-1.5);master.gain.linearRampToValueAtTime(0,duration);
 function note(freq,start,len,level,type='sine',pan=0){const oscillator=offline.createOscillator(),gain=offline.createGain(),panner=offline.createStereoPanner();oscillator.type=type;oscillator.frequency.value=freq;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+Math.min(.2,len*.12));gain.gain.exponentialRampToValueAtTime(.0001,start+len);panner.pan.value=pan;oscillator.connect(gain);gain.connect(panner);panner.connect(master);oscillator.start(start);oscillator.stop(Math.min(duration,start+len));}
 const chords=[[220,261.63,329.63,392],[174.61,220,261.63,349.23],[130.81,196,246.94,329.63],[196,246.94,293.66,392],[220,261.63,329.63,440],[174.61,220,261.63,349.23]];
 Array.from({length:Math.ceil(duration/4)},(_,index)=>chords[index%chords.length]).forEach((chord,index)=>chord.forEach((frequency,j)=>note(frequency,index*4,Math.min(4.3,duration-index*4),.028,'sine',(j-1.5)*.25)));
 for(let t=0;t<duration-1;t+=.5){const root=chords[Math.floor(t/4)%chords.length][0]/2;note(root,t,.34,.055,'triangle',0);if(Number.isInteger(t)){const oscillator=offline.createOscillator(),gain=offline.createGain();oscillator.frequency.setValueAtTime(95,t);oscillator.frequency.exponentialRampToValueAtTime(43,t+.12);gain.gain.setValueAtTime(.11,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.22);oscillator.connect(gain);gain.connect(master);oscillator.start(t);oscillator.stop(t+.24);}}
 let seed=4719;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296*2-1};
 function noise(start,length,level,frequency){const buffer=offline.createBuffer(1,Math.ceil(length*sampleRate),sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=random();const source=offline.createBufferSource(),filter=offline.createBiquadFilter(),gain=offline.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(frequency,start);filter.frequency.exponentialRampToValueAtTime(frequency*2.5,start+length);filter.Q.value=.7;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+length*.2);gain.gain.linearRampToValueAtTime(0,start+length);source.connect(filter);filter.connect(gain);gain.connect(master);source.start(start);}
 for(let t=3.25;t<duration-1;t+=.5)noise(t,.045,.014,6500);
 [3,6.5,10.5,14.6,19.8,20.5,22.5,23.8].forEach((t,index)=>{noise(t-.15,.5,.045,450);[523.25,659.25,783.99].forEach((f,j)=>note(f,t+j*.075,.7,.025,'sine',(j-1)*.3));});
 const buffer=await offline.startRendering();let peak=0,sum=0;for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);for(const value of data){peak=Math.max(peak,Math.abs(value));sum+=value*value;}}
 const rawRms=Math.sqrt(sum/(buffer.length*2)),level=Math.min(.78/peak,.11/rawRms);for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<data.length;i++)data[i]*=level;}
 const context=new AudioContext({sampleRate}),destination=context.createMediaStreamDestination(),source=context.createBufferSource();source.buffer=buffer;source.connect(destination);await context.resume();
 const recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:160000}),chunks=[];
 const stopped=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onerror=reject;recorder.onstop=resolve;});
 recorder.start(250);source.start();await new Promise(resolve=>source.onended=resolve);await new Promise(resolve=>setTimeout(resolve,120));recorder.stop();await stopped;await context.close();
 const bytes=new Uint8Array(await new Blob(chunks,{type:'audio/webm'}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return{base64:btoa(binary),analysis:{duration,sampleRate,channels:2,peak:peak*level,rms:rawRms*level,originalSynthesis:true}};
};
