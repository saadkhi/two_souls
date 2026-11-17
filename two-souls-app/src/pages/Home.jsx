import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, X, Menu, ShoppingBag, Download } from 'lucide-react';
import PerfumeScene from '@/components/site/PerfumeScene';
import PerfumeFilm from '@/components/site/PerfumeFilm';
import ScrollExperience from '@/components/site/ScrollExperience';
import { buildNanoBananaPrompt } from '@/vendor/open-generative-ai/promptUtils';
import './landing.css';

const filmBrief = buildNanoBananaPrompt('Two Souls Noir Oud perfume. Amber glass bottle with a dark sculpted cap, gold collar, subtle ripples on an obsidian surface. Slow orbit, drifting gold particles, restrained forest-green and warm amber palette. Seamless eight-second luxury perfume film.', 'Full-Frame Cine Digital', 'Classic Anamorphic', 50, 'f/1.4');
export default function Home() {

  const [paused, setPaused] = useState(false);
  const [film, setFilm] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reduced, setReduced] = useState(false);
  const close = useRef(null);
  const filmDialog = useRef(null);
  useEffect(() => { const mq=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setReduced(mq.matches);if(mq.matches)setPaused(true);};update();mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update); }, []);
  useEffect(()=>{if(!film)return;const previous=document.activeElement;document.body.style.overflow='hidden';close.current?.focus();const key=e=>{if(e.key==='Escape')setFilm(false);if(e.key==='Tab'){const items=[...filmDialog.current.querySelectorAll('button, a, video')];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};window.addEventListener('keydown',key);return()=>{document.body.style.overflow='';window.removeEventListener('keydown',key);previous?.focus();};},[film]);
  if(new URLSearchParams(window.location.search).has('capture'))return <div style={{width:1280,height:1000,background:'#090b0a'}}><PerfumeScene capture /></div>;
  const downloadBrief=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([filmBrief],{type:'text/plain'}));a.download='two-souls-cinematic-brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  return <div className="souls-landing cinematic-home">
    <header className="souls-nav"><Link className="souls-wordmark" to="/" aria-label="Two Souls home">TWO SOULS<span>THE ART OF CONNECTION</span></Link><nav aria-label="Main navigation" className={menu?'souls-links is-open':'souls-links'}><Link to="/shop">Fragrances</Link><a href="#story" onClick={()=>setMenu(false)}>Our world</a></nav><div className="souls-nav-end"><Link to="/shop" className="nav-shop">Explore the collection <ArrowUpRight size={14}/></Link><Link to="/cart" aria-label="Shopping bag"><ShoppingBag size={18} strokeWidth={1.3}/></Link><button className="mobile-menu" aria-label="Toggle navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></header>
    <main>
      <ScrollExperience paused={paused} onPause={()=>setPaused(!paused)} onFilm={()=>setFilm(true)} reduced={reduced}/>
    </main><footer className="souls-footer"><Link className="souls-wordmark" to="/">TWO SOULS</Link><p>TWO HEARTS. ONE FRAGRANCE.</p><nav aria-label="Footer"><Link to="/track">Track an order</Link><Link to="/policies">Shipping & returns</Link><Link to="/account">My account</Link></nav><span>© {new Date().getFullYear()} Two Souls</span></footer>
    {film&&<div className="film-overlay" onClick={e=>{if(e.target===e.currentTarget)setFilm(false);}}><div ref={filmDialog} role="dialog" aria-modal="true" aria-labelledby="film-title" className="film-dialog"><button ref={close} className="film-close" onClick={()=>setFilm(false)} aria-label="Close film"><X/></button><p className="souls-eyebrow">A TWO SOULS FILM</p><h2 id="film-title">The art of connection.</h2><PerfumeFilm reduced={reduced}/><div className="film-meta"><span>NOIR OUD / A STUDY IN LIGHT & MOVEMENT</span><button onClick={downloadBrief}><Download size={14}/> Film brief</button></div></div></div>}
  </div>;
}
