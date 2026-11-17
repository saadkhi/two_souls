import { useEffect, useRef, useState } from 'react';
import PerfumeScene from './PerfumeScene';
export default function PerfumeFilm({ reduced }) {
  const elapsed=useRef(0);
  const timeline=useRef({progress:0,loop:true});
  const [paused,setPaused]=useState(reduced);
  useEffect(()=>{
    if(paused)return;
    let frame,last=performance.now();
    const resetClock=()=>{last=performance.now();};
    const animate=now=>{
      const delta=document.hidden?0:Math.min(Math.max(now-last,0),50);
      last=now;
      elapsed.current+=delta;
      // The endpoint poses match, so the next cycle continues the same turn.
      timeline.current.progress=(elapsed.current%12000)/12000;
      frame=requestAnimationFrame(animate);
    };
    document.addEventListener('visibilitychange',resetClock);
    frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resetClock);};
  },[paused]);
  return <div className="photographic-film"><PerfumeScene scrollTimeline={timeline} paused={paused}/><button onClick={()=>setPaused(value=>!value)}>{paused?'Play film':'Pause film'}</button></div>;
}
