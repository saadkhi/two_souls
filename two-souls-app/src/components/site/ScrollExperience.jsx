import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDown, Play, Pause, Wind } from 'lucide-react';
import PerfumeScene from './PerfumeScene';
import { advanceScroll, clampProgress } from './scrollMotion';
import { createChapterChoreography } from './perfumeChoreography';

const chapters = [
  { eyebrow:'TWO HEARTS. ONE FRAGRANCE.', title:<>Some things{' '}<br/>are <em>felt.</em></>, description:'A fragrance that speaks before you do.', note:'THE SIGNATURE', name:'Noir Oud', detail:'Eau de parfum · 50 ml', cta:'Discover the fragrance', link:'/product/noir-oud' },
  { eyebrow:'01 / THE FIRST IMPRESSION', title:<>A quiet{' '}<br/><em>beginning.</em></>, description:'A composition that unfolds, one note at a time.', note:'THE OPENING', name:'Bright. Unexpected.', detail:'A first impression that draws you closer.' },
  { eyebrow:'02 / AT THE HEART', title:<>Depth.{' '}<br/>Without{' '}<br/><em>words.</em></>, description:'Oud resin. Warm woods. An intimate accord.', note:'THE HEART', name:'Oud, reimagined.', detail:'Resinous depth, held in balance.' },
  { eyebrow:'03 / THE RELEASE', title:<>One press.{' '}<br/>A world{' '}<br/><em>unfolds.</em></>, description:'A fine mist. A fleeting moment. An unmistakable presence.', note:'THE RITUAL', name:'Let it linger.', detail:'Scroll slowly to release the fragrance.', spray:true },
  { eyebrow:'04 / THE LASTING IMPRESSION', title:<>The moment{' '}<br/>passes.{' '}<br/><em>You remain.</em></>, description:'Your own signature, long after the moment has passed.', note:'THE CONNECTION', name:'Two Souls.', detail:'Two hearts. One fragrance.', cta:'Find your fragrance', link:'/shop' },
];
export default function ScrollExperience({ paused, onPause, onFilm, reduced }) {
  const section=useRef(null);
  const chapterElements=useRef([]);
  const progressBar=useRef(null);
  const viewportProbe=useRef(null);
  const timeline=useRef({progress:0,target:0,velocity:0});
  const [active,setActive]=useState(0);
  const [spray,setSpray]=useState(0);
  const [sprayBusy,setSprayBusy]=useState(false);
  useEffect(()=>{
    let frame=0,last=performance.now(),currentChapter=-1;
    const state=timeline.current;
    const chapterAnimation=createChapterChoreography(chapters.length);
    // innerHeight changes while a mobile browser's toolbar slides in and out, which
      // would make the bottle jump. The probe is the large viewport, which never moves.
      const scroll=()=>{const viewport=viewportProbe.current?.offsetHeight||innerHeight;const total=document.documentElement.scrollHeight-viewport;state.target=clampProgress(scrollY/Math.max(1,total));};
    const update=now=>{
      const dt=(now-last)/1000;last=now;
      if(reduced){state.progress=state.target;state.velocity=0;}else advanceScroll(state,dt);
      const nextChapter=Math.min(chapters.length-1,Math.floor(state.progress*chapters.length));
      if(nextChapter!==currentChapter){currentChapter=nextChapter;setActive(nextChapter);}
      const chapterStates=chapterAnimation.sample(state.progress);
      chapterElements.current.forEach((element,i)=>{
        const transition=chapterStates[i];
        const opacity=reduced?Number(i===nextChapter):transition.opacity;
        element.style.opacity=String(opacity);
        element.style.visibility=opacity>.0001?'visible':'hidden';
        element.style.setProperty('--chapter-shift',`${reduced?0:transition.shift}px`);
      });
      const pageProgress=state.progress.toFixed(4);if(section.current.dataset.pageProgress!==pageProgress)section.current.dataset.pageProgress=pageProgress;
      progressBar.current.style.transform=`scaleX(${state.progress})`;
      frame=requestAnimationFrame(update);
    };
    const restore=()=>{last=performance.now();scroll();};
    const observer=new ResizeObserver(scroll);observer.observe(document.body);
    addEventListener('scroll',scroll,{passive:true});addEventListener('resize',scroll);
    document.addEventListener('visibilitychange',restore);scroll();frame=requestAnimationFrame(update);
    return()=>{cancelAnimationFrame(frame);chapterAnimation.dispose();observer.disconnect();removeEventListener('scroll',scroll);removeEventListener('resize',scroll);document.removeEventListener('visibilitychange',restore);};
  },[reduced]);
  const release=()=>{if(paused)onPause();setSpray(v=>v+1);};
  return <section ref={section} className={`centered-journey ${reduced?'reduced-motion':''}`} aria-label="The Noir Oud fragrance story">
    <span id="story" className="journey-story-anchor"/>
    <span ref={viewportProbe} className="journey-viewport-probe" aria-hidden="true"/>
    <div className="centered-product" aria-label="Centered fragrance bottle"><PerfumeScene paused={paused} scrollTimeline={timeline} sprayTrigger={spray} onSprayChange={setSprayBusy}/></div>
    <div className="journey-halo" aria-hidden="true"/>
    {chapters.map((chapter,i)=><article ref={element=>{chapterElements.current[i]=element;}} className="journey-chapter" key={chapter.eyebrow} data-chapter={i} aria-hidden={active!==i} inert={active!==i?'':undefined} style={{pointerEvents:active===i?'auto':'none'}}>
      <div className="journey-copy"><p className="souls-eyebrow">{chapter.eyebrow}</p>{i===0?<h1>{chapter.title}</h1>:<h2>{chapter.title}</h2>}<p className="journey-description">{chapter.description}</p>{chapter.cta&&<Link className="souls-primary" to={chapter.link}>{chapter.cta}<ArrowUpRight size={16}/></Link>}{chapter.spray&&<button className="souls-primary" onClick={release} disabled={sprayBusy}><Wind size={16}/> {sprayBusy?'Releasing fragrance…':'Press to spray'}</button>}{i===0&&<button className="journey-watch" onClick={onFilm}><Play size={12}/> Watch the film</button>}</div>
      <aside className="journey-note"><span className="note-rule"/><p className="souls-eyebrow">{chapter.note}</p><h3>{chapter.name}</h3><p>{chapter.detail}</p></aside>
    </article>)}
    <div className="centered-journey-controls"><span className="journey-scroll"><ArrowDown size={13}/> SCROLL TO DISCOVER</span><div className="journey-chapter-indicator" aria-label={`Chapter ${active+1} of 5`}>{chapters.map((c,i)=><span key={i} className={i===active?'current':''}>{String(i+1).padStart(2,'0')}</span>)}</div><button aria-label={paused?'Play animation':'Pause animation'} onClick={onPause}>{paused?<Play size={12}/>:<Pause size={12}/>}<span>{paused?'PLAY MOTION':'PAUSE MOTION'}</span></button></div>
    <div className="journey-document-progress" aria-hidden="true"><span ref={progressBar}/></div>
  </section>;
}
